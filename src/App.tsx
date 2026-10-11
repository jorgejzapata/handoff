import { useEffect } from 'react'
import { Heart, House, MessageCircle, User } from 'lucide-react'
import Terms from './screens/legal/Terms'
import Privacy from './screens/legal/Privacy'
import Safety from './screens/legal/Safety'
import Support from './screens/legal/Support'
import Saved from './screens/Saved'
import { SavedProvider } from './components/SavedProvider'
import { Link, Outlet, Route, Routes, useLocation } from 'react-router'
import { BottomNav, TopBar } from './components/Shell'
import { SignUpProvider } from './components/SignUpSheet'
import { AuthProvider } from './components/AuthProvider'
import { ToastProvider } from './components/Toast'
import { InboxProvider } from './components/InboxProvider'
import { useAuth } from './components/AuthProvider'
import { useSignUp } from './components/SignUpSheet'
import Messages from './screens/messages/Messages'
import MyListings from './screens/MyListings'
import EditListing from './screens/EditListing'
import Account from './screens/Account'
import DeleteAccountInfo from './screens/DeleteAccountInfo'
import AdminGate from './screens/admin/Admin'
import { SuspensionGate } from './components/SuspensionGate'
import Home from './screens/Home'
import Browse from './screens/Browse'
import ListingDetail from './screens/ListingDetail'
import PostListing from './screens/post/PostListing'
import PostLive from './screens/post/PostLive'
import { ListingFeeResult } from './screens/post/ListingFee'
import ProfileSetup from './screens/ProfileSetup'
import Verify, { ConfirmEmail, Verified } from './screens/Verify'
import Me from './screens/Me'
import Boost, { BoostResult } from './screens/Boost'
import Pricing from './screens/Pricing'
import { usingEmulators } from './lib/firebase'
import { trackScreen } from './lib/track'

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

// Saved, messages and listing management need a real account.
// What a signed-out visitor sees on a members-only page: what lives here,
// and both doors in.
const GATES = {
  saved: { icon: Heart, heading: 'Places you save live here.', reason: 'save' },
  messages: { icon: MessageCircle, heading: 'Your chats with listers live here.', reason: 'messages' },
  listings: { icon: House, heading: 'Your listings live here.', reason: 'messages' },
} as const

function RequireMember({ children, gate = 'messages' }: { children: React.ReactNode; gate?: keyof typeof GATES }) {
  const { loading, member } = useAuth()
  const { open } = useSignUp()
  if (loading) return null
  if (member) return <>{children}</>
  const { icon: Icon, heading, reason } = GATES[gate]
  return (
    <div className="page empty signed-out">
      <Icon size={48} strokeWidth={1.5} aria-hidden="true" />
      <p className="heading">{heading}</p>
      <p className="muted">Free to join. You'll need an account to post, save and message.</p>
      <div className="signed-out-actions">
        <button type="button" className="btn btn-primary" onClick={() => open({ reason, mode: 'signup' })}>
          Sign up
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => open({ reason, mode: 'login' })}>
          Log in
        </button>
      </div>
    </div>
  )
}

// Signed in with a real account.
function RequireUser({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth()
  const { open } = useSignUp()
  if (loading) return null
  if (user) return <>{children}</>
  return (
    <div className="page empty signed-out">
        <User size={48} strokeWidth={1.5} aria-hidden="true" />
        <p className="heading">Your account lives here.</p>
        <p className="muted">Free to join. You'll need an account to post, save and message.</p>
        <div className="signed-out-actions">
          <button type="button" className="btn btn-primary" onClick={() => open({ reason: 'login', mode: 'signup' })}>
            Sign up
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => open({ reason: 'login', mode: 'login' })}>
            Log in
          </button>
        </div>
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

// One screen_view per route, with a clean screen name. The post wizard sends
// its own per-step views.
function ScreenTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!pathname.startsWith('/post') || pathname.startsWith('/post/live')) trackScreen(pathname)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <ScreenTracker />
      <ToastProvider>
        <InboxProvider>
        <SavedProvider>
        <SignUpProvider>
        <SuspensionGate>
      <Routes>
        <Route element={<WithNav />}>
          <Route index element={<Home />} />
          <Route path="listings" element={<Browse />} />
          <Route
            path="saved"
            element={
              <RequireMember gate="saved">
                <Saved />
              </RequireMember>
            }
          />
          <Route
            path="messages"
            element={
              <RequireMember>
                <Messages />
              </RequireMember>
            }
          />
          <Route path="me" element={<Me />} />
          <Route
            path="me/listings"
            element={
              <RequireMember gate="listings">
                <MyListings />
              </RequireMember>
            }
          />
          <Route
            path="account"
            element={
              <RequireUser>
                <Account />
              </RequireUser>
            }
          />
          <Route path="delete-account" element={<DeleteAccountInfo />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="safety" element={<Safety />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="support" element={<Support />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<NoBottomNav />}>
          <Route path="listings/:id" element={<ListingDetail />} />
          <Route
            path="messages/:id"
            element={
              <RequireMember>
                <Messages />
              </RequireMember>
            }
          />
        </Route>
        <Route element={<TopBarOnly />}>
          <Route path="verify" element={<Verify />} />
          <Route path="verified" element={<Verified />} />
          <Route path="confirm-email" element={<ConfirmEmail />} />
          <Route path="post/live/:id" element={<PostLive />} />
          <Route path="post/paid" element={<ListingFeeResult />} />
          <Route path="onboarding" element={<ProfileSetup />} />
          <Route path="admin" element={<AdminGate />} />
          <Route path="boost/success" element={<BoostResult />} />
          <Route path="boost/cancel" element={<BoostResult cancelled />} />
        </Route>
        <Route path="post" element={<PostListing />} />
        <Route
          path="me/listings/:id/boost"
          element={
            <RequireMember>
              <Boost />
            </RequireMember>
          }
        />
        <Route
          path="me/listings/:id/edit"
          element={
            <RequireMember>
              <EditListing />
            </RequireMember>
          }
        />
      </Routes>
        </SuspensionGate>
        </SignUpProvider>
        </SavedProvider>
        </InboxProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
