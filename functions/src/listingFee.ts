import type Stripe from 'stripe'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl } from './env.js'
import { FREE_LISTINGS, publishedCount } from './stats.js'
import { STRIPE_SECRET_KEY, stripe } from './stripe.js'

// The $1 listing fee. Past the first FREE_LISTINGS published listings, a
// listing only goes live through here: the app asks for a Stripe Checkout
// session, and the webhook (stripeWebhook in boosts.ts) publishes the listing
// once Stripe says it's paid. The Firestore rules stop the app publishing on
// its own while config/pricing.listingFee is 'stripe' and the free spots are
// gone.
//
// Switch: config/pricing { listingFee: 'off' | 'test' | 'stripe' }, set in the
// Firebase console. Missing = 'off' in prod, 'test' (no real checkout) on dev.

export const LISTING_FEE_CENTS = 100
const LIFETIME_DAYS = 90
const DAY = 24 * 60 * 60 * 1000

async function feeMode() {
  const v = (await getFirestore().doc('config/pricing').get()).get('listingFee')
  return v === 'stripe' || v === 'test' ? v : 'off'
}

// Same checks as publishable() in firestore.rules: the webhook publishes with
// the Admin SDK, which skips the rules, so it checks here instead.
function publishable(l: FirebaseFirestore.DocumentData) {
  const has = (k: string) => l[k] !== undefined && l[k] !== null
  return (
    ['listingType', 'rentCents', 'availableFrom', 'availableTo', 'title', 'description', 'photos', 'approxLat',
      'approxLng', 'neighborhood', 'landlordStatus', 'leaseAckAt', 'listerFirstName', 'listerSince'].every(has) &&
    l.availableTo instanceof Timestamp &&
    l.availableFrom instanceof Timestamp &&
    l.availableTo.toMillis() > l.availableFrom.toMillis() &&
    typeof l.title === 'string' && l.title.trim().length >= 1 &&
    typeof l.description === 'string' && l.description.trim().length >= 50 &&
    Array.isArray(l.photos) && l.photos.length >= 1 &&
    l.leaseAckAt instanceof Timestamp
  )
}

// Move-out date or 90 days out, whichever is sooner (same as the app).
function expiryFor(availableTo: Timestamp, now = Date.now()) {
  const moveOut = new Date(`${availableTo.toDate().toISOString().slice(0, 10)}T23:59:59Z`).getTime()
  return Timestamp.fromMillis(Math.min(moveOut, now + LIFETIME_DAYS * DAY))
}

// Called from the $1 step. Returns { free: true } if this listing doesn't owe
// the fee (the app then publishes it as usual), or a Stripe Checkout URL.
export const createListingCheckout = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY], memory: '256MiB', maxInstances: 10 },
  async (req) => {
    const uid = req.auth?.uid
    if (!uid || req.auth?.token.firebase?.sign_in_provider === 'anonymous')
      throw new HttpsError('unauthenticated', 'Log in to publish.')

    const listingId = typeof req.data?.listingId === 'string' ? req.data.listingId : ''
    if (!listingId) throw new HttpsError('invalid-argument', 'Missing listing.')

    const db = getFirestore()
    if ((await db.doc(`suspensions/${uid}`).get()).exists)
      throw new HttpsError('permission-denied', 'Your account is paused.')

    const listing = (await db.doc(`listings/${listingId}`).get()).data()
    if (!listing || listing.ownerId !== uid) throw new HttpsError('not-found', "We couldn't find that listing.")
    if (listing.status !== 'draft') throw new HttpsError('failed-precondition', 'This listing is already live.')
    if (!publishable(listing))
      throw new HttpsError('failed-precondition', 'Something is missing. Check each step, then try again.')

    if ((await feeMode()) !== 'stripe' || (await publishedCount()) < FREE_LISTINGS) return { free: true }

    const order = db.collection('listingOrders').doc()
    const meta = { kind: 'listing', orderId: order.id, listingId, uid }
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: LISTING_FEE_CENTS,
            product_data: {
              name: 'Handoff listing fee',
              description: `One time, for “${String(listing.title).slice(0, 80)}”`,
            },
          },
        },
      ],
      client_reference_id: order.id,
      metadata: meta,
      payment_intent_data: { metadata: meta },
      customer_email: typeof req.auth?.token.email === 'string' ? req.auth.token.email : undefined,
      success_url: `${appUrl()}/post/paid?order=${order.id}`,
      cancel_url: `${appUrl()}/post?checkout=1&cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    await order.set({
      listingId,
      uid,
      provider: 'stripe',
      amountCents: LISTING_FEE_CENTS,
      stripeSessionId: session.id,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    })

    return { url: session.url, orderId: order.id }
  },
)

// From the webhook, on a paid listing-fee session: publish the listing. If it
// was already live (paid twice, or published another way), refund the $1.
export async function activateListingFee(s: Stripe.Checkout.Session, seen: FirebaseFirestore.DocumentReference) {
  const db = getFirestore()
  const { orderId, listingId } = s.metadata ?? {}
  if (!orderId || !listingId) {
    logger.error('Paid listing session missing metadata', { session: s.id })
    return
  }
  const paymentIntent = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null)

  const refund = await db.runTransaction(async (tx) => {
    if ((await tx.get(seen)).exists) return false
    const orderRef = db.doc(`listingOrders/${orderId}`)
    const listingRef = db.doc(`listings/${listingId}`)
    const [order, listing] = await Promise.all([tx.get(orderRef), tx.get(listingRef)])
    tx.create(seen, { type: 'checkout.session.completed', at: FieldValue.serverTimestamp() })
    if (order.data()?.status === 'paid') return false

    const l = listing.data()
    const canPublish = !!l && l.status === 'draft' && publishable(l)
    if (canPublish) {
      tx.update(listingRef, {
        status: 'active',
        publishedAt: FieldValue.serverTimestamp(),
        expiresAt: expiryFor(l.availableTo),
        updatedAt: FieldValue.serverTimestamp(),
        listingFeeOrderId: orderId,
      })
    }
    tx.set(
      orderRef,
      {
        status: canPublish ? 'paid' : 'refunding',
        amountCents: s.amount_total ?? LISTING_FEE_CENTS,
        stripePaymentIntentId: paymentIntent,
        paidAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    return !canPublish
  })

  if (refund && paymentIntent) {
    try {
      await stripe().refunds.create({ payment_intent: paymentIntent })
      await db.doc(`listingOrders/${orderId}`).update({ status: 'refunded', refundedAt: FieldValue.serverTimestamp() })
    } catch (e) {
      logger.error('Listing fee refund failed; refund it in the Stripe dashboard', { orderId, paymentIntent, e })
    }
  }
}

export async function closeListingOrder(
  orderId: string,
  status: 'expired' | 'failed',
  seen: FirebaseFirestore.DocumentReference,
  type: string,
) {
  const db = getFirestore()
  await db.runTransaction(async (tx) => {
    if ((await tx.get(seen)).exists) return
    const o = await tx.get(db.doc(`listingOrders/${orderId}`))
    if (o.exists && o.data()?.status === 'pending') tx.update(o.ref, { status })
    tx.create(seen, { type, at: FieldValue.serverTimestamp() })
  })
}
