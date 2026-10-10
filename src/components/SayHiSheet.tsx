import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { Sheet } from './Sheet'
import { useAuth } from './AuthProvider'
import { useSignUp } from './SignUpSheet'
import { useToast } from './Toast'
import type { Listing } from '../lib/listings'
import { MESSAGE_MAX, startConversation } from '../lib/messages'
import { formatDates } from '../lib/format'
import { readLastSearch } from '../lib/lastSearch'
import { openToGroup, openToLabel, useMyGroup } from '../lib/gender'

const QUICK = ['Can I see it this week?', 'Are utilities included?', 'Is the landlord OK with a sublease?']

function openingLine(listing: Listing) {
  const { from, to } = readLastSearch()
  // Use the seeker's searched dates when they overlap this place; else the listing's.
  const useSearch = from && to && from <= listing.availableTo && to >= listing.availableFrom
  const dates = useSearch ? formatDates(from!, to!) : formatDates(listing.availableFrom, listing.availableTo)
  return `Hi ${listing.lister.firstName}! Is your place still open for ${dates}?`
}

// Say hi: a prefilled first message, plus quick questions that each add a line.
// Signed out, Send opens sign-up and the message sends once they're verified.
export function SayHiSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { user, verified } = useAuth()
  const { open } = useSignUp()
  const navigate = useNavigate()
  const toast = useToast()
  const [text, setText] = useState(() => openingLine(listing))
  const [sending, setSending] = useState(false)
  const name = listing.lister.firstName
  const myGroup = useMyGroup()
  const notForMe = !!myGroup && !openToGroup(listing.openTo, myGroup)

  function toggleQuick(q: string) {
    setText((t) => (t.includes(q) ? t.replace(`\n${q}`, '').replace(q, '').trim() : `${t.trim()}\n${q}`))
  }

  async function send() {
    if (!text.trim() || sending) return
    if (!verified || !user) {
      onClose()
      open({ reason: 'say-hi', listerName: name, listingId: listing.id, message: text.trim() })
      return
    }
    setSending(true)
    try {
      const id = await startConversation(listing, user, text)
      onClose()
      navigate(`/messages/${id}`)
    } catch (e) {
      console.error('[handoff] say hi', e)
      toast("Couldn't send. Check your connection and try again.")
      setSending(false)
    }
  }

  return (
    <Sheet title={`Say hi to ${name}`} onClose={onClose} busy={sending}>
      {notForMe && (
        <p className="caption muted">
          {name} listed this as {openToLabel(listing.openTo).toLowerCase()}. You can still say hi.
        </p>
      )}
      <div className="field">
        <label htmlFor="sayhi-text" className="sr-only">
          Your message
        </label>
        <textarea
          id="sayhi-text"
          className="input textarea"
          rows={4}
          maxLength={MESSAGE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="chips-wrap" aria-label="Quick questions">
        {QUICK.map((q) => {
          const on = text.includes(q)
          return (
            <button key={q} type="button" className={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={() => toggleQuick(q)}>
              {on && <Check size={14} strokeWidth={2} aria-hidden="true" />}
              {q}
            </button>
          )
        })}
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={sending || !text.trim()}>
        {sending ? 'Sending…' : 'Send'}
      </button>
      <p className="caption muted center">Never send a deposit before you've seen the place and the lease.</p>
    </Sheet>
  )
}
