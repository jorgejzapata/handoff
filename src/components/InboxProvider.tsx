import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { subscribeConversations } from '../lib/messages'
import type { Conversation } from '../lib/messages'

// One live listener on the student's threads, shared by the nav badge,
// the inbox and the listing page's "Open chat" button.
interface InboxState {
  conversations: Conversation[] | null
  unreadTotal: number
  error: boolean
}

const InboxContext = createContext<InboxState>({ conversations: null, unreadTotal: 0, error: false })
export const useInbox = () => useContext(InboxContext)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { user, member } = useAuth()
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [error, setError] = useState(false)
  const uid = member ? user?.uid : undefined

  useEffect(() => {
    setConversations(null)
    setError(false)
    if (!uid) return
    return subscribeConversations(uid, setConversations, (e) => {
      console.error('[handoff] inbox', e)
      setError(true)
    })
  }, [uid])

  const unreadTotal = uid
    ? (conversations ?? []).reduce((n, c) => n + (c.blockedBy ? 0 : c.unreadCount[uid] ?? 0), 0)
    : 0

  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) Handoff` : 'Handoff'
  }, [unreadTotal])

  return <InboxContext.Provider value={{ conversations, unreadTotal, error }}>{children}</InboxContext.Provider>
}
