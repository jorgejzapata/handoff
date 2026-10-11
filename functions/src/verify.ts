import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl, isProd } from './env.js'
import { RESEND_API_KEY, button, esc, layout, sendEmail } from './mail.js'

// Verification emails. Firebase makes the one-time link (so verifying works
// exactly as before), and Resend delivers it from handoffsublease.com, which
// is faster and lands in school inboxes more reliably than Firebase's sender.
// The app calls this right after signup and from "Resend link".

const COOLDOWN_MS = 45_000 // the app's button waits 60s; this is the backstop
const DAILY_MAX = 10

// Same rule as isStudentEmail() in src/lib/auth.ts and firestore.rules.
const STUDENT_EMAIL_SUFFIXES = ['.edu']
function isStudentEmail(email: string) {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && STUDENT_EMAIL_SUFFIXES.some((s) => domain.endsWith(s))
}

export function buildVerify(firstName: string | undefined, link: string, prod: boolean) {
  const name = firstName?.trim() || 'there'
  const subject = `Verify your school email for Handoff${prod ? '' : ' (test)'}`
  const html = layout(
    [
      `<tr><td style="font-size:22px;font-weight:800;line-height:28px;padding-bottom:8px">Hi ${esc(name)}, one tap and you're in.</td></tr>`,
      `<tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">Verify your school email so you can message listers and post your place on Handoff.</td></tr>`,
      `<tr><td>${button(link, 'Verify my email')}</td></tr>`,
    ],
    `If you didn't sign up for Handoff, you can ignore this email.`,
  )
  const text = `Hi ${name}, one tap and you're in.\n\nVerify your school email so you can message listers and post your place on Handoff:\n${link}\n\nIf you didn't sign up for Handoff, you can ignore this email.`
  return { subject, html, text }
}

export const sendVerificationEmail = onCall(
  { region: 'us-central1', secrets: [RESEND_API_KEY], memory: '256MiB', maxInstances: 10 },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.')

    const user = await getAuth().getUser(uid)
    const email = user.email
    if (!email) throw new HttpsError('failed-precondition', 'No email on this account.')
    if (user.emailVerified) return { alreadyVerified: true }
    if (!isStudentEmail(email)) throw new HttpsError('failed-precondition', 'Not a school email.')

    // Throttle per account: one send per cooldown, and a daily cap.
    const db = getFirestore()
    const ref = db.doc(`emailLog/${uid}_verify`)
    const today = new Date().toISOString().slice(0, 10)
    await db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data()
      const last = d?.at instanceof Timestamp ? d.at.toMillis() : 0
      const count = d?.day === today ? (d?.count ?? 0) : 0
      if (Date.now() - last < COOLDOWN_MS || count >= DAILY_MAX) {
        throw new HttpsError('resource-exhausted', 'Too many tries. Wait a few minutes.')
      }
      tx.set(ref, { at: Timestamp.now(), day: today, count: count + 1 })
    })

    // Firebase makes the one-time code; the email links to Handoff's own
    // /confirm-email page, which only uses the code when the student taps
    // Verify (so email link scanners can't use it up first).
    const firebaseLink = await getAuth().generateEmailVerificationLink(email, { url: `${appUrl()}/verified` })
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode')
    if (!oobCode) throw new HttpsError('internal', 'No verification code.')
    const link = `${appUrl()}/confirm-email?oobCode=${encodeURIComponent(oobCode)}`
    const { subject, html, text } = buildVerify(user.displayName ?? undefined, link, isProd())
    const sent = await sendEmail({ to: email, subject, html, text })
    if (!sent) {
      // Don't count a failed send against them; the app falls back to Firebase's email.
      await ref.delete().catch(() => {})
      logger.error('verification email not sent', uid)
      throw new HttpsError('unavailable', "Couldn't send the email.")
    }
    return { sent: true }
  },
)
