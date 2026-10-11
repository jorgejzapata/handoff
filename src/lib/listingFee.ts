import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db, functions } from './firebase'
import type { Lister } from './listings'

// The $1 listing fee through Stripe Checkout. The server decides whether the
// fee is due (functions/src/listingFee.ts); the webhook publishes the listing
// once Stripe says it's paid.

// The webhook publishes with whatever lister card the draft carries, so the
// draft gets it before checkout (the app adds it at Publish otherwise).
export async function stampLister(id: string, lister: Lister) {
  await updateDoc(doc(db, 'listings', id), {
    listerFirstName: lister.firstName,
    listerPhotoUrl: lister.photoUrl ?? null,
    listerYear: lister.year ?? null,
    listerSince: lister.since,
    listerVerified: lister.verified === true,
    updatedAt: serverTimestamp(),
  })
}

export async function startListingCheckout(listingId: string) {
  const res = await httpsCallable<{ listingId: string }, { free?: true; url?: string; orderId?: string }>(
    functions,
    'createListingCheckout',
  )({ listingId })
  return res.data
}

export interface ListingOrder {
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunding' | 'refunded'
  listingId: string
  amountCents: number
}

export function watchListingOrder(
  orderId: string,
  onChange: (o: ListingOrder | null) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    doc(db, 'listingOrders', orderId),
    (snap) => {
      const d = snap.data()
      onChange(d ? { status: d.status, listingId: d.listingId, amountCents: d.amountCents } : null)
    },
    onError,
  )
}
