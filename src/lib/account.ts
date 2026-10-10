import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { deleteAllSaved } from './saved'
import { db, storage } from './firebase'
import { deleteListing, fetchMyListings } from './listings'
import { closeThreadsForListing } from './messages'
import { deleteListingPhoto } from './photos'
import { setDraftPointer } from './draftCarry'

export function usesPassword(user: User) {
  return user.providerData.some((p) => p.providerId === 'password')
}

// Sensitive actions need a recent sign-in: password for email accounts,
// the Google popup for Google accounts.
export async function reauthenticate(user: User, password?: string) {
  if (usesPassword(user)) {
    if (!password || !user.email) throw new Error('password-required')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider())
  }
}

export async function changePassword(user: User, current: string, next: string) {
  await reauthenticate(user, current)
  await updatePassword(user, next)
}

// ---- Blocked people ----

export interface BlockedPerson {
  uid: string
  firstName: string
}

export async function fetchBlocked(uid: string): Promise<BlockedPerson[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'blocks'))
  return snap.docs.map((d) => ({ uid: d.id, firstName: (d.data().firstName as string) || 'A Ram' }))
}

// Lets them message again. Threads I closed by blocking them reopen too.
export async function unblock(me: string, other: string) {
  const threads = await getDocs(query(collection(db, 'conversations'), where('participantIds', 'array-contains', me)))
  const batch = writeBatch(db)
  for (const d of threads.docs) {
    const c = d.data()
    if (c.participantIds?.includes(other) && c.blockedBy === me) batch.update(d.ref, { blockedBy: null })
  }
  batch.delete(doc(db, 'users', me, 'blocks', other))
  await batch.commit()
}

// ---- Delete account ----
// Runs in the browser (no Cloud Functions yet), in an order that stays safe if
// it stops partway: listings come down first, then chats, then the profile,
// and the login itself goes last.
export async function deleteAccount(user: User, onStep?: (label: string) => void) {
  const uid = user.uid
  const name = user.displayName || 'The lister'

  onStep?.('Taking down your listings')
  for (const l of await fetchMyListings(uid)) {
    if (l.status === 'hidden' || l.status === 'removed') continue // stays for moderation
    if (l.status !== 'draft') await closeThreadsForListing(l.id, uid, name, 'expired').catch(() => {})
    await deleteListing(l)
    await Promise.all(l.photos.map((p) => deleteListingPhoto(p)))
  }
  setDraftPointer(null)

  onStep?.('Closing your chats')
  const threads = await getDocs(query(collection(db, 'conversations'), where('participantIds', 'array-contains', uid)))
  for (let i = 0; i < threads.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of threads.docs.slice(i, i + 400)) {
      const c = d.data()
      const asLister = c.listerId === uid
      batch.update(d.ref, {
        [asLister ? 'listerFirstName' : 'seekerFirstName']: 'Former member',
        [asLister ? 'listerPhotoUrl' : 'seekerPhotoUrl']: null,
        blockedBy: c.blockedBy ?? uid,
      })
    }
    await batch.commit()
  }

  onStep?.('Removing your profile')
  await deleteAllSaved(uid).catch((e) => console.error('[handoff] delete saved', e))
  const blocks = await getDocs(collection(db, 'users', uid, 'blocks'))
  await Promise.all(blocks.docs.map((d) => deleteDoc(d.ref)))
  await deleteObject(ref(storage, `avatars/${uid}.jpg`)).catch(() => {})
  await deleteDoc(doc(db, 'users', uid)).catch(() => {})

  onStep?.('Deleting your login')
  await deleteUser(user)
}
