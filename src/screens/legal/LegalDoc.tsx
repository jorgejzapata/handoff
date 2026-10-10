import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { LEGAL_EFFECTIVE_DATE } from '../../config'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

// Shared layout for Terms, Privacy and Safety: title, effective date, a
// numbered table of contents, then numbered sections with anchor links.
export function LegalDoc({
  title,
  intro,
  sections,
  footnote,
}: {
  title: string
  intro: ReactNode
  sections: LegalSection[]
  footnote?: ReactNode
}) {
  // Links like /terms#fair-housing land on that section.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [hash])

  return (
    <article className="page legal legal-doc">
      <header className="legal-head">
        <h1 className="title">{title}</h1>
        <p className="caption muted">Effective {LEGAL_EFFECTIVE_DATE}</p>
      </header>

      <div className="legal-intro">{intro}</div>

      <nav aria-labelledby="toc-heading" className="legal-toc">
        <h2 id="toc-heading" className="label">
          Contents
        </h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="legal-section">
          <h2 id={`${s.id}-h`} className="heading">
            {i + 1}. {s.title}
          </h2>
          {s.body}
        </section>
      ))}

      {footnote && <footer className="caption muted legal-footnote">{footnote}</footer>}
    </article>
  )
}

export function Mail({ to }: { to: string }) {
  return <a href={`mailto:${to}`}>{to}</a>
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}
