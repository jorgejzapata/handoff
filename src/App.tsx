import { app, usingEmulators } from './lib/firebase'

function Mark() {
  return (
    <svg viewBox="0 0 96 80" width="34" height="28" aria-hidden="true">
      <rect x="12" y="8" width="20" height="64" rx="10" fill="var(--ink)" />
      <rect x="50" y="8" width="20" height="64" rx="10" fill="var(--ink)" />
      <rect x="12" y="30" width="78" height="20" rx="10" fill="var(--lime-300)" />
    </svg>
  )
}

export default function App() {
  const project = app.options.projectId

  return (
    <div className="shell">
      <header className="topbar">
        <Mark />
        <span className="wordmark">handoff</span>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Subleases near CSU</p>
          <h1 className="display">A little less rent. A lot more possibility.</h1>
          <p className="body-muted">
            Find a room for a semester, or hand off your lease to another Ram. Coming soon.
          </p>
        </section>

        {import.meta.env.DEV && (
          <p className="notice">
            <span className={usingEmulators ? 'dot' : 'dot live'} />
            {usingEmulators
              ? `Dev mode · connected to local emulators (${project})`
              : `Dev mode · connected to the real ${project} project`}
          </p>
        )}
      </main>
    </div>
  )
}
