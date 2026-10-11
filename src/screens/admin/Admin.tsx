import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert, CircleCheck, Flag, RotateCw, Search } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import { useToast } from '../../components/Toast'
import { Sheet } from '../../components/Sheet'
import {
  GOALS,
  checkIsAdmin,
  computeDemographics,
  computeMetrics,
  dismissReports,
  fetchAdminData,
  fetchViews7d,
  setListingStatus,
  suspendUser,
  unsuspendUser,
} from '../../lib/admin'
import type { AdminReport, AdminUser, Suspension } from '../../lib/admin'
import type { Listing } from '../../lib/listings'
import { isPastExpiry } from '../../lib/listings'
import { formatRent, formatShortDate } from '../../lib/format'
import { REPORT_REASONS } from '../../lib/reports'
import { BarChart } from './BarChart'

type Tab = 'overview' | 'reports' | 'listings' | 'users'

// Non-admins see the same page as any unknown URL, not "access denied".
export default function AdminGate() {
  const { user, loading } = useAuth()
  const [state, setState] = useState<'checking' | 'yes' | 'no'>('checking')

  useEffect(() => {
    if (loading) return
    checkIsAdmin(user).then((ok) => setState(ok ? 'yes' : 'no'))
  }, [user, loading])

  if (state === 'checking') return null
  if (state === 'no') {
    return (
      <div className="page empty">
        <p className="heading">This page wandered off.</p>
        <Link to="/listings" className="btn btn-secondary">
          Browse places
        </Link>
      </div>
    )
  }
  return <Admin />
}

interface Data {
  listings: Listing[]
  users: AdminUser[]
  reports: AdminReport[]
  suspensions: Suspension[]
}

// The one dialog every admin action goes through: a required one-line reason.
interface PendingAction {
  title: string
  body: string
  action: string
  danger?: boolean
  run: (reason: string) => Promise<void>
}

function Admin() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<Data | null>(null)
  const [views7d, setViews7d] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [listingFilter, setListingFilter] = useState('')

  const load = useCallback(() => {
    setError(false)
    fetchAdminData()
      .then(setData)
      .catch((e) => {
        console.error('[handoff] admin', e)
        setError(true)
      })
    fetchViews7d().then(setViews7d)
  }, [])

  useEffect(load, [load])

  const usersById = useMemo(() => new Map((data?.users ?? []).map((u) => [u.uid, u])), [data])
  const suspended = useMemo(() => new Map((data?.suspensions ?? []).map((s) => [s.uid, s])), [data])
  const openReports = (data?.reports ?? []).filter((r) => r.status === 'open')

  function act(p: PendingAction) {
    setPending({
      ...p,
      run: async (reason) => {
        await p.run(reason)
        toast('Done.')
        load()
      },
    })
  }

  const me = user!.uid

  // ---- Actions ----
  const hide = (l: Listing, reportIds: string[] = []) =>
    act({
      title: `Hide "${l.title}"?`,
      body: 'It leaves search right away. You can restore it later.',
      action: 'Hide listing',
      run: (reason) => setListingStatus(me, l.id, 'hidden', reason, reportIds),
    })
  const unhide = (l: Listing) =>
    act({
      title: `Restore "${l.title}"?`,
      body: 'It goes back into search.',
      action: 'Restore',
      run: (reason) => setListingStatus(me, l.id, 'active', reason),
    })
  const remove = (l: Listing, reportIds: string[] = []) =>
    act({
      title: `Remove "${l.title}"?`,
      body: "Removing can't be undone. The lister sees it's under review.",
      action: 'Remove listing',
      danger: true,
      run: (reason) => setListingStatus(me, l.id, 'removed', reason, reportIds),
    })
  const suspend = (u: AdminUser, reportIds: string[] = []) => {
    const live = (data?.listings ?? []).filter((l) => l.ownerId === u.uid && l.status === 'active').map((l) => l.id)
    act({
      title: `Suspend ${u.firstName || u.email}?`,
      body: `They can't post, message or report, and their ${live.length} live ${live.length === 1 ? 'listing is' : 'listings are'} hidden.`,
      action: 'Suspend',
      danger: true,
      run: (reason) => suspendUser(me, u.uid, reason, live, reportIds),
    })
  }
  const unsuspend = (u: AdminUser) =>
    act({
      title: `Lift ${u.firstName || u.email}'s suspension?`,
      body: 'Their hidden listings stay hidden until you restore them.',
      action: 'Lift suspension',
      run: (reason) => unsuspendUser(me, u.uid, reason),
    })
  const dismiss = (reportIds: string[]) =>
    act({
      title: reportIds.length === 1 ? 'Dismiss this report?' : `Dismiss ${reportIds.length} reports?`,
      body: 'Nothing changes for the listing or person.',
      action: 'Dismiss',
      run: (reason) => dismissReports(me, reportIds, reason),
    })

  const tabs: [Tab, string, number?][] = [
    ['overview', 'Overview'],
    ['reports', 'Reports', openReports.length],
    ['listings', 'Listings'],
    ['users', 'Users'],
  ]

  return (
    <div className="admin">
      <div className="admin-head">
        <h1 className="title">Admin</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          <RotateCw size={16} strokeWidth={1.5} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Admin sections">
        {tabs.map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'tab tab-on' : 'tab'}
            onClick={() => setTab(value)}
          >
            {label}
            {!!count && <span className="nav-badge nav-badge-inline">{count}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <div className="empty">
          <p className="heading">Couldn't load admin data.</p>
          <p className="muted">If you just deployed rules or indexes, give it a few minutes.</p>
          <button type="button" className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <div className="tiles-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="metric-tile skeleton-row" />
          ))}
        </div>
      ) : tab === 'overview' ? (
        <Overview data={data} views7d={views7d} onOpenReports={() => setTab('reports')} />
      ) : tab === 'reports' ? (
        <Reports
          data={data}
          usersById={usersById}
          suspended={suspended}
          onHide={hide}
          onRemove={remove}
          onSuspend={suspend}
          onDismiss={dismiss}
        />
      ) : tab === 'listings' ? (
        <ListingsTable
          listings={data.listings}
          reports={data.reports}
          usersById={usersById}
          ownerFilter={listingFilter}
          onClearOwner={() => setListingFilter('')}
          onHide={hide}
          onUnhide={unhide}
          onRemove={remove}
        />
      ) : (
        <UsersTable
          data={data}
          suspended={suspended}
          onViewListings={(uid) => {
            setListingFilter(uid)
            setTab('listings')
          }}
          onSuspend={suspend}
          onUnsuspend={unsuspend}
        />
      )}

      {pending && <ReasonDialog pending={pending} onClose={() => setPending(null)} />}
    </div>
  )
}

// ---------------- Overview ----------------

export function Overview({ data, views7d, onOpenReports }: { data: Data; views7d: number | null; onOpenReports: () => void }) {
  const m = computeMetrics(data.listings, data.users, data.reports)
  const who = computeDemographics(data.users)
  const boostsOn = m.activeListings >= GOALS.boostGate
  const delta = (now: number, before: number) => (now === before ? 'Same as last week' : `${now > before ? '+' : ''}${now - before} vs last week`)

  const unlocked: string[] = []
  if (m.activeListings >= GOALS.activeListings) unlocked.push('50+ live listings: time to expand to more campuses.')
  if (m.published >= 10 && m.filledPct >= GOALS.filledPct) unlocked.push('30%+ filled: time to pitch property managers.')

  return (
    <div className="admin-overview">
      {unlocked.map((u) => (
        <p key={u} className="notice phase-callout">
          <CircleCheck size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <strong>Phase unlocked.</strong> {u}
          </span>
        </p>
      ))}

      <div className="tiles-grid">
        <Tile label="Active listings" value={String(m.activeListings)} goal={`Goal: ${GOALS.activeListings}+ → expand campuses`} sub={`${m.newListingsThisWeek} new this week · ${delta(m.newListingsThisWeek, m.newListingsLastWeek)}`} met={m.activeListings >= GOALS.activeListings} />
        <Tile label="Listings filled" value={`${m.filledPct}%`} goal={`Goal: ${GOALS.filledPct}%+ → pitch property managers`} sub={`${m.filled} of ${m.published} published`} met={m.published >= 10 && m.filledPct >= GOALS.filledPct} />
        <Tile label="Filled through Handoff" value={m.filled ? `${m.filledViaPct}%` : '–'} goal='Lister answered "On Handoff"' sub={m.filled ? `of ${m.filled} filled` : 'No fills yet'} />
        <Tile label="Boost conversion" value="–" goal={`Goal: ${GOALS.boostConversionPct}%+ of listings`} sub={boostsOn ? 'Boosts not built yet' : `Boosts locked until ${GOALS.boostGate} live`} />
        <Tile label="Revenue per listing" value="$0" goal="Goal: rising month over month" sub="Starts with boosts" />
        <Tile label="Reports this week" value={String(m.reportsThisWeek)} goal="Spikes flag a trust problem" sub={`${m.openReports} open · ${delta(m.reportsThisWeek, m.reportsLastWeek)}`} warn={m.reportsThisWeek > Math.max(3, m.reportsLastWeek * 2)} onClick={m.openReports ? onOpenReports : undefined} />
        <Tile label="Members" value={String(m.students)} goal="Signed up" sub={`${m.newStudentsThisWeek} new this week`} />
        <Tile label="Verified students" value={String(who.verifiedStudents)} goal="Confirmed a .edu email" sub={who.total ? `${Math.round((who.verifiedStudents / who.total) * 100)}% of members` : 'No members yet'} />
        <Tile label="Listing views" value={views7d === null ? '–' : String(views7d)} goal="Last 7 days" sub={`${m.drafts} drafts in progress`} />
      </div>

      <div className="boost-gate">
        <div className="boost-gate-text">
          <span className="label">{boostsOn ? 'Boosts can launch' : `Boosts unlock at ${GOALS.boostGate} live listings`}</span>
          <span className="caption muted">
            {Math.min(m.activeListings, GOALS.boostGate)} / {GOALS.boostGate}
          </span>
        </div>
        <div className="progress boost-progress" role="progressbar" aria-valuemin={0} aria-valuemax={GOALS.boostGate} aria-valuenow={m.activeListings}>
          <div className="progress-fill" style={{ width: `${Math.min(100, (m.activeListings / GOALS.boostGate) * 100)}%` }} />
        </div>
      </div>

      <div className="charts-grid">
        <Breakdown title="Members by age" rows={who.ages} total={who.total} />
        <Breakdown title="Members by gender" rows={who.genders} total={who.total} />
        <BarChart title="New listings" unit="listing" data={m.newListingsByDay} />
        <BarChart title="Listings filled" unit="fill" data={m.fillsByDay} />
      </div>
    </div>
  )
}

// A simple share-of-members list: label, bar, count.
function Breakdown({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total: number }) {
  return (
    <figure className="chart breakdown">
      <figcaption className="label">{title}</figcaption>
      <ul className="breakdown-list">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="caption">{r.label}</span>
            <div className="progress" role="img" aria-label={`${r.label}: ${r.count} of ${total}`}>
              <div className="progress-fill" style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} />
            </div>
            <span className="caption muted">{r.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Tile({ label, value, goal, sub, met, warn, onClick }: { label: string; value: string; goal: string; sub: string; met?: boolean; warn?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      <span className="caption metric-goal">
        {met && <CircleCheck size={14} strokeWidth={2} aria-label="Goal met" />}
        {warn && <CircleAlert size={14} strokeWidth={2} aria-label="Higher than usual" />}
        {goal}
      </span>
      <span className="caption muted">{sub}</span>
    </>
  )
  return onClick ? (
    <button type="button" className={warn ? 'metric-tile metric-warn' : 'metric-tile'} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={met ? 'metric-tile metric-met' : warn ? 'metric-tile metric-warn' : 'metric-tile'}>{body}</div>
  )
}

// ---------------- Reports ----------------

const reasonLabel = new Map(REPORT_REASONS)

function Reports({
  data,
  usersById,
  suspended,
  onHide,
  onRemove,
  onSuspend,
  onDismiss,
}: {
  data: Data
  usersById: Map<string, AdminUser>
  suspended: Map<string, Suspension>
  onHide: (l: Listing, reportIds: string[]) => void
  onRemove: (l: Listing, reportIds: string[]) => void
  onSuspend: (u: AdminUser, reportIds: string[]) => void
  onDismiss: (reportIds: string[]) => void
}) {
  const [showClosed, setShowClosed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const listingsById = new Map(data.listings.map((l) => [l.id, l]))

  // One row per reported target, open ones first; hidden listings pin to the top.
  const groups = new Map<string, AdminReport[]>()
  for (const r of data.reports) {
    if (!showClosed && r.status !== 'open') continue
    const key = `${r.targetType}:${r.targetId}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const rows = [...groups.entries()].sort((a, b) => {
    const hiddenA = a[0].startsWith('listing:') && listingsById.get(a[0].slice(8))?.status === 'hidden' ? 1 : 0
    const hiddenB = b[0].startsWith('listing:') && listingsById.get(b[0].slice(8))?.status === 'hidden' ? 1 : 0
    return hiddenB - hiddenA || b[1].length - a[1].length
  })
  const current = selected ? groups.get(selected) : undefined

  return (
    <div className="admin-split">
      <div className="admin-list">
        <label className="toggle-row admin-closed-toggle">
          <span className="caption">Show dismissed and actioned</span>
          <input type="checkbox" role="switch" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          <span className="switch" aria-hidden="true" />
        </label>
        {rows.length === 0 ? (
          <div className="empty">
            <CircleCheck size={40} strokeWidth={1.5} aria-hidden="true" />
            <p className="heading">No open reports.</p>
          </div>
        ) : (
          <ul className="admin-rows">
            {rows.map(([key, reports]) => {
              const [type, id] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)]
              const listing = type === 'listing' ? listingsById.get(id) : undefined
              const person = type === 'user' ? usersById.get(id) : undefined
              const open = reports.filter((r) => r.status === 'open').length
              return (
                <li key={key}>
                  <button type="button" className={selected === key ? 'admin-row active' : 'admin-row'} onClick={() => setSelected(key)}>
                    <Flag size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span className="admin-row-main">
                      <span className="card-title">{listing?.title ?? person?.firstName ?? (type === 'user' ? 'Student' : 'Deleted listing')}</span>
                      <span className="caption muted">
                        {type} · {reasonLabel.get(reports[0].reason as never) ?? reports[0].reason} · {reports[0].createdAt ? formatShortDate(reports[0].createdAt.toISOString()) : ''}
                      </span>
                    </span>
                    {listing?.status === 'hidden' && <span className="status-chip status-muted">Needs review</span>}
                    <span className="count-pill">{open || reports.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <aside className="admin-detail">
        {!current || !selected ? (
          <p className="muted">Pick a report to see the details.</p>
        ) : (
          <ReportDetail
            targetKey={selected}
            reports={current}
            listing={selected.startsWith('listing:') ? listingsById.get(selected.slice(8)) : undefined}
            person={selected.startsWith('user:') ? usersById.get(selected.slice(5)) : undefined}
            usersById={usersById}
            suspended={suspended}
            onHide={onHide}
            onRemove={onRemove}
            onSuspend={onSuspend}
            onDismiss={onDismiss}
          />
        )}
      </aside>
    </div>
  )
}

function ReportDetail({
  reports,
  listing,
  person,
  usersById,
  suspended,
  onHide,
  onRemove,
  onSuspend,
  onDismiss,
}: {
  targetKey: string
  reports: AdminReport[]
  listing?: Listing
  person?: AdminUser
  usersById: Map<string, AdminUser>
  suspended: Map<string, Suspension>
  onHide: (l: Listing, reportIds: string[]) => void
  onRemove: (l: Listing, reportIds: string[]) => void
  onSuspend: (u: AdminUser, reportIds: string[]) => void
  onDismiss: (reportIds: string[]) => void
}) {
  const openIds = reports.filter((r) => r.status === 'open').map((r) => r.id)
  const owner = listing ? usersById.get(listing.ownerId) : person

  return (
    <div className="stack-12">
      {listing ? (
        <div className="card">
          <p className="eyebrow">Listing · {listing.status}</p>
          <p className="heading">{listing.title}</p>
          <p className="caption muted">
            {formatRent(listing.rentCents)} / mo · {listing.neighborhood} · by {owner?.firstName ?? 'unknown'} ({owner?.email ?? 'no email'})
          </p>
          {listing.moderationReason && <p className="caption">Last action: {listing.moderationReason}</p>}
          <Link to={`/listings/${listing.id}`} className="text-link caption" target="_blank">
            Open listing
          </Link>
        </div>
      ) : person ? (
        <div className="card">
          <p className="eyebrow">Student{suspended.has(person.uid) ? ' · suspended' : ''}</p>
          <p className="heading">{person.firstName}</p>
          <p className="caption muted">{person.email}</p>
        </div>
      ) : (
        <p className="notice caption">This target no longer exists.</p>
      )}

      <h3 className="label">Reports ({reports.length})</h3>
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.id} className="report-item">
            <span className="card-title">{reasonLabel.get(r.reason as never) ?? r.reason}</span>
            <span className="caption muted">
              {r.createdAt ? formatShortDate(r.createdAt.toISOString()) : ''} · by {usersById.get(r.reporterId)?.firstName ?? 'a student'} · {r.status}
            </span>
            {r.details && <span className="caption">“{r.details}”</span>}
            {r.adminNote && <span className="caption muted">Note: {r.adminNote}</span>}
          </li>
        ))}
      </ul>

      <div className="admin-actions">
        {openIds.length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDismiss(openIds)}>
            Dismiss
          </button>
        )}
        {listing && listing.status === 'active' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onHide(listing, openIds)}>
            Hide listing
          </button>
        )}
        {listing && listing.status !== 'removed' && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemove(listing, openIds)}>
            Remove listing
          </button>
        )}
        {owner && !suspended.has(owner.uid) && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => onSuspend(owner, openIds)}>
            Suspend {owner.firstName || 'user'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------- Listings ----------------

function ListingsTable({
  listings,
  reports,
  usersById,
  ownerFilter,
  onClearOwner,
  onHide,
  onUnhide,
  onRemove,
}: {
  listings: Listing[]
  reports: AdminReport[]
  usersById: Map<string, AdminUser>
  ownerFilter: string
  onClearOwner: () => void
  onHide: (l: Listing) => void
  onUnhide: (l: Listing) => void
  onRemove: (l: Listing) => void
}) {
  const [q, setQ] = useState('')
  const openCount = (id: string) => reports.filter((r) => r.targetType === 'listing' && r.targetId === id && r.status === 'open').length
  const statusOf = (l: Listing) => (l.status === 'active' && isPastExpiry(l) ? 'expired' : l.status)
  const shown = listings
    .filter((l) => l.status !== 'draft')
    .filter((l) => !ownerFilter || l.ownerId === ownerFilter)
    .filter((l) => {
      const owner = usersById.get(l.ownerId)
      const hay = `${l.title} ${l.neighborhood} ${owner?.firstName ?? ''} ${owner?.email ?? ''}`.toLowerCase()
      return hay.includes(q.trim().toLowerCase())
    })
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))

  return (
    <div>
      <div className="admin-search">
        <div className="input-icon">
          <Search size={18} strokeWidth={1.5} aria-hidden="true" />
          <input className="input" placeholder="Search title, area or lister" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search listings" />
        </div>
        {ownerFilter && (
          <button type="button" className="chip chip-on" onClick={onClearOwner}>
            One lister ✕
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Lister</th>
              <th>Status</th>
              <th>Posted</th>
              <th>Reports</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const owner = usersById.get(l.ownerId)
              const status = statusOf(l)
              return (
                <tr key={l.id}>
                  <td>
                    <Link to={`/listings/${l.id}`} target="_blank" className="card-title">
                      {l.title}
                    </Link>
                    <div className="caption muted">
                      {formatRent(l.rentCents)} / mo · {l.neighborhood}
                    </div>
                  </td>
                  <td>
                    {owner?.firstName ?? '–'}
                    <div className="caption muted">{owner?.email}</div>
                  </td>
                  <td>
                    <span className={`status-chip ${status === 'active' ? 'status-active' : status === 'filled' ? 'status-filled' : 'status-muted'}`}>{status}</span>
                  </td>
                  <td className="caption">{l.postedAt ? formatShortDate(l.postedAt) : '–'}</td>
                  <td>{openCount(l.id) || ''}</td>
                  <td className="row-actions">
                    {l.status === 'active' && (
                      <button type="button" className="link-btn" onClick={() => onHide(l)}>
                        Hide
                      </button>
                    )}
                    {l.status === 'hidden' && (
                      <button type="button" className="link-btn" onClick={() => onUnhide(l)}>
                        Restore
                      </button>
                    )}
                    {l.status !== 'removed' && (
                      <button type="button" className="link-btn danger-link" onClick={() => onRemove(l)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="muted empty-line">No listings match.</p>}
      </div>
    </div>
  )
}

// ---------------- Users ----------------

function UsersTable({
  data,
  suspended,
  onViewListings,
  onSuspend,
  onUnsuspend,
}: {
  data: Data
  suspended: Map<string, Suspension>
  onViewListings: (uid: string) => void
  onSuspend: (u: AdminUser) => void
  onUnsuspend: (u: AdminUser) => void
}) {
  const [q, setQ] = useState('')
  const listingCount = (uid: string) => data.listings.filter((l) => l.ownerId === uid && l.status !== 'draft').length
  const reportsAgainst = (uid: string) => {
    const theirListings = new Set(data.listings.filter((l) => l.ownerId === uid).map((l) => l.id))
    return data.reports.filter((r) => (r.targetType === 'user' && r.targetId === uid) || (r.targetType === 'listing' && theirListings.has(r.targetId))).length
  }
  const shown = data.users
    .filter((u) => `${u.firstName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))

  return (
    <div>
      <div className="admin-search">
        <div className="input-icon">
          <Search size={18} strokeWidth={1.5} aria-hidden="true" />
          <input className="input" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        </div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Joined</th>
              <th>Listings</th>
              <th>Reports</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const susp = suspended.get(u.uid)
              const count = listingCount(u.uid)
              return (
                <tr key={u.uid}>
                  <td>
                    <span className="card-title">{u.firstName || '–'}</span>
                    <div className="caption muted">{u.email}</div>
                  </td>
                  <td className="caption">{u.createdAt ? formatShortDate(u.createdAt.toISOString()) : '–'}</td>
                  <td>
                    {count > 0 ? (
                      <button type="button" className="link-btn" onClick={() => onViewListings(u.uid)}>
                        {count}
                      </button>
                    ) : (
                      0
                    )}
                  </td>
                  <td>{reportsAgainst(u.uid) || ''}</td>
                  <td>
                    {susp ? (
                      <span className="status-chip status-danger" title={susp.reason}>
                        Suspended
                      </span>
                    ) : (
                      <span className="status-chip status-active">Active</span>
                    )}
                  </td>
                  <td className="row-actions">
                    {susp ? (
                      <button type="button" className="link-btn" onClick={() => onUnsuspend(u)}>
                        Lift
                      </button>
                    ) : (
                      <button type="button" className="link-btn danger-link" onClick={() => onSuspend(u)}>
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="muted empty-line">No students match.</p>}
      </div>
    </div>
  )
}

// ---------------- Reason dialog ----------------

function ReasonDialog({ pending, onClose }: { pending: PendingAction; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function go(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim() || busy) return
    setBusy(true)
    setError(false)
    try {
      await pending.run(reason.trim())
      onClose()
    } catch (err) {
      console.error('[handoff] admin action', err)
      setError(true)
      setBusy(false)
    }
  }

  return (
    <Sheet title={pending.title} onClose={onClose} busy={busy}>
      <p className="muted">{pending.body}</p>
      <form className="stack-12" onSubmit={go}>
        <div className="field">
          <label htmlFor="admin-reason">Reason (saved with the action)</label>
          <input id="admin-reason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Asked for a deposit over Zelle" />
        </div>
        {error && (
          <p className="form-error" role="alert">
            That didn't go through. Check the rules are deployed, then try again.
          </p>
        )}
        <button type="submit" className={pending.danger ? 'btn btn-danger btn-block' : 'btn btn-primary btn-block'} disabled={!reason.trim() || busy}>
          {busy ? 'Working…' : pending.action}
        </button>
      </form>
    </Sheet>
  )
}
