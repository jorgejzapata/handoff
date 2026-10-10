import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl, isProd } from './env.js'
import { RESEND_API_KEY, button, esc, layout, sendEmail } from './mail.js'

// New-message emails. When someone gets a message, wait a moment; if they
// still haven't read it (they're not in the chat right now), email them.
// At most one email per chat every 30 minutes, and never if they turned
// message emails off in Account settings. Sent through Resend.

const WAIT_MS = 45_000
const THROTTLE_MS = 30 * 60 * 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function preview(type: string, text: string) {
  if (type === 'image') return text ? `📷 ${text}` : 'Sent a photo'
  if (type === 'file') return text ? `📄 ${text}` : 'Sent a file'
  if (type === 'address') return 'Shared the address'
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 160 ? `${t.slice(0, 157)}…` : t
}

function html(o: { sender: string; listing: string; snippet: string; link: string; settings: string }) {
  return layout(
    [
      `<tr><td style="font-size:17px;font-weight:700;line-height:24px;padding-bottom:4px">${esc(o.sender)} sent you a message</td></tr>`,
      `<tr><td style="font-size:14px;line-height:20px;color:#6B7169;padding-bottom:16px">About “${esc(o.listing)}”</td></tr>`,
      `<tr><td style="font-size:15px;line-height:22px;background:#EEF2E7;border-radius:12px;padding:14px 16px">${esc(o.snippet)}</td></tr>`,
      `<tr><td style="padding-top:24px">${button(o.link, 'Open the chat')}</td></tr>`,
    ],
    `Heads up: don't send money before you've seen the place.<br><a href="${o.settings}" style="color:#3A6447">Turn off message emails</a>`,
  )
}

export const onNewMessage = onDocumentCreated(
  {
    document: 'conversations/{convId}/messages/{msgId}',
    region: 'us-central1',
    secrets: [RESEND_API_KEY],
    timeoutSeconds: 120,
    memory: '256MiB',
    maxInstances: 20,
  },
  async (event) => {
    const msg = event.data?.data()
    const convId = event.params.convId
    if (!msg || msg.type === 'system') return

    const db = getFirestore()
    const convRef = db.doc(`conversations/${convId}`)
    const conv = (await convRef.get()).data()
    if (!conv || conv.blockedBy) return
    const sender: string = msg.senderId
    const recipient: string = sender === conv.listerId ? conv.seekerId : conv.listerId
    if (!recipient || recipient === sender) return

    // Give them a moment to read it in the app first.
    await sleep(WAIT_MS)
    const fresh = (await convRef.get()).data()
    if (!fresh || fresh.blockedBy || !(fresh.unreadCount?.[recipient] > 0)) return

    const [user, suspended, throttle] = await Promise.all([
      db.doc(`users/${recipient}`).get(),
      db.doc(`suspensions/${recipient}`).get(),
      db.doc(`emailThrottle/${convId}_${recipient}`).get(),
    ])
    if (suspended.exists) return
    if (user.data()?.notificationPrefs?.email === false) return
    const last = throttle.data()?.at
    if (last instanceof Timestamp && Date.now() - last.toMillis() < THROTTLE_MS) return

    let to: string | undefined
    try {
      to = (await getAuth().getUser(recipient)).email
    } catch {
      return // account deleted
    }
    if (!to) return

    const senderName: string =
      (sender === conv.listerId ? conv.listerFirstName : conv.seekerFirstName) || 'A Ram'
    const listing: string = conv.listingTitle || 'your place'
    const link = `${appUrl()}/messages/${convId}`
    const subject = `${senderName} sent you a message on Handoff${isProd() ? '' : ' (test)'}`
    const snippet = preview(msg.type ?? 'text', msg.text ?? '')

    const sent = await sendEmail({
      to,
      subject,
      html: html({ sender: senderName, listing, snippet, link, settings: `${appUrl()}/account` }),
      text: `${senderName} sent you a message about "${listing}":\n\n${snippet}\n\nOpen the chat: ${link}\n\nHeads up: don't send money before you've seen the place.\nTurn off message emails: ${appUrl()}/account`,
      unsubscribe: `${appUrl()}/account`,
    })
    if (!sent) return
    await db.doc(`emailThrottle/${convId}_${recipient}`).set({ at: FieldValue.serverTimestamp() })
  },
)
