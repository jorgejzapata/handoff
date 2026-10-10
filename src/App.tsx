import { Link, Outlet, Route, Routes } from 'react-router'
import { Construction } from 'lucide-react'
import { BottomNav, TopBar } from './components/Shell'
import { SignUpProvider } from './components/SignUpSheet'
import { AuthProvider } from './components/AuthProvider'
import { ToastProvider } from './components/Toast'
import { InboxProvider } from './components/InboxProvider'
import { useAuth } from './components/AuthProvider'
import { useSignUp } from './components/SignUpSheet'
import Messages from './screens/messages/Messages'
import Home from './screens/Home'
import Browse from './screens/Browse'
import ListingDetail from './screens/ListingDetail'
import PostListing from './screens/post/PostListing'
import PostLive from './screens/post/PostLive'
import ProfileSetup from './screens/ProfileSetup'
import Verify, { Verified } from './screens/Verify'
import Me from './screens/Me'
import { usingEmulators } from './lib/firebase'

if (usingEmulators) console.info('[handoff] Firebase is using the local emulators')

// Screens with the full shell: top bar plus the mobile bottom nav.
function WithNav() {
  return (
    <>
      <TopBar />
      <main className="shell-main">
        <Outlet />
      </main>
      <BottomNav />
    </>
  )
}

// Focused screens: top bar only, no bottom nav.
function TopBarOnly() {
  return (
    <>
      <TopBar />
      <main>
        <Outlet />
      </main>
    </>
  )
}

// Screens with their own bottom bar (listing detail) keep the top bar on desktop only.
function NoBottomNav() {
  return (
    <>
      <div className="desktop-only">
        <TopBar />
      </div>
      <Outlet />
    </>
  )
}

// Messages need a verified CSU account.
function RequireVerified({ children }: { children: React.ReactNode }) {
  const { loading, user, verified } = useAuth()
  const { open } = useSignUp()
  if (loading) return null
  if (verified) return <>{children}</>
  return (
    <div className="page empty">
      <p className="heading">{user ? 'Verify your CSU email to see messages.' : 'Sign up to see your messages.'}</p>
      {user ? (
        <Link to="/verify" className="btn btn-primary">
          Verify my email
        </Link>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => open({ reason: 'messages' })}>
          Sign up
        </button>
      )}
    </div>
  )
}

function NotBuiltYet({ title }: { title: string }) {
  return (
    <div className="page empty">
      <Construction size={48} strokeWidth={1.5} aria-hidden="true" />
      <p className="heading">{title} is coming soon.</p>
      <Link to="/listings" className="btn btn-secondary">
        Browse places
      </Link>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page empty">
      <p className="heading">This page wandered off.</p>
      <Link to="/listings" className="btn btn-secondary">
        Browse places
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <InboxProvider>
        <SignUpProvider>
      <Routes>
        <Route element={<WithNav />}>
          <Route index element={<Home />} />
          <Route path="listings" element={<Browse />} />
          <Route path="saved" element={<NotBuiltYet title="Saved" />} />
          <Route
            path="messages"
            element={
              <RequireVerified>
                <Messages />
              </RequireVerified>
            }
          />
          <Route path="me" element={<Me />} />
          <Route path="me/listings" element={<NotBuiltYet title="Your listings" />} />
          <Route path="account" element={<NotBuiltYet title="Account settings" />} />
          <Route path="safety" element={<NotBuiltYet title="Safety tips" />} />
          <Route path="terms" element={<NotBuiltYet title="Terms" />} />
          <Route path="privacy" element={<NotBuiltYet title="Privacy" />} />
          <Route path="support" element={<NotBuiltYet title="Support" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<NoBottomNav />}>
          <Route path="listings/:id" element={<ListingDetail />} />
          <Route
            path="messages/:id"
            element={
              <RequireVerified>
                <Messages />
              </RequireVerified>
            }
          />
        </Route>
        <Route element={<TopBarOnly />}>
          <Route path="verify" element={<Verify />} />
          <Route path="verified" element={<Verified />} />
          <Route path="post/live/:id" element={<PostLive />} />
          <Route path="onboarding" element={<ProfileSetup />} />
        </Route>
        <Route path="post" element={<PostListing />} />
      </Routes>
        </SignUpProvider>
        </InboxProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
