import Terms from './screens/legal/Terms'
import Privacy from './screens/legal/Privacy'
import Safety from './screens/legal/Safety'
import Support from './screens/legal/Support'
import Saved from './screens/Saved'
import { SavedProvider } from './components/SavedProvider'
import { Link, Outlet, Route, Routes } from 'react-router'
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

// Messages and listing management need a verified student account.
function RequireVerified({ children }: { children: React.ReactNode }) {
  const { loading, user, verified } = useAuth()
  const { open } = useSignUp()
  if (loading) return null
  if (verified) return <>{children}</>
  return (
    <div className="page empty">
      <p className="heading">{user ? 'Verify your school email to keep going.' : 'Sign up or log in to keep going.'}</p>
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

// Signed in with a real account (verified or not).
function RequireUser({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth()
  const { open } = useSignUp()
  if (loading) return null
  if (user) return <>{children}</>
  return (
    <div className="page empty">
      <p className="heading">Log in to see your account.</p>
      <button type="button" className="btn btn-primary" onClick={() => open({ reason: 'login' })}>
        Log in
      </button>
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
              <RequireVerified>
                <Saved />
              </RequireVerified>
            }
          />
          <Route
            path="messages"
            element={
              <RequireVerified>
                <Messages />
              </RequireVerified>
            }
          />
          <Route path="me" element={<Me />} />
          <Route
            path="me/listings"
            element={
              <RequireVerified>
                <MyListings />
              </RequireVerified>
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
          <Route path="admin" element={<AdminGate />} />
        </Route>
        <Route path="post" element={<PostListing />} />
        <Route
          path="me/listings/:id/edit"
          element={
            <RequireVerified>
              <EditListing />
            </RequireVerified>
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
