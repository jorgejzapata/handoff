import { useEffect, useState } from 'react'
import { fetchActiveListings } from './listings'
import type { Listing } from './listings'

// Live listings, newest first. At one campus this is a small list, so
// filtering and sorting happen in the browser.
let cache: { at: number; listings: Listing[] } | null = null

export function useActiveListings() {
  const fresh = cache && Date.now() - cache.at < 30_000
  const [listings, setListings] = useState<Listing[] | null>(fresh ? cache!.listings : null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    fetchActiveListings()
      .then((l) => {
        cache = { at: Date.now(), listings: l }
        if (alive) setListings(l)
      })
      .catch((e) => {
        console.error('[handoff] listings', e)
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [])

  return { listings, loading: listings === null && !error, error }
}

export function clearListingsCache() {
  cache = null
}
