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
// internal accounts. The app uses them for display; the server decides the
// real price at Publish (functions/src/listingFee.ts), and the Firestore rules
// stop the app publishing for free once the fee is due.

export const FREE_LISTINGS = 50 // default; config/pricing.freeListings overrides it
export const LISTING_FEE_CENTS = 100

// How the $1 is collected, from config/pricing.listingFee (set in the
// Firebase console, no redeploy):
//   'stripe' real Stripe Checkout (test keys on dev, live keys on prod)
//   'test'   a fake checkout, no card, no charge (dev only)
//   'off'    no fee; posting stays free past the free spots
// With no config doc: 'test' on dev, 'off' on prod. A real student never sees
// a fake payment screen.
export type CheckoutMode = 'test' | 'stripe' | 'off'

export interface ListingStats {
  published: number
  live: number
  free: number // free spots before the fee, config/pricing.freeListings
  checkout: CheckoutMode
}

function modeFrom(v: unknown): CheckoutMode {
  if (v === 'stripe') return 'stripe'
  if (v === 'off') return 'off'
  if (v === 'test') return isProd ? 'off' : 'test'
  return isProd ? 'off' : 'test'
}

// Dev only: preview the paid side without posting 50 listings. Open any page
// with ?devPublished=60 (and optionally &devLive=30); ?devPublished=clear resets.
function devOverride(): Partial<Pick<ListingStats, 'published' | 'live'>> {
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

type Raw = { stats?: Record<string, unknown>; config?: Record<string, unknown> }

function combine(r: Raw): ListingStats {
  const n = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 ? v : d)
  return {
    published: n(r.stats?.published, 0),
    live: n(r.stats?.live, 0),
    free: n(r.config?.freeListings, FREE_LISTINGS),
    checkout: modeFrom(r.config?.listingFee),
    ...devOverride(),
  }
}

// Live counts and pricing switches, or null while loading. Missing docs read
// as zero listings and the defaults above: free, boosts locked.
export function useListingStats() {
  const [stats, setStats] = useState<ListingStats | null>(cached)
  useEffect(() => {
    const raw: Raw = {}
    let got = 0
    const push = () => {
      if (got < 2) return
      cached = combine(raw)
      setStats(cached)
    }
    const watch = (path: 'stats/listings' | 'config/pricing', key: keyof Raw) =>
      onSnapshot(
        doc(db, path),
        (snap) => {
          raw[key] = snap.data()
          if (!(key in seen)) got++
          seen[key] = true
          push()
        },
        () => {
          if (!(key in seen)) got++
          seen[key] = true
          push()
        },
      )
    const seen: Partial<Record<keyof Raw, true>> = {}
    const a = watch('stats/listings', 'stats')
    const b = watch('config/pricing', 'config')
    return () => {
      a()
      b()
    }
  }, [])
  return stats
}

// One read, for code that isn't a component (finishing a publish after
// sign-up). Fails open: if nothing can be read, posting is free.
export async function fetchListingStats(): Promise<ListingStats> {
  const read = (path: string) =>
    getDoc(doc(db, path))
      .then((d) => d.data())
      .catch(() => undefined)
  const [stats, config] = await Promise.all([read('stats/listings'), read('config/pricing')])
  cached = combine({ stats, config })
  return cached
}

export function freeSpotsLeft(s: ListingStats) {
  return Math.max(0, s.free - s.published)
}

// Does the next listing published cost $1?
export function listingFeeApplies(s: ListingStats | null) {
  return !!s && s.checkout !== 'off' && s.published >= s.free
}

export function boostsUnlocked(s: ListingStats | null) {
  return !!s && s.live >= BOOST_GATE
}

// One line for anywhere posting is offered, so the price is never a surprise.
export function postingPriceLine(s: ListingStats | null) {
  if (!s) return `Free for the first ${FREE_LISTINGS} places.`
  if (listingFeeApplies(s)) return '$1 to post, one time. Browsing is always free.'
  const left = freeSpotsLeft(s)
  if (left <= 0) return 'Posting is free right now.'
  return left === 1 ? 'Free to post. 1 free spot left.' : `Free to post. ${left} of ${s.free} free spots left.`
}
