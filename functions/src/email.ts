import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl, isProd } from './env.js'

// New-message emails. When someone gets a message, wait a moment; if they
// still haven't read it (they're not in the chat right now), email them.
// At most one email per chat every 30 minutes, and never if they turned
// message emails off in Account settings. Sent through Resend.

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const FROM = 'Handoff <notifications@handoffsublease.com>'
const WAIT_MS = 45_000
const THROTTLE_MS = 30 * 60 * 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function preview(type: string, text: string) {
  if (type === 'image') return text ? `📷 ${text}` : 'Sent a photo'
  if (type === 'file') return text ? `📄 ${text}` : 'Sent a file'
  if (type === 'address') return 'Shared the address'
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 160 ? `${t.slice(0, 157)}…` : t
}

function html(o: { sender: string; listing: string; snippet: string; link: string; settings: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F8F8F1;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#203A2E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F1;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E6DC;border-radius:16px;padding:28px">
<tr><td style="font-weight:900;font-size:22px;letter-spacing:-.02em;padding-bottom:20px">handoff</td></tr>
<tr><td style="font-size:17px;font-weight:700;line-height:24px;padding-bottom:4px">${esc(o.sender)} sent you a message</td></tr>
<tr><td style="font-size:14px;line-height:20px;color:#6B7169;padding-bottom:16px">About “${esc(o.listing)}”</td></tr>
<tr><td style="font-size:15px;line-height:22px;background:#EEF2E7;border-radius:12px;padding:14px 16px">${esc(o.snippet)}</td></tr>
<tr><td style="padding-top:24px"><a href="${o.link}" style="display:inline-block;background:#203A2E;color:#F8F8F1;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:999px">Open the chat</a></td></tr>
<tr><td style="font-size:12px;line-height:16px;color:#6B7169;padding-top:24px">Heads up: don't send money before you've seen the place.<br><a href="${o.settings}" style="color:#3A6447">Turn off message emails</a></td></tr>
</table></td></tr></table></body></html>`
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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html: html({ sender: senderName, listing, snippet, link, settings: `${appUrl()}/account` }),
        text: `${senderName} sent you a message about "${listing}":\n\n${snippet}\n\nOpen the chat: ${link}\n\nHeads up: don't send money before you've seen the place.\nTurn off message emails: ${appUrl()}/account`,
        headers: { 'List-Unsubscribe': `<${appUrl()}/account>` },
      }),
    })
    if (!res.ok) {
      logger.error('Resend failed', res.status, await res.text())
      return
    }
    await db.doc(`emailThrottle/${convId}_${recipient}`).set({ at: FieldValue.serverTimestamp() })
  },
)
