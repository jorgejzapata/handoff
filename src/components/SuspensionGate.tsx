import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logOut } from '../lib/auth'
import { useAuth } from './AuthProvider'
import { SUPPORT_EMAIL } from '../config'

// A suspended student sees this instead of the app. The rules already block
// them from posting, messaging and reporting; this tells them why.
const ALWAYS_OPEN = ['/terms', '/privacy', '/safety', '/support', '/delete-account']

export function SuspensionGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [suspended, setSuspended] = useState(false)

  useEffect(() => {
    setSuspended(false)
    if (!user) return
    getDoc(doc(db, 'suspensions', user.uid))
      .then((snap) => setSuspended(snap.exists()))
      .catch(() => setSuspended(false))
  }, [user])

  if (!suspended || ALWAYS_OPEN.includes(location.pathname)) return <>{children}</>

  return (
    <div className="page empty suspended-page">
      <p className="heading">Your account is paused while we review a report.</p>
      <p className="muted">
        You can't post, message or report until the review is done.
        {SUPPORT_EMAIL && (
          <>
            {' '}
            Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </>
        )}
      </p>
      <button type="button" className="btn btn-secondary" onClick={() => void logOut()}>
        Log out
      </button>
    </div>
  )
}
