import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import { isPastExpiry, snapshotToListing } from './listings'
import type { Listing } from './listings'

// ---- Who's an admin ----
// An admins/{uid} doc added in the Firebase console, or an admin custom claim.
export async function checkIsAdmin(user: User | null) {
  if (!user) return false
  const token = await user.getIdTokenResult()
  if (token.claims.admin === true) return true
  try {
    return (await getDoc(doc(db, 'admins', user.uid))).exists()
  } catch {
    return false
  }
}

// ---- Data ----

export interface AdminUser {
  uid: string
  firstName: string
  email: string
  createdAt: Date | null
  photoUrl?: string
  birthYear?: number
  gender?: string
  studentVerified: boolean // confirmed a school email (verifiedAt set)
}

export interface AdminReport {
  id: string
  reporterId: string
  targetType: 'listing' | 'user' | 'message'
  targetId: string
  reason: string
  details: string
  status: 'open' | 'actioned' | 'dismissed'
  createdAt: Date | null
  adminNote?: string
}

export interface Suspension {
  uid: string
  reason: string
  at: Date | null
}

const toDate = (t: unknown) => (t instanceof Timestamp ? t.toDate() : null)

export async function fetchAdminData() {
  const [listingsSnap, usersSnap, reportsSnap, suspSnap] = await Promise.all([
    getDocs(query(collection(db, 'listings'), limit(2000))),
    getDocs(query(collection(db, 'users'), limit(5000))),
    getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(500))),
    getDocs(collection(db, 'suspensions')),
  ])
  const listings = listingsSnap.docs.map(snapshotToListing).filter((l): l is Listing => !!l)
  const users: AdminUser[] = usersSnap.docs.map((d) => ({
    uid: d.id,
    firstName: d.data().firstName ?? '',
    email: d.data().email ?? '',
    createdAt: toDate(d.data().createdAt),
    photoUrl: d.data().photoUrl,
    birthYear: typeof d.data().birthYear === 'number' ? d.data().birthYear : undefined,
    gender: d.data().gender,
    studentVerified: !!d.data().verifiedAt,
  }))
  const reports: AdminReport[] = reportsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminReport, 'id' | 'createdAt'>),
    createdAt: toDate(d.data().createdAt),
  }))
  const suspensions: Suspension[] = suspSnap.docs.map((d) => ({ uid: d.id, reason: d.data().reason, at: toDate(d.data().at) }))
  // Internal accounts (Jorge and test accounts). Read on its own so admin
  // still loads if the rules for it aren't deployed yet.
  const internal = await getDocs(collection(db, 'internal'))
    .then((snap) => new Set(snap.docs.map((d) => d.id)))
    .catch(() => new Set<string>())
  return { listings, users, reports, suspensions, internal }
}

export async function fetchViews7d() {
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  try {
    const snap = await getCountFromServer(query(collectionGroup(db, 'views'), where('day', '>=', since)))
    return snap.data().count
  } catch (e) {
    console.error('[handoff] views count', e)
    return null
  }
}

// Marks an account as internal, so its listings never count toward the free
// spots or the boost gate (functions/src/stats.ts recounts right away).
export async function setInternal(adminId: string, uid: string, on: boolean) {
  const ref = doc(db, 'internal', uid)
  if (on) await setDoc(ref, { by: adminId, at: serverTimestamp() })
  else await deleteDoc(ref)
}

// ---- Metrics for the phase triggers in the monetization brief ----

export const GOALS = { activeListings: 50, filledPct: 30, boostConversionPct: 5, boostGate: 25, freeListings: 50 }

const DAY = 24 * 60 * 60 * 1000

export function computeMetrics(listings: Listing[], users: AdminUser[], reports: AdminReport[]) {
  const now = Date.now()
  const weekAgo = now - 7 * DAY
  const twoWeeksAgo = now - 14 * DAY
  const active = listings.filter((l) => l.status === 'active' && !isPastExpiry(l))
  const published = listings.filter((l) => !!l.postedAt)
  const filled = listings.filter((l) => l.status === 'filled')
  const filledVia = filled.filter((l) => l.filledViaHandoff)
  const inWeek = (iso: string | undefined, from: number, to: number) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= from && t < to
  }

  // Last 30 days, oldest first.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * DAY)
    return d.toISOString().slice(0, 10)
  })
  const countBy = (isos: (string | undefined)[]) => {
    const m = new Map<string, number>()
    for (const iso of isos) if (iso) m.set(iso.slice(0, 10), (m.get(iso.slice(0, 10)) ?? 0) + 1)
    return days.map((day) => ({ day, count: m.get(day) ?? 0 }))
  }

  return {
    activeListings: active.length,
    newListingsThisWeek: published.filter((l) => inWeek(l.postedAt, weekAgo, now)).length,
    newListingsLastWeek: published.filter((l) => inWeek(l.postedAt, twoWeeksAgo, weekAgo)).length,
    published: published.length,
    filled: filled.length,
    filledPct: published.length ? Math.round((filled.length / published.length) * 100) : 0,
    filledViaPct: filled.length ? Math.round((filledVia.length / filled.length) * 100) : 0,
    drafts: listings.filter((l) => l.status === 'draft').length,
    students: users.length,
    newStudentsThisWeek: users.filter((u) => u.createdAt && u.createdAt.getTime() >= weekAgo).length,
    reportsThisWeek: reports.filter((r) => r.createdAt && r.createdAt.getTime() >= weekAgo).length,
    reportsLastWeek: reports.filter((r) => r.createdAt && r.createdAt.getTime() >= twoWeeksAgo && r.createdAt.getTime() < weekAgo).length,
    openReports: reports.filter((r) => r.status === 'open').length,
    newListingsByDay: countBy(published.map((l) => l.postedAt)),
    fillsByDay: countBy(filled.map((l) => l.filledAt)),
  }
}

// ---- Who's signing up (age and gender, in aggregate) ----

export const AGE_BANDS = ['18–20', '21–22', '23–25', '26–34', '35+'] as const
const GENDER_LABELS: Record<string, string> = { woman: 'Women', man: 'Men', nonbinary: 'Non-binary', self: 'Self-described' }

export function computeDemographics(users: AdminUser[], now = new Date()) {
  const ageBand = (birthYear?: number) => {
    if (!birthYear) return 'Not given'
    const age = now.getFullYear() - birthYear
    if (age <= 20) return '18–20'
    if (age <= 22) return '21–22'
    if (age <= 25) return '23–25'
    if (age <= 34) return '26–34'
    return '35+'
  }
  const tally = (keys: string[], order: string[]) => {
    const m = new Map<string, number>()
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
    return order.map((label) => ({ label, count: m.get(label) ?? 0 })).filter((r) => r.count > 0 || r.label !== 'Not given')
  }
  return {
    total: users.length,
    verifiedStudents: users.filter((u) => u.studentVerified).length,
    ages: tally(users.map((u) => ageBand(u.birthYear)), [...AGE_BANDS, 'Not given']),
    genders: tally(
      users.map((u) => (u.gender ? GENDER_LABELS[u.gender] ?? 'Self-described' : 'Not given')),
      [...Object.values(GENDER_LABELS), 'Not given'],
    ),
  }
}

// ---- Actions (each one is logged with who, when and why) ----

type LogAction = 'hide' | 'unhide' | 'remove' | 'suspend' | 'unsuspend' | 'dismiss' | 'resolve'

function log(batch: ReturnType<typeof writeBatch>, adminId: string, action: LogAction, targetType: 'listing' | 'user' | 'report', targetId: string, reason: string) {
  batch.set(doc(collection(db, 'adminActions')), { adminId, action, targetType, targetId, reason, at: serverTimestamp() })
}

function moderate(batch: ReturnType<typeof writeBatch>, adminId: string, listingId: string, status: 'hidden' | 'removed' | 'active', reason: string) {
  batch.update(doc(db, 'listings', listingId), {
    status,
    updatedAt: serverTimestamp(),
    moderatedBy: adminId,
    moderatedAt: serverTimestamp(),
    moderationReason: reason,
  })
}

function resolveReports(batch: ReturnType<typeof writeBatch>, adminId: string, reportIds: string[], note: string) {
  for (const id of reportIds) {
    batch.update(doc(db, 'reports', id), { status: 'actioned', reviewedBy: adminId, reviewedAt: serverTimestamp(), adminNote: note })
  }
}

export async function setListingStatus(adminId: string, listingId: string, status: 'hidden' | 'removed' | 'active', reason: string, reportIds: string[] = []) {
  const batch = writeBatch(db)
  moderate(batch, adminId, listingId, status, reason)
  log(batch, adminId, status === 'hidden' ? 'hide' : status === 'removed' ? 'remove' : 'unhide', 'listing', listingId, reason)
  resolveReports(batch, adminId, reportIds, reason)
  await batch.commit()
}

// Suspends the student and hides their live listings.
export async function suspendUser(adminId: string, uid: string, reason: string, liveListingIds: string[], reportIds: string[] = []) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'suspensions', uid), { reason, by: adminId, at: serverTimestamp() })
  for (const id of liveListingIds) moderate(batch, adminId, id, 'hidden', `Account suspended: ${reason}`)
  log(batch, adminId, 'suspend', 'user', uid, reason)
  resolveReports(batch, adminId, reportIds, reason)
  await batch.commit()
}

// Lifts the suspension. Hidden listings stay hidden until restored one by one.
export async function unsuspendUser(adminId: string, uid: string, reason: string) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'suspensions', uid))
  log(batch, adminId, 'unsuspend', 'user', uid, reason)
  await batch.commit()
}

export async function dismissReports(adminId: string, reportIds: string[], reason: string) {
  const batch = writeBatch(db)
  for (const id of reportIds) {
    batch.update(doc(db, 'reports', id), { status: 'dismissed', reviewedBy: adminId, reviewedAt: serverTimestamp(), adminNote: reason })
    log(batch, adminId, 'dismiss', 'report', id, reason)
  }
  await batch.commit()
}
