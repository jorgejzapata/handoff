import { Link, Outlet, Route, Routes } from 'react-router'
import { Construction } from 'lucide-react'
import { BottomNav, TopBar } from './components/Shell'
import { SignUpProvider } from './components/SignUpSheet'
import Home from './screens/Home'
import Browse from './screens/Browse'
import ListingDetail from './screens/ListingDetail'
import PostListing from './screens/PostListing'
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
    <SignUpProvider>
      <Routes>
        <Route element={<WithNav />}>
          <Route index element={<Home />} />
          <Route path="listings" element={<Browse />} />
          <Route path="saved" element={<NotBuiltYet title="Saved" />} />
          <Route path="messages" element={<NotBuiltYet title="Messages" />} />
          <Route path="safety" element={<NotBuiltYet title="Safety tips" />} />
          <Route path="terms" element={<NotBuiltYet title="Terms" />} />
          <Route path="privacy" element={<NotBuiltYet title="Privacy" />} />
          <Route path="support" element={<NotBuiltYet title="Support" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<NoBottomNav />}>
          <Route path="listings/:id" element={<ListingDetail />} />
        </Route>
        <Route path="post" element={<PostListing />} />
      </Routes>
    </SignUpProvider>
  )
}
