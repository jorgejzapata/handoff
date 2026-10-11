import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { useToast } from './Toast'
import { saveListing, subscribeSaved, unsaveListing } from '../lib/saved'
import type { SavedEntry } from '../lib/saved'
import type { Listing } from '../lib/listings'

// One live listener on the student's saved places, shared by every heart and
// the Saved tab.
interface SavedState {
  saved: SavedEntry[] | null
  error: boolean
  isSaved: (listingId: string) => boolean
  toggle: (listing: Listing) => Promise<void>
  remove: (listingId: string) => Promise<void>
}

const SavedContext = createContext<SavedState>({
  saved: null,
  error: false,
  isSaved: () => false,
  toggle: async () => {},
  remove: async () => {},
})
export const useSaved = () => useContext(SavedContext)

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user, member } = useAuth()
  const toast = useToast()
  const [saved, setSaved] = useState<SavedEntry[] | null>(null)
  const [error, setError] = useState(false)
  const uid = member ? user?.uid : undefined

  useEffect(() => {
    setSaved(null)
    setError(false)
    if (!uid) return
    return subscribeSaved(uid, setSaved, (e) => {
      console.error('[handoff] saved', e)
      setError(true)
    })
  }, [uid])

  const ids = useMemo(() => new Set((saved ?? []).map((s) => s.listingId)), [saved])
  const isSaved = useCallback((id: string) => ids.has(id), [ids])

  const toggle = useCallback(
    async (l: Listing) => {
      if (!uid) return
      try {
        if (ids.has(l.id)) {
          await unsaveListing(uid, l.id)
          toast('Removed from Saved', { label: 'Undo', onClick: () => void saveListing(uid, l).catch(() => {}) })
        } else {
          await saveListing(uid, l)
          toast('Saved')
        }
      } catch (e) {
        console.error('[handoff] save', e)
        toast("Couldn't save that. Try again in a minute.")
      }
    },
    [uid, ids, toast],
  )

  // For places that are gone: no undo, since a filled place can't be re-saved.
  const remove = useCallback(
    async (id: string) => {
      if (!uid) return
      await unsaveListing(uid, id).catch((e) => {
        console.error('[handoff] unsave', e)
        toast("Couldn't remove that. Try again in a minute.")
      })
    },
    [uid, toast],
  )

  return <SavedContext.Provider value={{ saved, error, isSaved, toggle, remove }}>{children}</SavedContext.Provider>
}
