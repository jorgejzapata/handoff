import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, Unsubscribe } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { Listing, PrivateLocation } from './listings'
import { fetchProfile } from './users'

// ---- Model (conversations collection in the MVP spec) ----

export interface Conversation {
  id: string
  listingId: string
  listerId: string
  seekerId: string
  listingTitle: string
  listingThumbUrl?: string
  listingRentCents: number
  listingFrom: string
  listingTo: string
  listerFirstName: string
  listerPhotoUrl?: string
  seekerFirstName: string
  seekerPhotoUrl?: string
  lastMessage: { text: string; senderId: string; sentAt: Date | null }
  unreadCount: Record<string, number>
  lastReadAt: Record<string, Date | null>
  closedReason: 'filled' | 'expired' | null
  blockedBy: string | null
  updatedAt: Date | null
}

export type MessageType = 'text' | 'address' | 'system'

export interface Message {
  id: string
  senderId: string
  text: string
  sentAt: Date | null // null until the server confirms it
  type: MessageType
  pending: boolean
}

export const MESSAGE_MAX = 1000

export function conversationId(listingId: string, seekerId: string) {
  return `${listingId}_${seekerId}`
}

const toDate = (t: unknown) => (t instanceof Timestamp ? t.toDate() : null)
const toIso = (t: unknown) => (t instanceof Timestamp ? t.toDate().toISOString().slice(0, 10) : '')

function toConversation(id: string, d: DocumentData): Conversation {
  const lastReadAt: Record<string, Date | null> = {}
  for (const [k, v] of Object.entries(d.lastReadAt ?? {})) lastReadAt[k] = toDate(v)
  return {
    id,
    listingId: d.listingId,
    listerId: d.listerId,
    seekerId: d.seekerId,
    listingTitle: d.listingTitle ?? '',
    listingThumbUrl: d.listingThumbUrl ?? undefined,
    listingRentCents: d.listingRentCents ?? 0,
    listingFrom: toIso(d.listingFrom),
    listingTo: toIso(d.listingTo),
    listerFirstName: d.listerFirstName ?? '',
    listerPhotoUrl: d.listerPhotoUrl ?? undefined,
    seekerFirstName: d.seekerFirstName ?? '',
    seekerPhotoUrl: d.seekerPhotoUrl ?? undefined,
    lastMessage: {
      text: d.lastMessage?.text ?? '',
      senderId: d.lastMessage?.senderId ?? '',
      sentAt: toDate(d.lastMessage?.sentAt),
    },
    unreadCount: d.unreadCount ?? {},
    lastReadAt,
    closedReason: d.closedReason ?? null,
    blockedBy: d.blockedBy ?? null,
    updatedAt: toDate(d.updatedAt),
  }
}

// The other person in a thread, from my point of view.
export function otherPerson(c: Conversation, me: string) {
  return c.listerId === me
    ? { id: c.seekerId, firstName: c.seekerFirstName, photoUrl: c.seekerPhotoUrl, role: 'seeker' as const }
    : { id: c.listerId, firstName: c.listerFirstName, photoUrl: c.listerPhotoUrl, role: 'lister' as const }
}

// ---- Reads ----

export function subscribeConversations(uid: string, onChange: (c: Conversation[]) => void, onError: (e: Error) => void): Unsubscribe {
  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
    limit(100),
  )
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => toConversation(d.id, d.data()))), onError)
}

export function subscribeConversation(id: string, onChange: (c: Conversation | null) => void, onError: (e: Error) => void) {
  return onSnapshot(
    doc(db, 'conversations', id),
    (snap) => onChange(snap.exists() ? toConversation(snap.id, snap.data()) : null),
    onError,
  )
}

export function subscribeMessages(convId: string, onChange: (m: Message[]) => void, onError: (e: Error) => void) {
  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('sentAt', 'asc'), limit(500))
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) =>
    onChange(
      snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' })
        return {
          id: d.id,
          senderId: data.senderId,
          text: data.text,
          sentAt: toDate(data.sentAt),
          type: data.type ?? 'text',
          pending: d.metadata.hasPendingWrites,
        }
      }),
    ),
    onError,
  )
}

// The seeker's existing thread for a listing, if there is one.
export async function findMyConversation(listingId: string, uid: string) {
  try {
    const snap = await getDoc(doc(db, 'conversations', conversationId(listingId, uid)))
    return snap.exists() ? snap.id : null
  } catch {
    return null // not readable means it doesn't exist (or isn't mine)
  }
}

// ---- Writes ----

// Starts a thread from the Say hi sheet: the conversation and its first
// message go in one batch, so there's never an empty thread.
export async function startConversation(listing: Listing, seeker: User, text: string) {
  const id = conversationId(listing.id, seeker.uid)
  const profile = await fetchProfile(seeker.uid)
  const convRef = doc(db, 'conversations', id)
  const msgRef = doc(collection(convRef, 'messages'))
  const clean = text.trim().slice(0, MESSAGE_MAX)
  const batch = writeBatch(db)
  batch.set(convRef, {
    listingId: listing.id,
    listerId: listing.ownerId,
    seekerId: seeker.uid,
    participantIds: [listing.ownerId, seeker.uid],
    listingTitle: listing.title,
    listingThumbUrl: listing.photos[0]?.thumbUrl ?? null,
    listingRentCents: listing.rentCents,
    listingFrom: Timestamp.fromDate(new Date(`${listing.availableFrom}T00:00:00Z`)),
    listingTo: Timestamp.fromDate(new Date(`${listing.availableTo}T00:00:00Z`)),
    listerFirstName: listing.lister.firstName,
    listerPhotoUrl: listing.lister.photoUrl ?? null,
    seekerFirstName: profile?.firstName || seeker.displayName || 'A Ram',
    seekerPhotoUrl: profile?.photoUrl ?? seeker.photoURL ?? null,
    lastMessage: { text: clean, senderId: seeker.uid, sentAt: serverTimestamp() },
    unreadCount: { [listing.ownerId]: 1, [seeker.uid]: 0 },
    lastReadAt: { [seeker.uid]: serverTimestamp() },
    closedReason: null,
    blockedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(msgRef, { senderId: seeker.uid, text: clean, sentAt: serverTimestamp(), type: 'text' })
  await batch.commit()
  return id
}

export async function sendMessage(c: Conversation, me: string, text: string, type: 'text' | 'address' = 'text') {
  const clean = text.trim().slice(0, MESSAGE_MAX)
  if (!clean) return
  const other = otherPerson(c, me).id
  const convRef = doc(db, 'conversations', c.id)
  const batch = writeBatch(db)
  batch.set(doc(collection(convRef, 'messages')), { senderId: me, text: clean, sentAt: serverTimestamp(), type })
  batch.update(convRef, {
    lastMessage: { text: type === 'address' ? 'Shared the address' : clean, senderId: me, sentAt: serverTimestamp() },
    [`unreadCount.${other}`]: increment(1),
    [`unreadCount.${me}`]: 0,
    [`lastReadAt.${me}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export function formatAddress(loc: PrivateLocation) {
  return [loc.streetAddress, loc.unit].filter(Boolean).join(', ')
}

export async function markRead(c: Conversation, me: string) {
  if (!c.unreadCount[me] && c.lastReadAt[me] && c.lastMessage.sentAt && c.lastReadAt[me]! >= c.lastMessage.sentAt) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'conversations', c.id), {
    [`unreadCount.${me}`]: 0,
    [`lastReadAt.${me}`]: serverTimestamp(),
  })
  await batch.commit()
}

export async function blockPerson(c: Conversation, me: string) {
  const other = otherPerson(c, me).id
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', me, 'blocks', other), { createdAt: serverTimestamp() })
  batch.update(doc(db, 'conversations', c.id), { blockedBy: me })
  await batch.commit()
}

// Closes every open thread on a listing and posts the system line in each.
// Called by the lister right after marking it filled or taking it down.
export async function closeThreadsForListing(listingId: string, listerId: string, listerName: string, reason: 'filled' | 'expired') {
  const snap = await getDocs(
    query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', listerId),
      where('listingId', '==', listingId),
    ),
  )
  const open = snap.docs.filter((d) => !d.data().closedReason && !d.data().blockedBy)
  const text = reason === 'filled' ? `${listerName} marked this place as filled.` : 'This listing was taken down.'
  // A batch holds 500 writes; each thread is 2.
  for (let i = 0; i < open.length; i += 200) {
    const batch = writeBatch(db)
    for (const d of open.slice(i, i + 200)) {
      batch.update(d.ref, { closedReason: reason })
      batch.set(doc(collection(d.ref, 'messages')), { senderId: listerId, text, sentAt: serverTimestamp(), type: 'system' })
    }
    await batch.commit()
  }
}

// ---- Safety ----

// The recipient sees a heads-up under messages that mention moving money.
const MONEY_WORDS = /\b(venmo|zelle|cash\s?app|paypal|wire|wired|gift\s?cards?|deposit|western union|crypto|bitcoin)\b/i

export function mentionsMoney(text: string) {
  return MONEY_WORDS.test(text)
}
