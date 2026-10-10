import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import { useInbox } from '../../components/InboxProvider'
import { useToast } from '../../components/Toast'
import { otherPerson } from '../../lib/messages'
import type { Conversation } from '../../lib/messages'
import { useActiveListings } from '../../lib/useListings'
import { Thread } from './Thread'

type Filter = 'all' | 'mine' | 'asked'

// Inbox on the left (desktop) or on its own (mobile); the open thread fills
// the rest. /messages shows the inbox, /messages/:id a thread.
export default function Messages() {
  const { id } = useParams()
  return (
    <div className={id ? 'messages has-thread' : 'messages'}>
      <section className="inbox-pane" aria-label="Conversations">
        <Inbox activeId={id} />
      </section>
      <section className="thread-pane">
        {id ? (
          <Thread key={id} id={id} />
        ) : (
          <div className="empty desktop-only">
            <MessageCircle size={48} strokeWidth={1.5} aria-hidden="true" />
            <p className="heading">Pick a conversation</p>
          </div>
        )}
      </section>
    </div>
  )
}

function Inbox({ activeId }: { activeId?: string }) {
  const { user } = useAuth()
  const { conversations, error } = useInbox()
  const { listings } = useActiveListings()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const me = user?.uid ?? ''

  if (error) {
    return (
      <div className="empty">
        <p className="heading">Couldn't load your messages.</p>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  const all = conversations ?? []
  const mine = all.filter((c) => c.listerId === me)
  const asked = all.filter((c) => c.seekerId === me)
  const shown = filter === 'mine' ? mine : filter === 'asked' ? asked : all
  const myLive = (listings ?? []).find((l) => l.ownerId === me)

  return (
    <div className="inbox">
      <h1 className="title inbox-title">Messages</h1>

      {mine.length > 0 && asked.length > 0 && (
        <div className="chip-row inbox-chips" role="toolbar" aria-label="Filter conversations">
          {(
            [
              ['all', 'All'],
              ['mine', 'Your listings'],
              ['asked', 'Places you asked about'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'chip chip-on' : 'chip'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {conversations === null ? (
        <div aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="thread-row skeleton-row" />
          ))}
        </div>
      ) : all.length === 0 ? (
        myLive ? (
          <div className="empty">
            <MessageCircle size={48} strokeWidth={1.5} aria-hidden="true" />
            <p className="heading">No messages yet.</p>
            <p className="muted">Share your listing to get it in front of more Rams.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/listings/${myLive.id}`).catch(() => {})
                toast('Link copied')
              }}
            >
              Copy link
            </button>
          </div>
        ) : (
          <div className="empty">
            <MessageCircle size={48} strokeWidth={1.5} aria-hidden="true" />
            <p className="heading">No messages yet.</p>
            <p className="muted">Find a place you like and say hi.</p>
            <Link to="/listings" className="btn btn-secondary">
              Browse places
            </Link>
          </div>
        )
      ) : (
        <ul className="thread-list">
          {shown.map((c) => (
            <li key={c.id}>
              <ThreadRow c={c} me={me} active={c.id === activeId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ThreadRow({ c, me, active }: { c: Conversation; me: string; active: boolean }) {
  const other = otherPerson(c, me)
  const unread = !c.blockedBy && (c.unreadCount[me] ?? 0) > 0
  const preview = c.lastMessage.senderId === me ? `You: ${c.lastMessage.text}` : c.lastMessage.text
  const closed = c.blockedBy ? 'Closed' : c.closedReason === 'filled' ? 'Filled' : c.closedReason === 'expired' ? 'Expired' : null

  return (
    <Link to={`/messages/${c.id}`} className={active ? 'thread-row active' : 'thread-row'} aria-current={active ? 'page' : undefined}>
      {c.listingThumbUrl ? (
        <img src={c.listingThumbUrl} alt="" className="thread-thumb" />
      ) : (
        <span className="thread-thumb" aria-hidden="true" />
      )}
      <span className="thread-text">
        <span className="thread-top">
          <span className={unread ? 'thread-name unread' : 'thread-name'}>{other.firstName}</span>
          <span className="caption muted">{formatWhen(c.lastMessage.sentAt ?? c.updatedAt)}</span>
        </span>
        <span className="caption muted thread-title">{c.listingTitle}</span>
        <span className={unread ? 'thread-preview unread' : 'thread-preview'}>{preview}</span>
      </span>
      {unread && <span className="unread-dot" aria-label={`${c.unreadCount[me]} unread`} />}
      {closed && <span className="status-chip status-muted">{closed}</span>}
    </Link>
  )
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatWhen(d: Date | null) {
  if (!d) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return timeFmt.format(d)
  if (now.getTime() - d.getTime() < 6 * 24 * 60 * 60 * 1000) return dayFmt.format(d)
  return dateFmt.format(d)
}
