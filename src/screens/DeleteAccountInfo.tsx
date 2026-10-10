import { Link } from 'react-router'
import { useAuth } from '../components/AuthProvider'
import { useSignUp } from '../components/SignUpSheet'
import { SUPPORT_EMAIL } from '../config'

// Public page Google Play links to: how to delete a Handoff account.
export default function DeleteAccountInfo() {
  const { user } = useAuth()
  const { open } = useSignUp()
  return (
    <div className="page legal">
      <h1 className="title">Delete your Handoff account</h1>
      <p>You can delete your account yourself, any time, from Account settings.</p>
      <h2 className="heading">What gets deleted</h2>
      <ul className="legal-list">
        <li>Your listings, their photos and their exact addresses</li>
        <li>Your profile: name, photo, year and bio</li>
        <li>Your blocked list and your login</li>
      </ul>
      <h2 className="heading">What stays</h2>
      <ul className="legal-list">
        <li>Messages you already sent stay in the other person's chat, with your name changed to “Former member”.</li>
        <li>Reports about listings or people stay with our moderators.</li>
      </ul>
      <div className="verify-actions">
        {user ? (
          <Link to="/account" className="btn btn-primary btn-block">
            Go to Account settings
          </Link>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => open({ reason: 'login' })}>
            Log in to delete your account
          </button>
        )}
      </div>
      {SUPPORT_EMAIL && (
        <p className="caption muted">
          Can't log in? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your CSU email and we'll delete it for you.
        </p>
      )}
    </div>
  )
}
