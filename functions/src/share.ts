import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl, projectId } from './env.js'

// Listing share previews. Hosting sends /listings/{id} here; we return the
// normal app page with the listing's own title, photo, rent and dates in the
// preview tags, so links pasted into iMessage, Snapchat or a group chat show
// the place. The app itself loads exactly as usual.

let shell: { html: string; at: number } | null = null

// The live index.html, fetched from this project's Hosting so it always
// matches the deployed build. Cached for a few minutes.
async function appShell() {
  if (shell && Date.now() - shell.at < 5 * 60 * 1000) return shell.html
  const res = await fetch(`https://${projectId()}.web.app/index.html`, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`index.html ${res.status}`)
  shell = { html: await res.text(), at: Date.now() }
  return shell.html
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const day = (t: unknown) => (t instanceof Timestamp ? dateFmt.format(t.toDate()) : '')

function rent(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

export function tagsFor(id: string, d: FirebaseFirestore.DocumentData) {
  const title = (d.title as string) || 'A place near CSU'
  const type = d.listingType === 'takeover' ? 'Whole place' : 'Room'
  const dates = [day(d.availableFrom), day(d.availableTo)].filter(Boolean).join(' – ')
  const line = [`${rent(d.rentCents ?? 0)}/mo`, dates, type, d.neighborhood ? `near ${d.neighborhood}` : '']
    .filter(Boolean)
    .join(' · ')
  const photo = (d.photos?.[0]?.url as string | undefined) ?? `${appUrl()}/og.png`
  const url = `${appUrl()}/listings/${id}`
  return [
    `<meta name="description" content="${esc(line)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Handoff" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(line)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(photo)}" />`,
    `<meta property="og:image:alt" content="${esc(`Photo of ${title}`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<title>${esc(title)} · Handoff</title>`,
  ].join('\n    ')
}

export const listingPage = onRequest({ region: 'us-central1', memory: '256MiB', maxInstances: 10 }, async (req, res) => {
  const id = req.path.split('/').filter(Boolean)[1] ?? ''
  try {
    let html = await appShell()
    if (/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      const snap = await getFirestore().doc(`listings/${id}`).get()
      const d = snap.data()
      // Only live listings get a preview; anything else keeps the generic one.
      if (d && d.status === 'active') {
        html = html
          .replace(/<title>[^<]*<\/title>\s*/, '') // the listing's own title goes in the block below
          .replace(/<!-- share:start[\s\S]*?<!-- share:end -->/, tagsFor(id, d))
      }
    }
    // Let the CDN reuse it briefly; the page itself is the same app shell.
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    res.status(200).send(html)
  } catch (e) {
    logger.error('listingPage', e)
    // Never block the page: fall back to a plain redirect into the app.
    res.set('Cache-Control', 'no-store')
    res.status(200).send(
      `<!doctype html><meta charset="utf-8"><title>Handoff</title><script>location.replace('/?listing=${encodeURIComponent(id)}')</script>`,
    )
  }
})
