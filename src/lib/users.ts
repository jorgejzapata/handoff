import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface Profile {
  firstName: string
  photoUrl?: string
  gradYear?: string
  bio?: string
  onboardingStep?: string
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

export async function saveProfile(uid: string, changes: Partial<Profile>) {
  await updateDoc(doc(db, 'users', uid), { ...changes, lastActiveAt: serverTimestamp() })
}
