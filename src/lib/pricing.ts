import { useEffect, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db, isProd } from './firebase'
import { BOOST_GATE } from './boosts'

// What posting costs, and the live counts that decide it.
//
//   Listings 1–50 (ever published): free
//   Listing 51 and on: $1 one time, for everyone
//   Viewing: always free
//
// The counts come from stats/listings, kept by a Cloud Function that skips
// internal accounts. The app only uses them for display; once Stripe is in,
// the server decides the real price at Publish.

export const FREE_LISTINGS = 50 // keep in sync with functions/src/stats.ts
export const LISTING_FEE_CENTS = 100

// How the $1 is collected:
//   'test'   a test checkout, no card, no charge (handoff-dev and localhost)
//   'stripe' real Stripe Checkout (not built yet)
//   'off'    no fee is taken; posting stays free past listing 50
// Prod stays 'off' until Stripe is wired, so a real student never sees a fake
// payment screen.
export type CheckoutMode = 'test' | 'stripe' | 'off'
export const LISTING_CHECKOUT: CheckoutMode = isProd ? 'off' : 'test'

export interface ListingStats {
  published: number
  live: number
}

// Dev only: preview the paid side without posting 50 listings. Open any page
// with ?devPublished=60 (and optionally &devLive=30); ?devPublished=clear resets.
function devOverride(): Partial<ListingStats> {
  if (isProd || typeof window === 'undefined') return {}
  try {
    const q = new URLSearchParams(window.location.search)
    for (const key of ['devPublished', 'devLive']) {
      const v = q.get(key)
      if (v === 'clear') sessionStorage.removeItem(`handoff.${key}`)
      else if (v && /^\d+$/.test(v)) sessionStorage.setItem(`handoff.${key}`, v)
    }
    const p = sessionStorage.getItem('handoff.devPublished')
    const l = sessionStorage.getItem('handoff.devLive')
    return { ...(p ? { published: Number(p) } : {}), ...(l ? { live: Number(l) } : {}) }
  } catch {
    return {}
  }
}

let cached: ListingStats | null = null

// Live counts, or null while loading. If the stats doc doesn't exist yet
// (functions not deployed), everything reads as zero: free, boosts locked.
export function useListingStats() {
  const [stats, setStats] = useState<ListingStats | null>(cached)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'stats', 'listings'),
        (snap) => {
          const d = snap.data()
          cached = {
            published: typeof d?.published === 'number' ? d.published : 0,
            live: typeof d?.live === 'number' ? d.live : 0,
            ...devOverride(),
          }
          setStats(cached)
        },
        () => {
          cached = { published: 0, live: 0, ...devOverride() }
          setStats(cached)
        },
      ),
    [],
  )
  return stats
}

// One read, for code paths that aren't components (finishing a publish after
// sign-up). Fails open: if the count can't be read, posting is free.
export async function fetchListingStats(): Promise<ListingStats> {
  try {
    const d = (await getDoc(doc(db, 'stats', 'listings'))).data()
    cached = {
      published: typeof d?.published === 'number' ? d.published : 0,
      live: typeof d?.live === 'number' ? d.live : 0,
      ...devOverride(),
    }
  } catch {
    cached = { published: 0, live: 0, ...devOverride() }
  }
  return cached
}

export function freeSpotsLeft(s: ListingStats) {
  return Math.max(0, FREE_LISTINGS - s.published)
}

// Does the next listing published cost $1?
export function listingFeeApplies(s: ListingStats | null) {
  return LISTING_CHECKOUT !== 'off' && !!s && s.published >= FREE_LISTINGS
}

export function boostsUnlocked(s: ListingStats | null) {
  return !!s && s.live >= BOOST_GATE
}

// One line for anywhere posting is offered, so the price is never a surprise.
export function postingPriceLine(s: ListingStats | null) {
  if (!s) return 'Free for the first 50 places.'
  if (listingFeeApplies(s)) return '$1 to post, one time. Browsing is always free.'
  const left = freeSpotsLeft(s)
  if (left <= 0) return 'Posting is free right now.'
  return left === 1 ? 'Free to post. 1 free spot left.' : `Free to post. ${left} of ${FREE_LISTINGS} free spots left.`
}
