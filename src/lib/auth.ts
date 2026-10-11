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
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions, usingEmulators } from './firebase'
import { MARKET_ID } from '../config'
import { captureAnonDraft, restoreDraft } from './draftCarry'

// Who can join: students with a school email. Any address whose domain ends
// in one of these counts (so name@school.edu and name@mail.school.edu both
// work). Keep this in sync with isStudentEmail() in firestore.rules.
export const STUDENT_EMAIL_SUFFIXES = ['.edu']

export function isStudentEmail(email: string | null | undefined) {
  if (!email) return false
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && STUDENT_EMAIL_SUFFIXES.some((s) => domain.endsWith(s))
}

export function isVerifiedStudent(user: User | null) {
  return !!user && user.emailVerified && isStudentEmail(user.email)
}

// Where the verification link sends people after Firebase confirms the email.
function verifyContinueUrl() {
  return { url: `${window.location.origin}/verified` }
}

// Verification emails go out through Resend from handoffsublease.com (the
// sendVerificationEmail function). If that fails for any reason other than
// too many tries, Firebase's built-in email is the backup. On the local
// emulators no real email is sent; the link shows in the emulator UI.
export async function sendVerification(user: User) {
  if (usingEmulators) return sendEmailVerification(user, verifyContinueUrl())
  try {
    await httpsCallable(functions, 'sendVerificationEmail')()
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'functions/resource-exhausted') {
      throw new FirebaseError('auth/too-many-requests', err.message)
    }
    console.error('[handoff] verification email via Resend failed, using Firebase', err)
    await sendEmailVerification(user, verifyContinueUrl())
  }
}

async function ensureUserDoc(user: User, firstName: string) {
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  if (existing.exists()) return
  await setDoc(ref, {
    firstName,
    email: user.email,
    schoolId: MARKET_ID,
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
  if (!isStudentEmail(cleanEmail)) throw new AuthMessage('not-student')
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
  await ensureUserDoc(user, user.displayName ?? 'Student').catch((e) => console.error('[handoff] users doc', e))
  return user
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export function logOut() {
  return signOut(auth)
}

// ---- Errors, in Handoff's voice ----

type MessageCode = 'not-student'

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
    return { message: 'Handoff is for students right now. Use your school email (it ends in .edu).', field: 'email' }
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
