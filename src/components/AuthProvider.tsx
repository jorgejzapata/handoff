import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { isVerifiedCsu } from '../lib/auth'
import { fetchProfile, markVerified } from '../lib/users'

// What the student was doing when the sign-up sheet opened, so Verify can
// put them right back there. Kept in localStorage so it survives the trip to
// Outlook and back, even in a new tab.
export interface PendingAction {
  reason: 'say-hi' | 'save' | 'publish' | 'messages' | 'login'
  returnTo: string
  listerName?: string
  listingId?: string // publish: the draft to put live; say-hi: the listing
  message?: string // say-hi: the first message, sent once verified
}

const PENDING_KEY = 'handoff:pending-action'

export function savePending(p: PendingAction) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}

export function readPending(): PendingAction | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingAction) : null
  } catch {
    return null
  }
}

export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* storage unavailable */
  }
}

interface AuthState {
  // A real (signed-up) account. Anonymous draft accounts count as signed out.
  user: User | null
  // Any account, anonymous included. Drafts and photo uploads use this.
  rawUser: User | null
  loading: boolean
  verified: boolean
  refresh: () => Promise<boolean>
  // Profile photo for the nav bar and Me. Profile setup calls setPhotoUrl after
  // an upload so it shows right away.
  photoUrl?: string
  setPhotoUrl: (url: string | undefined) => void
}

const AuthContext = createContext<AuthState>({
  user: null,
  rawUser: null,
  loading: true,
  verified: false,
  refresh: async () => false,
  setPhotoUrl: () => {},
})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [loading, setLoading] = useState(true)
  const [, setVersion] = useState(0)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const uid = user && !user.isAnonymous ? user.uid : null

  const verifiedNow = isVerifiedCsu(user)
  useEffect(() => {
    // Give the Verify screen a moment to record why they signed up first.
    if (!uid || !verifiedNow) return
    const t = setTimeout(() => void markVerified(uid, readPending()?.reason), 4000)
    return () => clearTimeout(t)
  }, [uid, verifiedNow])

  // The auth profile usually has the photo; fall back to the users doc.
  useEffect(() => {
    const u = auth.currentUser
    if (!uid || !u) return setPhotoUrl(undefined)
    if (u.photoURL) return setPhotoUrl(u.photoURL)
    let live = true
    fetchProfile(uid).then((p) => live && setPhotoUrl(p?.photoUrl || undefined))
    return () => {
      live = false
    }
  }, [uid])

  useEffect(
    () =>
      onIdTokenChanged(auth, (u) => {
        setUser(u)
        setVersion((v) => v + 1)
        setLoading(false)
      }),
    [],
  )

  // Reloads the user from Firebase. Once the email is verified, it also
  // refreshes the ID token so security rules see email_verified = true.
  const refresh = useCallback(async () => {
    const u = auth.currentUser
    if (!u) return false
    await u.reload()
    if (u.emailVerified) await u.getIdToken(true)
    setVersion((v) => v + 1)
    return u.emailVerified
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user: user && !user.isAnonymous ? user : null,
        rawUser: user,
        loading,
        verified: isVerifiedCsu(user),
        refresh,
        photoUrl,
        setPhotoUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
