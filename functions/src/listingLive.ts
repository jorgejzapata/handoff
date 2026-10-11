import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl, isProd } from './env.js'
import { RESEND_API_KEY, button, esc, layout, sendEmail } from './mail.js'

// "You're live" email: sent once per listing, the first time it's published
// (a draft going active). Relisting doesn't send it again. Someone who signed
// up at Publish gets this instead of the welcome email, with a welcome line.

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function dateOf(v: unknown) {
  if (v instanceof Timestamp) return v.toDate()
  if (typeof v === 'string' && v) return new Date(`${v.slice(0, 10)}T12:00:00Z`)
  return null
}

export interface LiveEmailInput {
  firstName?: string
  title: string
  rentCents?: number
  from?: Date | null
  to?: Date | null
  photoUrl?: string
  listingId: string
  newMember: boolean
}

export function buildListingLive(o: LiveEmailInput, base: string, prod: boolean) {
  const name = o.firstName?.trim() || 'there'
  const title = o.title.trim() || 'Your place'
  const rent = o.rentCents ? `$${Math.round(o.rentCents / 100).toLocaleString('en-US')} / mo` : ''
  const dates = o.from && o.to ? `${dayFmt.format(o.from)} – ${dayFmt.format(o.to)}` : ''
  const meta = [rent, dates].filter(Boolean).join(' · ')
  const listingUrl = `${base}/listings/${o.listingId}`
  const shareUrl = `${listingUrl}?utm_source=share&utm_medium=live_email`
  const manageUrl = `${base}/me/listings`

  const subject = `You're live! Good luck with your place${prod ? '' : ' (test)'}`
  const lead = o.newMember
    ? `Welcome to Handoff. “${title}” is up, and students can find it now. Good luck finding the right person!`
    : `“${title}” is up, and students can find it now. Good luck finding the right person!`
  const tips: [string, string][] = [
    ['Share it.', 'Drop the link in your school’s housing groups and your story. Every share puts it in front of more students.'],
    ['Reply fast.', 'Messages show up in Handoff, and we’ll email you if one waits.'],
    ['Check your lease.', 'Get your landlord’s OK in writing before you hand it off.'],
  ]

  const html = layout(
    [
      `<tr><td style="font-size:22px;font-weight:800;line-height:28px;padding-bottom:8px">You're live, ${esc(name)}!</td></tr>`,
      `<tr><td style="font-size:15px;line-height:22px;padding-bottom:20px">${esc(lead)}</td></tr>`,
      `<tr><td style="padding-bottom:20px"><a href="${listingUrl}" style="text-decoration:none;color:#203A2E">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E6DC;border-radius:12px"><tr>
          ${o.photoUrl ? `<td width="88" style="padding:12px 0 12px 12px"><img src="${esc(o.photoUrl)}" width="76" height="57" alt="" style="display:block;width:76px;height:57px;object-fit:cover;border-radius:8px"></td>` : ''}
          <td style="padding:12px;font-size:15px;line-height:20px"><strong>${esc(title)}</strong>${meta ? `<br><span style="font-size:13px;color:#6B7169">${esc(meta)}</span>` : ''}</td>
        </tr></table></a></td></tr>`,
      `<tr><td style="padding-bottom:24px">${button(shareUrl, 'Open and share it')}</td></tr>`,
      `<tr><td style="font-size:15px;font-weight:700;line-height:20px;padding-bottom:8px">A few things that help</td></tr>`,
      ...tips.map(
        ([lead, body]) =>
          `<tr><td style="font-size:14px;line-height:20px;padding-bottom:10px"><strong>${esc(lead)}</strong> ${esc(body)}</td></tr>`,
      ),
      `<tr><td style="font-size:14px;line-height:20px;border-top:1px solid #E3E6DC;padding-top:16px;margin-top:8px">Found someone? Tap <strong>Mark as filled</strong> in <a href="${manageUrl}" style="color:#3A6447;font-weight:600">your listings</a> so people stop messaging you.</td></tr>`,
    ],
    `Never send money before you've seen the place and the lease.<br>You're getting this because you posted a place on Handoff.`,
  )

  const text = [
    `You're live, ${name}!`,
    '',
    lead,
    '',
    `${title}${meta ? ` (${meta})` : ''}`,
    `Open and share it: ${shareUrl}`,
    '',
    'A few things that help:',
    ...tips.map(([a, b]) => `- ${a} ${b}`),
    '',
    `Found someone? Tap Mark as filled in your listings so people stop messaging you: ${manageUrl}`,
    '',
    "Never send money before you've seen the place and the lease.",
  ].join('\n')

  return { subject, html, text }
}

export const onListingPublished = onDocumentUpdated(
  { document: 'listings/{listingId}', region: 'us-central1', secrets: [RESEND_API_KEY], memory: '256MiB', maxInstances: 10 },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status !== 'draft' || after.status !== 'active') return

    const listingId = event.params.listingId
    const uid: string = after.ownerId
    const db = getFirestore()

    // Claim the send first so a retry can never email twice.
    try {
      await db.doc(`emailLog/${listingId}_live`).create({ at: FieldValue.serverTimestamp() })
    } catch {
      return
    }

    const [user, suspended] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`suspensions/${uid}`).get()])
    if (suspended.exists) return

    let to: string | undefined
    try {
      to = (await getAuth().getUser(uid)).email
    } catch {
      return
    }
    if (!to) return

    // First listing from someone who joined at Publish: their welcome was held
    // back (see welcome.ts), so this email welcomes them.
    const newMember = user.data()?.signupReason === 'publish' && !(await hasEarlierLiveEmail(uid, listingId))

    const photos = Array.isArray(after.photos) ? after.photos : []
    const cover = photos[0]
    const { subject, html, text } = buildListingLive(
      {
        firstName: user.data()?.firstName ?? after.listerFirstName,
        title: after.title ?? '',
        rentCents: after.rentCents,
        from: dateOf(after.availableFrom),
        to: dateOf(after.availableTo),
        photoUrl: cover?.thumbUrl || cover?.url,
        listingId,
        newMember,
      },
      appUrl(),
      isProd(),
    )
    const sent = await sendEmail({ to, subject, html, text })
    if (!sent) {
      await db.doc(`emailLog/${listingId}_live`).delete().catch(() => {})
      logger.warn('listing live email not sent', listingId)
    }
  },
)

// Has this person already had a "you're live" email for another listing?
async function hasEarlierLiveEmail(uid: string, listingId: string) {
  const db = getFirestore()
  const theirs = await db.collection('listings').where('ownerId', '==', uid).select().get()
  const others = theirs.docs.filter((d) => d.id !== listingId).map((d) => db.doc(`emailLog/${d.id}_live`))
  if (!others.length) return false
  return (await db.getAll(...others)).some((d) => d.exists)
}
