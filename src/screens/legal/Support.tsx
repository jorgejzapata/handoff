import { Link } from 'react-router'
import { SUPPORT_EMAIL } from '../../config'
import { Mail } from './LegalDoc'

export default function Support() {
  return (
    <div className="page legal">
      <h1 className="title">Contact Handoff</h1>
      <p>
        For questions about your account, a listing, a report or your personal information, email us at{' '}
        <Mail to={SUPPORT_EMAIL} />. Writing from your CSU email helps us find your account. We aim to respond within
        two business days.
      </p>
      <p>
        To report a listing or a member, please use the Report option on the listing or in the conversation, so our
        moderators have the details they need.
      </p>
      <p>
        <strong>If you are in immediate danger, call or text 911.</strong> More resources are in our{' '}
        <Link to="/safety#resources">Safety Guidelines</Link>.
      </p>
    </div>
  )
}
