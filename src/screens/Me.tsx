import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BadgeCheck, ChartColumn, ChevronRight, CircleAlert, FileText, House, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { checkIsAdmin } from '../lib/admin'
import { useAuth } from '../components/AuthProvider'
import { useSignUp } from '../components/SignUpSheet'
import { useToast } from '../components/Toast'
import { isStudentEmail, logOut } from '../lib/auth'

export default function Me() {
  const { user, loading, studentVerified, photoUrl } = useAuth()
  const { open } = useSignUp()
  const navigate = useNavigate()
  const toast = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    checkIsAdmin(user).then(setIsAdmin)
  }, [user])

  if (loading) return null

  if (!user) {
    return (
      <div className="page empty">
        <p className="heading">Sign up or log in to see your listings and messages.</p>
        <button type="button" className="btn btn-primary" onClick={() => open({ reason: 'login' })}>
          Sign up or log in
        </button>
      </div>
    )
  }

  const name = user.displayName || 'You'

  async function onLogOut() {
    await logOut()
    navigate('/', { replace: true })
    toast('Logged out.')
  }

  return (
    <div className="page me">
      <section className="me-head">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="avatar avatar-img" />
        ) : (
          <span className="avatar" aria-hidden="true">
            {name[0]}
          </span>
        )}
        <div>
          <h1 className="title-sm">{name}</h1>
          {studentVerified ? (
            <p className="verified">
              <BadgeCheck size={16} strokeWidth={1.5} aria-hidden="true" />
              Verified student
            </p>
          ) : (
            isStudentEmail(user.email) && (
              <Link to="/verify" className="unverified">
                <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
                Get your Verified student badge
              </Link>
            )
          )}
          <p className="caption muted">{user.email}</p>
          <Link to="/onboarding?next=/me" className="text-link caption">
            Edit profile
          </Link>
        </div>
      </section>

      <nav className="menu" aria-label="Account">
        <MenuRow to="/me/listings" icon={<House size={20} strokeWidth={1.5} />} label="Your listings" />
        <MenuRow to="/account" icon={<Settings size={20} strokeWidth={1.5} />} label="Account settings" />
        <MenuRow to="/safety" icon={<ShieldCheck size={20} strokeWidth={1.5} />} label="Safety tips" />
        <MenuRow to="/terms" icon={<FileText size={20} strokeWidth={1.5} />} label="Terms and privacy" />
        {isAdmin && <MenuRow to="/admin" icon={<ChartColumn size={20} strokeWidth={1.5} />} label="Admin" />}
        <button type="button" className="menu-row" onClick={onLogOut}>
          <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </nav>
    </div>
  )
}

function MenuRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="menu-row">
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" className="menu-chevron" />
    </Link>
  )
}
