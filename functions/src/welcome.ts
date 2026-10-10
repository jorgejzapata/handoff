import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { appUrl, isProd } from './env.js'
import { RESEND_API_KEY, button, esc, layout, sendEmail } from './mail.js'

// Welcome email, sent once, right after a student verifies their school email.
// The app sets users/{uid}.verifiedAt (and why they signed up) at that moment.

type Reason = 'say-hi' | 'publish' | 'save' | 'messages' | 'login' | undefined

// Picks up where they left off when they signed up.
function nextStep(reason: Reason, base: string) {
  switch (reason) {
    case 'say-hi':
      return { line: 'Your message is on its way. Replies show up in Messages.', label: 'Go to Messages', href: `${base}/messages` }
    case 'publish':
      return { line: 'Your place is live. Check how it’s doing anytime in My listings.', label: 'See your listing', href: `${base}/me/listings` }
    case 'save':
      return { line: 'The place you saved is waiting in Saved.', label: 'Open Saved', href: `${base}/saved` }
    default:
      return { line: 'New places go up every week.', label: 'Browse places', href: `${base}/listings` }
  }
}

// The welcome email's subject, HTML and plain text.
export function buildWelcome(firstName: string | undefined, reason: Reason, base: string, prod: boolean) {
  const name = firstName?.trim() || 'there'
  const step = nextStep(reason, base)
  const subject = `You're in, ${name}${prod ? '' : ' (test)'}`

  const html = layout(
    [
      `<tr><td style="font-size:22px;font-weight:800;line-height:28px;padding-bottom:8px">You're in, ${esc(name)}.</td></tr>`,
      `<tr><td style="font-size:15px;line-height:22px;padding-bottom:16px">Handoff is where students sublet rooms and hand off leases, and only verified students can message. ${esc(step.line)}</td></tr>`,
      `<tr><td style="padding-bottom:24px">${button(step.href, step.label)}</td></tr>`,
      `<tr><td style="font-size:14px;line-height:22px;border-top:1px solid #E3E6DC;padding-top:16px">
        <a href="${base}/listings" style="color:#3A6447;font-weight:600;white-space:nowrap">Browse places</a> &nbsp;·&nbsp;
        <a href="${base}/post" style="color:#3A6447;font-weight:600;white-space:nowrap">Post your place</a> &nbsp;·&nbsp;
        <a href="${base}/safety" style="color:#3A6447;font-weight:600;white-space:nowrap">Safety tips</a></td></tr>`,
    ],
    `Never send money before you've seen the place and the lease.<br>You're getting this because you just verified your school email on Handoff.`,
  )
  const text = `You're in, ${name}.\n\nHandoff is where students sublet rooms and hand off leases, and only verified students can message. ${step.line}\n\n${step.label}: ${step.href}\n\nBrowse places: ${base}/listings\nPost your place: ${base}/post\nSafety tips: ${base}/safety\n\nNever send money before you've seen the place and the lease.`

  return { subject, html, text }
}

export const onUserVerified = onDocumentUpdated(
  { document: 'users/{uid}', region: 'us-central1', secrets: [RESEND_API_KEY], memory: '256MiB', maxInstances: 10 },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const uid = event.params.uid
    if (!after || before?.verifiedAt || !after.verifiedAt) return

    // Claim the send first so a retry or a second write can never email twice.
    const db = getFirestore()
    try {
      await db.doc(`emailLog/${uid}_welcome`).create({ at: FieldValue.serverTimestamp() })
    } catch {
      return // already sent
    }

    let to: string | undefined
    try {
      to = (await getAuth().getUser(uid)).email
    } catch {
      return
    }
    if (!to) return

    const { subject, html, text } = buildWelcome(after.firstName, after.signupReason as Reason, appUrl(), isProd())
    const sent = await sendEmail({ to, subject, html, text })
    if (!sent) {
      // Let a later verification write try again.
      await db.doc(`emailLog/${uid}_welcome`).delete().catch(() => {})
      logger.warn('welcome email not sent', uid)
    }
  },
)
