import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { updateListerOnListings } from './listings'

export interface Profile {
  firstName: string
  photoUrl?: string
  gradYear?: string
  bio?: string
  gender?: 'woman' | 'man' | 'nonbinary' | 'self'
  genderSelfDescribe?: string
  onboardingStep?: string
  notificationPrefs?: { email?: boolean }
  verifiedAt?: Timestamp // when they confirmed a school email (student perks)
  signupReason?: string
  birthYear?: number
}

export const YEARS = ['First-year', 'Sophomore', 'Junior', 'Senior', 'Grad']

export async function fetchProfile(uid: string): Promise<Profile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return (snap.data() as Profile | undefined) ?? null
  } catch {
    return null
  }
}

// Pass deleteField() to clear a field.
export async function saveProfile(uid: string, changes: Partial<Record<keyof Profile, unknown>>) {
  await updateDoc(doc(db, 'users', uid), { ...changes, lastActiveAt: serverTimestamp() })
}

// Marks, once, the moment someone confirmed a school email. Student perks
// (like the boost discount) key off verifiedAt, and their live listings pick
// up the "Verified student" badge.
const marked = new Set<string>()
export async function markVerified(uid: string) {
  if (marked.has(uid)) return
  marked.add(uid)
  try {
    const p = await fetchProfile(uid)
    if (!p || p.verifiedAt) return
    await updateDoc(doc(db, 'users', uid), { verifiedAt: serverTimestamp() })
    await updateListerOnListings(uid, { verified: true }).catch(() => {})
  } catch (e) {
    marked.delete(uid)
    console.error('[handoff] mark verified', e)
  }
}
