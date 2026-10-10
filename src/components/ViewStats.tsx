import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { fetchViewStats } from '../lib/views'
import type { ViewStats as Stats } from '../lib/views'

// "42 views in the last 7 days" plus a bar per day. Lister only.
export function ViewStats({ listingId, compact = false }: { listingId: string; compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchViewStats(listingId)
      .then((s) => alive && setStats(s))
      .catch((e) => {
        console.error('[handoff] view stats', e)
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [listingId])

  if (failed) return null
  if (!stats) return <p className="caption muted view-stats">Loading views…</p>

  const max = Math.max(1, ...stats.byDay.map((d) => d.count))
  const label = `${stats.total} ${stats.total === 1 ? 'view' : 'views'} in the last 7 days`

  return (
    <div className={compact ? 'view-stats compact' : 'view-stats'}>
      <p className="view-total">
        <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </p>
      <div className="view-bars" role="img" aria-label={stats.byDay.map((d) => `${d.label}: ${d.count}`).join(', ')}>
        {stats.byDay.map((d, i) => (
          <div key={d.day} className="view-bar-col" title={`${d.count} on ${d.day.slice(4, 6)}/${d.day.slice(6)}`}>
            <span className="view-bar" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} data-empty={d.count === 0} />
            {!compact && <span className="view-day">{i === 6 ? 'Today' : d.label}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
