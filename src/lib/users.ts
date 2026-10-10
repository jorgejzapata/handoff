import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export interface Profile {
  firstName: string
  photoUrl?: string
  gradYear?: string
  bio?: string
  gender?: 'woman' | 'man' | 'nonbinary' | 'self'
  genderSelfDescribe?: string
  onboardingStep?: string
  notificationPrefs?: { email?: boolean }
  verifiedAt?: Timestamp
  signupReason?: string
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

// Marks the moment a student verified their school email, once. The welcome
// email goes out from the server when this appears. `reason` is what they
// were doing when they signed up (say hi, publish, save), so the email can
// pick up where they left off.
const marked = new Set<string>()
export async function markVerified(uid: string, reason?: string) {
  if (marked.has(uid)) return
  marked.add(uid)
  try {
    const p = await fetchProfile(uid)
    if (!p || p.verifiedAt) return
    await updateDoc(doc(db, 'users', uid), {
      verifiedAt: serverTimestamp(),
      ...(reason && ['say-hi', 'publish', 'save', 'messages', 'login'].includes(reason) ? { signupReason: reason } : {}),
    })
  } catch (e) {
    marked.delete(uid)
    console.error('[handoff] mark verified', e)
  }
}
