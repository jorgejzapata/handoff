import { useState } from 'react'

// One series per chart (no legend needed; the title names it). Thin bars with
// rounded tops anchored to the baseline, a 2px gap, recessive axis, and a
// hover/focus tooltip. A hidden table carries the same numbers for screen readers.

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function BarChart({ title, unit, data }: { title: string; unit: string; data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = 140
  const pad = { top: 20, bottom: 20, left: 0, right: 0 }
  const max = Math.max(1, ...data.map((d) => d.count))
  const slot = (W - pad.left - pad.right) / data.length
  const barW = Math.max(2, slot - 2)
  const plotH = H - pad.top - pad.bottom
  const total = data.reduce((n, d) => n + d.count, 0)
  const label = (d: { day: string; count: number }) =>
    `${dateFmt.format(new Date(`${d.day}T00:00:00Z`))}: ${d.count} ${d.count === 1 ? unit : `${unit}s`}`

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="heading">{title}</span>
        <span className="caption muted">
          {total} in the last 30 days
        </span>
      </figcaption>
      <div className="chart-tooltip" aria-hidden="true">
        {hover !== null ? label(data[hover]) : ' '}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`${title}: ${total} in the last 30 days`} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H - pad.bottom} y2={H - pad.bottom} className="chart-axis" />
        <text x={W} y={pad.top - 8} textAnchor="end" className="chart-tick">
          max {max}
        </text>
        {data.map((d, i) => {
          const h = (d.count / max) * plotH
          const x = pad.left + i * slot + 1
          const y = H - pad.bottom - h
          const r = Math.min(4, barW / 2, h)
          // Rounded top, square bottom on the baseline.
          const path =
            h <= 0
              ? ''
              : `M${x},${H - pad.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H - pad.bottom} Z`
          return (
            <g key={d.day}>
              {path && <path d={path} className={hover === i ? 'chart-bar active' : 'chart-bar'} />}
              {/* Hit target taller than the bar */}
              <rect
                x={pad.left + i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <title>{label(d)}</title>
              </rect>
            </g>
          )
        })}
        <text x={0} y={H - 4} className="chart-tick">
          {dateFmt.format(new Date(`${data[0].day}T00:00:00Z`))}
        </text>
        <text x={W} y={H - 4} textAnchor="end" className="chart-tick">
          Today
        </text>
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
