import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { Heart, MessageCircle, Plus, Search, User } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { useInbox } from './InboxProvider'
import { useSignUp } from './SignUpSheet'

export function Mark({ size = 28 }: { size?: number }) {
  // Pillars follow ink, so the mark flips to the cream "reverse" version in dark mode.
  return (
    <svg viewBox="0 0 96 80" width={(size * 96) / 80} height={size} aria-hidden="true">
      <rect x="12" y="8" width="20" height="64" rx="10" fill="var(--ink)" />
      <rect x="50" y="8" width="20" height="64" rx="10" fill="var(--ink)" />
      <rect x="12" y="30" width="78" height="20" rx="10" fill="var(--lime-300)" />
    </svg>
  )
}

// The student's photo, or their first initial. Falls back to the initial if
// the image fails to load.
function NavAvatar({ name, photoUrl, className }: { name: string; photoUrl?: string; className: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [photoUrl])
  if (photoUrl && !broken)
    return <img src={photoUrl} alt="" className={`${className} avatar-img`} onError={() => setBroken(true)} />
  return (
    <span className={className} aria-hidden="true">
      {name[0]?.toUpperCase()}
    </span>
  )
}

export function TopBar() {
  const { user, loading, photoUrl } = useAuth()
  const { unreadTotal } = useInbox()
  const { open } = useSignUp()
  const name = user?.displayName || 'Me'
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Handoff home">
        <Mark />
        <span className="wordmark">handoff</span>
      </Link>
      <nav className="topbar-links" aria-label="Main">
        <NavLink to="/listings">Browse</NavLink>
        <NavLink to="/saved">Saved</NavLink>
        <NavLink to="/messages">
          Messages
          {unreadTotal > 0 && <span className="nav-badge nav-badge-inline">{unreadTotal > 9 ? '9+' : unreadTotal}</span>}
        </NavLink>
      </nav>
      <div className="topbar-right desktop-only">
        {!loading &&
          (user ? (
            <Link to="/me" className="topbar-avatar" aria-label={`${name}, your account`}>
              <NavAvatar name={name} photoUrl={photoUrl} className="avatar avatar-sm" />
            </Link>
          ) : (
            <button type="button" className="text-link" onClick={() => open({ reason: 'login' })}>
              Log in
            </button>
          ))}
        <Link to="/post" className="btn btn-primary btn-sm">
          Post your place
        </Link>
      </div>
    </header>
  )
}

const ICON = { size: 22, strokeWidth: 1.5 } as const

// Signed out, Saved, Messages and Me open the sign-up sheet.
function NavTab({
  to,
  icon,
  label,
  gate,
  badge = 0,
  round = false,
}: {
  to: string
  icon: ReactNode
  label: string
  gate?: () => void
  badge?: number
  // A round icon (the profile photo) shows active with a ring, not the pill.
  round?: boolean
}) {
  const pill = (
    <span className={round ? 'nav-pill nav-pill-round' : 'nav-pill'}>
      {icon}
      {badge > 0 && (
        <span className="nav-badge" aria-label={`${badge} unread`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </span>
  )
  if (gate) {
    return (
      <button type="button" className="nav-item" onClick={gate}>
        {pill}
        {label}
      </button>
    )
  }
  return (
    <NavLink to={to} className="nav-item">
      {pill}
      {label}
    </NavLink>
  )
}

export function BottomNav() {
  const { user, member, photoUrl } = useAuth()
  const { unreadTotal } = useInbox()
  const { open } = useSignUp()
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavTab to="/listings" icon={<Search {...ICON} />} label="Browse" />
      <NavTab to="/saved" icon={<Heart {...ICON} />} label="Saved" gate={member ? undefined : () => open({ reason: 'save' })} />
      <Link to="/post" className="nav-post" aria-label="Post your place">
        <Plus size={24} strokeWidth={2} />
      </Link>
      <NavTab
        to="/messages"
        icon={<MessageCircle {...ICON} />}
        label="Messages"
        badge={unreadTotal}
        gate={member ? undefined : () => open({ reason: 'messages' })}
      />
      <NavTab
        to="/me"
        icon={
          user ? (
            <NavAvatar name={user.displayName || 'Me'} photoUrl={photoUrl} className="avatar nav-avatar" />
          ) : (
            <User {...ICON} />
          )
        }
        label={user ? 'Me' : 'Log in'}
        round={!!user}
        gate={user ? undefined : () => open({ reason: 'login' })}
      />
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-links">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/safety">Safety</Link>
        <Link to="/support">Contact</Link>
      </div>
      <p className="caption muted">Made by students</p>
    </footer>
  )
}
