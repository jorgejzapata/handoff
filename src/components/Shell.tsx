import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { Heart, MessageCircle, Plus, Search, User } from 'lucide-react'
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

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Handoff home">
        <Mark />
        <span className="wordmark">handoff</span>
      </Link>
      <nav className="topbar-links" aria-label="Main">
        <NavLink to="/listings">Browse</NavLink>
        <NavLink to="/saved">Saved</NavLink>
        <NavLink to="/messages">Messages</NavLink>
      </nav>
      <div className="topbar-right">
        {right}
        <Link to="/post" className="btn btn-primary btn-sm desktop-only">
          Post your place
        </Link>
      </div>
    </header>
  )
}

const ICON = { size: 22, strokeWidth: 1.5 } as const

export function BottomNav() {
  const { open } = useSignUp()
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/listings" className="nav-item">
        <span className="nav-pill">
          <Search {...ICON} />
        </span>
        Browse
      </NavLink>
      <button type="button" className="nav-item" onClick={() => open({ reason: 'save' })}>
        <span className="nav-pill">
          <Heart {...ICON} />
        </span>
        Saved
      </button>
      <Link to="/post" className="nav-post" aria-label="Post your place">
        <Plus size={24} strokeWidth={2} />
      </Link>
      <button type="button" className="nav-item" onClick={() => open({ reason: 'messages' })}>
        <span className="nav-pill">
          <MessageCircle {...ICON} />
        </span>
        Messages
      </button>
      <button type="button" className="nav-item" onClick={() => open({ reason: 'login' })}>
        <span className="nav-pill">
          <User {...ICON} />
        </span>
        Log in
      </button>
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
      <p className="caption muted">Made at CSU</p>
    </footer>
  )
}
