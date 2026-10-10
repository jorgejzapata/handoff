import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { captureAnonDraft, restoreDraft } from './draftCarry'

// CSU is the only school at launch. Both domains count: colostate.edu for
// NetID addresses and rams.colostate.edu for student accounts.
export const CSU_DOMAINS = ['colostate.edu', 'rams.colostate.edu']

export function isCsuEmail(email: string | null | undefined) {
  if (!email) return false
  const domain = email.trim().toLowerCase().split('@')[1]
  return CSU_DOMAINS.includes(domain)
}

export function isVerifiedCsu(user: User | null) {
  return !!user && user.emailVerified && isCsuEmail(user.email)
}

// Where the verification link sends people after Firebase confirms the email.
function verifyContinueUrl() {
  return { url: `${window.location.origin}/verified` }
}

export async function sendVerification(user: User) {
  await sendEmailVerification(user, verifyContinueUrl())
}

async function ensureUserDoc(user: User, firstName: string) {
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  if (existing.exists()) return
  await setDoc(ref, {
    firstName,
    email: user.email,
    schoolId: 'csu',
    onboardingStep: 'profile',
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  })
}

// Drafts are saved under an anonymous account before signup. Signing up
// upgrades that same account, so the draft and its photos carry over as-is.
export async function ensureAnonymous() {
  if (auth.currentUser) return auth.currentUser
  const { user } = await signInAnonymously(auth)
  return user
}

export async function signUpWithEmail(firstName: string, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase()
  if (!isCsuEmail(cleanEmail)) throw new AuthMessage('not-csu')
  const current = auth.currentUser
  const { user } = current?.isAnonymous
    ? await linkWithCredential(current, EmailAuthProvider.credential(cleanEmail, password))
    : await createUserWithEmailAndPassword(auth, cleanEmail, password)
  await updateProfile(user, { displayName: firstName.trim() })
  await user.getIdToken(true) // so rules see the new email
  await sendVerification(user)
  // The profile doc is retried on next sign-in if this fails, so it never blocks signup.
  await ensureUserDoc(user, firstName.trim()).catch((e) => console.error('[handoff] users doc', e))
  return user
}

// Logging in to an existing account leaves the anonymous one behind, so the
// draft's details are copied over (photos need re-adding).
export async function logInWithEmail(email: string, password: string) {
  const carry = await captureAnonDraft()
  const { user } = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  await restoreDraft(carry, user.uid)
  await ensureUserDoc(user, user.displayName ?? 'Ram').catch((e) => console.error('[handoff] users doc', e))
  return user
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export function logOut() {
  return signOut(auth)
}

// ---- Errors, in Handoff's voice ----

type MessageCode = 'not-csu' | 'google-not-csu'

export class AuthMessage extends Error {
  constructor(public code: MessageCode) {
    super(code)
  }
}

export interface FriendlyError {
  message: string
  field?: 'email' | 'password' | 'name'
  action?: 'login'
}

export function friendlyError(err: unknown): FriendlyError | null {
  if (err instanceof AuthMessage) {
    if (err.code === 'not-csu')
      return { message: 'Handoff is just for CSU students right now. Use your @colostate.edu email.', field: 'email' }
    return { message: "That Google account isn't a CSU one. Sign up with your CSU email instead." }
  }
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/email-already-in-use':
      case 'auth/credential-already-in-use':
        return { message: 'You already have an account.', field: 'email', action: 'login' }
      case 'auth/invalid-email':
        return { message: "That email doesn't look right.", field: 'email' }
      case 'auth/weak-password':
        return { message: 'Use at least 8 characters.', field: 'password' }
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return { message: "That email and password don't match." }
      case 'auth/too-many-requests':
        return { message: 'Too many tries. Wait a minute, then try again.' }
      case 'auth/network-request-failed':
        return { message: "You're offline. Check your connection and try again." }
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return null
      case 'auth/popup-blocked':
        return { message: 'Your browser blocked the Google window. Allow pop-ups and try again.' }
      case 'auth/operation-not-allowed':
        return { message: "That sign-in method isn't turned on yet." }
    }
  }
  console.error(err)
  return { message: 'Something broke on our end. Try again in a minute.' }
}
