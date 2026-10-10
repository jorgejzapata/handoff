import { Linkify } from '../../components/Linkify'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ArrowUp, BadgeCheck, EllipsisVertical, FileText, Info, MapPin, Paperclip, RotateCw, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/Sheet'
import { ReportSheet } from '../../components/ReportSheet'
import { MarkFilledSheet } from '../../components/MarkFilledSheet'
import {
  MESSAGE_MAX,
  blockPerson,
  formatAddress,
  markRead,
  mentionsMoney,
  otherPerson,
  sendMessage,
  subscribeConversation,
  subscribeMessages,
} from '../../lib/messages'
import type { Conversation, Message } from '../../lib/messages'
import { fetchPrivateLocation } from '../../lib/listings'
import { formatDates, formatRent } from '../../lib/format'
import { formatBytes, isAllowedFile, uploadAttachment } from '../../lib/attachments'
import type { Attachment } from '../../lib/attachments'

// A photo or PDF picked in the composer, uploading or ready to send.
interface PendingFile {
  key: string
  name: string
  kind: 'image' | 'file'
  preview?: string
  progress: number
  attachment?: Attachment
  failed: boolean
  file: File
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function dayLabel(d: Date) {
  const today = new Date()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dayFmt.format(d)
}

type Overlay = 'menu' | 'block' | 'report' | 'address' | 'filled' | null

export function Thread({ id }: { id: string }) {
  const { user } = useAuth()
  const me = user?.uid ?? ''
  const navigate = useNavigate()
  const toast = useToast()

  const [conv, setConv] = useState<Conversation | null | undefined>(undefined)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadError, setLoadError] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [openTime, setOpenTime] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)

  useEffect(() => subscribeConversation(id, setConv, () => setLoadError(true)), [id])
  useEffect(() => subscribeMessages(id, setMessages, () => setLoadError(true)), [id])

  // Clear my unread count while I'm looking at the thread.
  useEffect(() => {
    if (!conv || !me || document.visibilityState !== 'visible') return
    markRead(conv, me).catch(() => {})
  }, [conv, me])

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  // Composer grows with the text, up to 5 lines.
  useLayoutEffect(() => {
    const el = composer.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 5 * 20 + 24)}px`
  }, [draft])

  if (loadError || conv === null) {
    return (
      <div className="empty">
        <p className="heading">This conversation isn't available.</p>
        <Link to="/messages" className="btn btn-secondary">
          Back to messages
        </Link>
      </div>
    )
  }
  if (!conv) return <div className="thread" aria-busy="true" />

  const other = otherPerson(conv, me)
  const isLister = conv.listerId === me
  const closed = !!conv.closedReason || !!conv.blockedBy
  const otherReadAt = conv.lastReadAt[other.id]
  const lastMine = [...messages].reverse().find((m) => m.senderId === me && m.type !== 'system')
  const seen = !!(lastMine?.sentAt && otherReadAt && otherReadAt >= lastMine.sentAt)

  async function send(text = draft, type: 'text' | 'address' = 'text') {
    if (!conv || sending) return
    // A photo or PDF goes out with whatever's typed as its caption.
    if (type === 'text' && pendingFile) {
      if (!pendingFile.attachment) return
      const pf = pendingFile
      setSending(true)
      setDraft('')
      setPendingFile(null)
      try {
        await sendMessage(conv, me, text, pf.kind, pf.attachment)
        if (pf.preview) URL.revokeObjectURL(pf.preview)
      } catch (e) {
        console.error('[handoff] send attachment', e)
        setDraft(text)
        setPendingFile(pf)
        toast('Not sent. Check your connection and tap send again.')
      } finally {
        setSending(false)
      }
      return
    }
    if (!text.trim()) return
    setSending(true)
    if (type === 'text') setDraft('')
    try {
      await sendMessage(conv, me, text, type)
    } catch (e) {
      console.error('[handoff] send', e)
      if (type === 'text') setDraft(text)
      toast('Not sent. Check your connection and tap send again.')
    } finally {
      setSending(false)
    }
  }

  async function upload(pf: PendingFile) {
    setPendingFile({ ...pf, failed: false, progress: 0 })
    try {
      const attachment = await uploadAttachment(me, conv!.id, pf.file, (p) =>
        setPendingFile((cur) => (cur?.key === pf.key ? { ...cur, progress: p } : cur)),
      )
      setPendingFile((cur) => (cur?.key === pf.key ? { ...cur, attachment, progress: 1 } : cur))
    } catch (e) {
      console.error('[handoff] attachment upload', e)
      if ((e as Error).message === 'too-big') {
        toast('That PDF is over 10 MB. Try a smaller one.')
        setPendingFile(null)
        return
      }
      setPendingFile((cur) => (cur?.key === pf.key ? { ...cur, failed: true } : cur))
    }
  }

  function pickFile(file: File | undefined) {
    if (!file) return
    if (!isAllowedFile(file)) {
      toast('You can send photos and PDFs.')
      return
    }
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview)
    const kind = file.type === 'application/pdf' ? 'file' : 'image'
    const pf: PendingFile = {
      key: `${file.name}-${Date.now()}`,
      name: file.name,
      kind,
      preview: kind === 'image' ? URL.createObjectURL(file) : undefined,
      progress: 0,
      failed: false,
      file,
    }
    void upload(pf)
  }

  function clearFile() {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview)
    setPendingFile(null)
  }

  async function prepareAddress() {
    setOverlay(null)
    const loc = await fetchPrivateLocation(conv!.listingId)
    if (!loc) {
      toast("Couldn't find the address on this listing.")
      return
    }
    setAddress(formatAddress(loc))
    setOverlay('address')
  }

  const enterSends = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

  // Group messages under day dividers.
  let lastDay = ''

  return (
    <div className="thread">
      <header className="thread-head">
        <button type="button" className="icon-btn mobile-only" aria-label="Back to messages" onClick={() => navigate('/messages')}>
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        {other.photoUrl ? (
          <img src={other.photoUrl} alt="" className="avatar avatar-sm avatar-img" />
        ) : (
          <span className="avatar avatar-sm" aria-hidden="true">
            {other.firstName[0]}
          </span>
        )}
        <div className="thread-who">
          <p className="lister-name">{other.firstName}</p>
          <p className="verified caption">
            <BadgeCheck size={14} strokeWidth={1.5} aria-hidden="true" />
            Verified CSU student
          </p>
        </div>
        <div className="menu-wrap">
          <button
            type="button"
            className="icon-btn"
            aria-label="More options"
            aria-expanded={overlay === 'menu'}
            onClick={() => setOverlay(overlay === 'menu' ? null : 'menu')}
          >
            <EllipsisVertical size={20} strokeWidth={1.5} />
          </button>
          {overlay === 'menu' && (
            <div className="popover" role="menu">
              <Link role="menuitem" to={`/listings/${conv.listingId}`}>
                View listing
              </Link>
              {!conv.blockedBy && (
                <button role="menuitem" type="button" onClick={() => setOverlay('block')}>
                  Block {other.firstName}
                </button>
              )}
              <button role="menuitem" type="button" onClick={() => setOverlay('report')}>
                Report {other.firstName}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="listing-strip">
        <Link to={`/listings/${conv.listingId}`} className="listing-strip-link">
          {conv.listingThumbUrl ? <img src={conv.listingThumbUrl} alt="" className="thread-thumb" /> : <span className="thread-thumb" />}
          <span className="thread-text">
            <span className="card-title">{conv.listingTitle}</span>
            <span className="caption muted">
              {formatRent(conv.listingRentCents)} / mo · {formatDates(conv.listingFrom, conv.listingTo)}
            </span>
          </span>
        </Link>
        {conv.closedReason ? (
          <span className={conv.closedReason === 'filled' ? 'status-chip status-filled' : 'status-chip status-muted'}>
            {conv.closedReason === 'filled' ? 'Filled' : 'Expired'}
          </span>
        ) : isLister && !conv.blockedBy ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverlay('filled')}>
            Mark as filled
          </button>
        ) : (
          <span className="status-chip status-active">Active</span>
        )}
      </div>

      <div className="thread-body" onClick={() => overlay === 'menu' && setOverlay(null)}>
        <p className="notice caption thread-safety">
          <ShieldAlert size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>
            Never send a deposit before you've seen the place and the lease. Handoff will never ask you to pay in chat.{' '}
            <Link to="/safety" className="text-link">
              Safety tips
            </Link>
          </span>
        </p>

        {messages.map((m) => {
          const day = m.sentAt ? dayLabel(m.sentAt) : 'Today'
          const divider = day !== lastDay ? (lastDay = day) : null
          const mine = m.senderId === me
          return (
            <div key={m.id}>
              {divider && <p className="day-divider">{divider}</p>}
              {m.type === 'system' ? (
                <p className="system-line">{m.text}</p>
              ) : (
                <div className={mine ? 'bubble-row mine' : 'bubble-row'}>
                  <div
                    className={`bubble${mine ? ' mine' : ''}${m.type === 'address' ? ' bubble-address' : ''}${
                      m.type === 'image' ? ' bubble-image' : ''
                    }`}
                    onClick={() => setOpenTime(openTime === m.id ? null : m.id)}
                    title={m.sentAt ? timeFmt.format(m.sentAt) : undefined}
                  >
                    {m.type === 'address' ? (
                      <>
                        <span className="address-line">
                          <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                          {m.text}
                        </span>
                        <a
                          className="maps-link"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.text}, Fort Collins, CO`)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open in Maps
                        </a>
                      </>
                    ) : m.type === 'image' && m.attachment ? (
                      <>
                        <a href={m.attachment.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <img
                            src={m.attachment.url}
                            alt={m.text || `Photo from ${mine ? 'you' : other.firstName}`}
                            className="chat-photo"
                            width={m.attachment.width}
                            height={m.attachment.height}
                            loading="lazy"
                          />
                        </a>
                        {m.text && <span className="bubble-caption"><Linkify text={m.text} /></span>}
                      </>
                    ) : m.type === 'file' && m.attachment ? (
                      <>
                        <a
                          className="file-card"
                          href={m.attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText size={24} strokeWidth={1.5} aria-hidden="true" />
                          <span className="file-meta">
                            <span className="file-name">{m.attachment.name}</span>
                            <span className="caption">PDF · {formatBytes(m.attachment.size)} · Open</span>
                          </span>
                        </a>
                        {m.text && <span className="bubble-caption"><Linkify text={m.text} /></span>}
                      </>
                    ) : (
                      <Linkify text={m.text} />
                    )}
                  </div>
                  {(openTime === m.id || m.pending) && (
                    <span className="bubble-meta">{m.pending ? 'Sending…' : m.sentAt ? timeFmt.format(m.sentAt) : ''}</span>
                  )}
                  {!mine && m.type !== 'address' && mentionsMoney(m.text) && (
                    <span className="money-note">
                      <Info size={14} strokeWidth={1.5} aria-hidden="true" />
                      Heads up: don't send money before you've seen the place.
                    </span>
                  )}
                  {m.id === lastMine?.id && seen && !m.pending && <span className="bubble-meta">Seen</span>}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      {closed ? (
        <p className="thread-closed">
          {conv.blockedBy
            ? 'This conversation is closed.'
            : conv.closedReason === 'filled'
              ? 'This place was filled. You can still read this chat.'
              : 'This listing is no longer up. You can still read this chat.'}
        </p>
      ) : (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          {isLister && (
            <button type="button" className="chip share-address" onClick={prepareAddress}>
              <MapPin size={14} strokeWidth={1.5} aria-hidden="true" />
              Share address
            </button>
          )}
          {pendingFile && (
            <div className="attach-preview">
              {pendingFile.preview ? (
                <img src={pendingFile.preview} alt="" className="attach-thumb" />
              ) : (
                <span className="attach-thumb attach-pdf" aria-hidden="true">
                  <FileText size={22} strokeWidth={1.5} />
                </span>
              )}
              <span className="file-meta">
                <span className="file-name">{pendingFile.name}</span>
                <span className="caption muted">
                  {pendingFile.failed
                    ? "Didn't upload."
                    : pendingFile.attachment
                      ? 'Ready to send. Add a caption if you like.'
                      : `Uploading… ${Math.round(pendingFile.progress * 100)}%`}
                </span>
              </span>
              {pendingFile.failed && (
                <button type="button" className="icon-btn" aria-label="Retry upload" onClick={() => void upload(pendingFile)}>
                  <RotateCw size={18} strokeWidth={1.5} />
                </button>
              )}
              <button type="button" className="icon-btn" aria-label="Remove attachment" onClick={clearFile}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div className="composer-row">
            <button
              type="button"
              className="attach-btn"
              aria-label="Attach a photo or PDF"
              onClick={() => fileInput.current?.click()}
              disabled={sending}
            >
              <Paperclip size={20} strokeWidth={1.5} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,.heic,application/pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <label htmlFor="composer" className="sr-only">
              Message {other.firstName}
            </label>
            <textarea
              id="composer"
              ref={composer}
              className="composer-input"
              rows={1}
              maxLength={MESSAGE_MAX}
              placeholder={pendingFile ? 'Add a caption' : 'Message'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (enterSends && e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button
              type="submit"
              className="send-btn"
              aria-label="Send"
              disabled={sending || (pendingFile ? !pendingFile.attachment : !draft.trim())}
            >
              <ArrowUp size={20} strokeWidth={2} />
            </button>
          </div>
        </form>
      )}

      {overlay === 'block' && (
        <ConfirmDialog
          title={`Block ${other.firstName}?`}
          body="They can't message you, and this chat closes."
          action="Block"
          danger
          onConfirm={async () => {
            try {
              await blockPerson(conv, me)
              toast(`${other.firstName} is blocked.`)
            } catch {
              toast("Couldn't block. Try again in a minute.")
            }
          }}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'report' && (
        <ReportSheet
          targetType="user"
          targetId={other.id}
          title={`Report ${other.firstName}`}
          onBlock={conv.blockedBy ? undefined : () => setOverlay('block')}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'address' && address && (
        <ConfirmDialog
          title={`Share ${address} with ${other.firstName}?`}
          body="This is the only way your exact address leaves your account. Only share it once you're comfortable."
          action="Share address"
          onConfirm={() => send(address, 'address')}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'filled' && <MarkFilledSheet listingId={conv.listingId} onClose={() => setOverlay(null)} />}
    </div>
  )
}
