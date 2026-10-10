import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'

// Shared email plumbing: one sender, one look, sent through Resend.
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const FROM = 'Handoff <notifications@handoffsublease.com>'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#203A2E;color:#F8F8F1;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:999px">${esc(label)}</a>`
}

// The card every Handoff email sits in. `rows` are <tr>…</tr> strings.
export function layout(rows: string[], footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#F8F8F1;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#203A2E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F1;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E6DC;border-radius:16px;padding:28px">
<tr><td style="font-weight:900;font-size:22px;letter-spacing:-.02em;padding-bottom:20px">handoff</td></tr>
${rows.join('\n')}
<tr><td style="font-size:12px;line-height:16px;color:#6B7169;padding-top:24px">${footer}</td></tr>
</table></td></tr></table></body></html>`
}

export async function sendEmail(o: { to: string; subject: string; html: string; text: string; unsubscribe?: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [o.to],
      subject: o.subject,
      html: o.html,
      text: o.text,
      ...(o.unsubscribe ? { headers: { 'List-Unsubscribe': `<${o.unsubscribe}>` } } : {}),
    }),
  })
  if (!res.ok) {
    logger.error('Resend failed', res.status, await res.text())
    return false
  }
  return true
}
