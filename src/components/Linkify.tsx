import type { ReactNode } from 'react'

// Turns web addresses, email addresses and US phone numbers in chat text into
// tappable links. Only http(s), mailto: and tel: links are ever created, and
// the link text is always the exact address the sender typed, so nobody can
// disguise where a link goes.

const TLDS =
  'com|org|net|edu|gov|io|co|us|me|app|dev|ly|gl|ai|info|biz|link|site|page|apartments|rentals|properties|homes|house'

const PATTERN = new RegExp(
  [
    // https://… or http://…
    String.raw`(?<url>\bhttps?:\/\/[^\s<>"']+)`,
    // www.example.com/…
    String.raw`(?<www>\bwww\.[^\s<>"']+)`,
    // name@example.com
    String.raw`(?<email>\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)`,
    // example.com or example.com/path (common endings only, so "e.g." stays text)
    String.raw`(?<bare>\b[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.(?:${TLDS})\b(?:\/[^\s<>"']*)?)`,
    // (970) 555-0123, 970-555-0123, 970.555.0123, +1 970 555 0123
    String.raw`(?<phone>(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]\d{4}\b)`,
  ].join('|'),
  'g',
)

// Sentence punctuation right after a link isn't part of it: "see zillow.com."
function trimTrailing(s: string) {
  let out = s.replace(/[.,!?;:'"]+$/, '')
  // Drop a closing bracket that has no opening one inside the link.
  while (/[)\]]$/.test(out)) {
    const close = out.at(-1)!
    const open = close === ')' ? '(' : '['
    if (out.split(open).length >= out.split(close).length) break
    out = out.slice(0, -1).replace(/[.,!?;:'"]+$/, '')
  }
  return out
}

function hrefFor(kind: string, text: string) {
  if (kind === 'email') return `mailto:${text}`
  if (kind === 'phone') {
    const digits = text.replace(/\D/g, '')
    return `tel:+${digits.length === 10 ? `1${digits}` : digits}`
  }
  const url = kind === 'url' ? text : `https://${text}`
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

export function linkifyParts(text: string): ({ text: string } | { text: string; href: string; kind: string })[] {
  const parts: ({ text: string } | { text: string; href: string; kind: string })[] = []
  let last = 0
  for (const m of text.matchAll(PATTERN)) {
    const kind = Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined)?.[0]
    if (!kind || m.index === undefined) continue
    const raw = kind === 'url' || kind === 'www' || kind === 'bare' ? trimTrailing(m[0]) : m[0]
    // "someone@site.com" is an email, not a bare domain; skip a domain glued to an @.
    if (kind === 'bare' && text[m.index - 1] === '@') continue
    const href = hrefFor(kind, raw)
    if (!href) continue
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: raw, href, kind })
    last = m.index + raw.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export function Linkify({ text }: { text: string }): ReactNode {
  return linkifyParts(text).map((p, i) =>
    'href' in p ? (
      <a
        key={i}
        href={p.href}
        className="chat-link"
        // Web links open in a new tab; email and phone open the right app.
        {...(p.kind === 'email' || p.kind === 'phone' ? {} : { target: '_blank', rel: 'noopener noreferrer nofollow ugc' })}
        onClick={(e) => e.stopPropagation()}
      >
        {p.text}
      </a>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
}
