import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db, functions } from './firebase'
import { track } from './track'

// Keep in sync with functions/src/boosts.ts. The server decides the real
// price and the gate; these are for display only.
export const BOOST_GATE = 15
export const STUDENT_DISCOUNT = 0.2

export type Tier = '7d' | '30d'

export const TIERS: Record<Tier, { days: number; cents: number; label: string }> = {
  '7d': { days: 7, cents: 500, label: '7 days' },
  '30d': { days: 30, cents: 1500, label: '30 days' },
}

export function priceFor(tier: Tier, student: boolean) {
  const base = TIERS[tier].cents
  return student ? Math.round(base * (1 - STUDENT_DISCOUNT)) : base
}

export function formatCents(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

// A new boost stacks on the end of a running one.
export function endDateFor(tier: Tier, boostedUntil?: string, now = new Date()) {
  const current = boostedUntil ? new Date(boostedUntil) : null
  const from = current && current > now ? current : now
  return new Date(from.getTime() + TIERS[tier].days * 24 * 60 * 60 * 1000)
}

export async function startBoostCheckout(listingId: string, tier: Tier, amountCents: number) {
  track('boost_checkout_started', { listing_id: listingId, tier, value: amountCents / 100, currency: 'USD' })
  const res = await httpsCallable<{ listingId: string; tier: Tier }, { url: string; orderId: string }>(
    functions,
    'createBoostCheckout',
  )({ listingId, tier })
  return res.data
}

export interface BoostOrder {
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
  listingId: string
  tier: Tier
  amountCents: number
  endsAt?: Date
}

export function watchOrder(orderId: string, onChange: (o: BoostOrder | null) => void, onError: (e: Error) => void) {
  return onSnapshot(
    doc(db, 'boostOrders', orderId),
    (snap) => {
      const d = snap.data()
      if (!d) return onChange(null)
      onChange({
        status: d.status,
        listingId: d.listingId,
        tier: d.tier,
        amountCents: d.amountCents,
        endsAt: d.endsAt instanceof Timestamp ? d.endsAt.toDate() : undefined,
      })
    },
    onError,
  )
}
