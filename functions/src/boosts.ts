import Stripe from 'stripe'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { appUrl } from './env.js'

// Paid boosts: a boosted listing ranks first in Browse's default sort with a
// Boosted tag. Payment is Stripe Checkout on the web; the webhook is the only
// thing that ever starts a boost, and only these functions write boost fields
// (the Firestore rules block the client from them).
//
// Secrets (set once per project):
//   firebase functions:secrets:set STRIPE_SECRET_KEY -P dev    (sk_test_...)
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET -P dev (whsec_...)
// and the same with -P prod and live keys.

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')

// Keep in sync with src/lib/boosts.ts.
export const BOOST_GATE = 15 // live listings before boosts switch on
export const STUDENT_DISCOUNT = 0.2 // verified .edu members, to test
export const TIERS = {
  '7d': { days: 7, cents: 500, label: '7-day boost' },
  '30d': { days: 30, cents: 1500, label: '30-day boost' },
} as const
export type Tier = keyof typeof TIERS

const DAY = 24 * 60 * 60 * 1000

function stripe() {
  return new Stripe(STRIPE_SECRET_KEY.value())
}

// Same test as isStudentVerified() in firestore.rules: a confirmed .edu email,
// read from the verified auth token, never from anything the app sends.
function isStudentToken(token: Record<string, unknown> | undefined) {
  const email = typeof token?.email === 'string' ? token.email.toLowerCase() : ''
  return token?.email_verified === true && /^[^@]+@([a-z0-9-]+[.])+edu$/.test(email)
}

export function priceFor(tier: Tier, student: boolean) {
  const base = TIERS[tier].cents
  return student ? Math.round(base * (1 - STUDENT_DISCOUNT)) : base
}

async function liveListingCount() {
  const db = getFirestore()
  const snap = await db
    .collection('listings')
    .where('status', '==', 'active')
    .where('expiresAt', '>', Timestamp.now())
    .count()
    .get()
  return snap.data().count
}

// Callable from the Boost screen: checks everything server-side, records a
// pending order, and returns the Stripe Checkout URL.
export const createBoostCheckout = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY], memory: '256MiB', maxInstances: 10 },
  async (req) => {
    const uid = req.auth?.uid
    if (!uid || req.auth?.token.firebase?.sign_in_provider === 'anonymous')
      throw new HttpsError('unauthenticated', 'Log in to boost a listing.')

    const listingId = typeof req.data?.listingId === 'string' ? req.data.listingId : ''
    const tier = req.data?.tier as Tier
    if (!listingId || !(tier in TIERS)) throw new HttpsError('invalid-argument', 'Pick a boost.')

    const db = getFirestore()
    if ((await db.doc(`suspensions/${uid}`).get()).exists)
      throw new HttpsError('permission-denied', 'Your account is paused.')

    const listing = await db.doc(`listings/${listingId}`).get()
    const l = listing.data()
    if (!l || l.ownerId !== uid) throw new HttpsError('not-found', "We couldn't find that listing.")
    if (l.status !== 'active' || !(l.expiresAt instanceof Timestamp) || l.expiresAt.toMillis() < Date.now())
      throw new HttpsError('failed-precondition', 'Only live listings can be boosted.')

    if ((await liveListingCount()) < BOOST_GATE) throw new HttpsError('failed-precondition', "Boosts aren't on yet.")

    const student = isStudentToken(req.auth?.token as Record<string, unknown>)
    const amountCents = priceFor(tier, student)
    const order = db.collection('boostOrders').doc()

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Handoff ${TIERS[tier].label}`,
              description: student ? 'Verified student price (20% off)' : 'Your place shows first in Browse.',
            },
          },
        },
      ],
      client_reference_id: order.id,
      metadata: { orderId: order.id, listingId, uid, tier },
      payment_intent_data: { metadata: { orderId: order.id, listingId, uid, tier } },
      customer_email: typeof req.auth?.token.email === 'string' ? req.auth.token.email : undefined,
      success_url: `${appUrl()}/boost/success?order=${order.id}`,
      cancel_url: `${appUrl()}/boost/cancel?listing=${listingId}&order=${order.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    await order.set({
      listingId,
      uid,
      tier,
      provider: 'stripe',
      amountCents,
      studentPrice: student,
      stripeSessionId: session.id,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    })

    return { url: session.url, orderId: order.id }
  },
)

// Stripe calls this. It verifies the signature, skips events it has already
// handled, and on a paid Checkout session extends the listing's boost.
export const stripeWebhook = onRequest(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], memory: '256MiB', maxInstances: 10 },
  async (req, res) => {
    let event: Stripe.Event
    try {
      event = stripe().webhooks.constructEvent(
        req.rawBody,
        req.header('stripe-signature') ?? '',
        STRIPE_WEBHOOK_SECRET.value(),
      )
    } catch (e) {
      logger.warn('Bad Stripe signature', e)
      res.status(400).send('Bad signature')
      return
    }

    const db = getFirestore()
    const seen = db.doc(`stripeEvents/${event.id}`)

    try {
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.payment_status === 'paid') await activate(s, seen)
        else await seen.create({ type: event.type, at: FieldValue.serverTimestamp() }).catch(() => {})
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        const s = event.data.object as Stripe.Checkout.Session
        const orderId = s.metadata?.orderId
        if (orderId) {
          await db.runTransaction(async (tx) => {
            if ((await tx.get(seen)).exists) return
            const o = await tx.get(db.doc(`boostOrders/${orderId}`))
            if (o.exists && o.data()?.status === 'pending')
              tx.update(o.ref, { status: event.type === 'checkout.session.expired' ? 'expired' : 'failed' })
            tx.create(seen, { type: event.type, at: FieldValue.serverTimestamp() })
          })
        }
      }
      res.status(200).send('ok')
    } catch (e) {
      // A 500 makes Stripe retry, which is what we want for a transient error.
      logger.error('Stripe webhook failed', { id: event.id, type: event.type, e })
      res.status(500).send('error')
    }
  },
)

async function activate(s: Stripe.Checkout.Session, seen: FirebaseFirestore.DocumentReference) {
  const db = getFirestore()
  const { orderId, listingId, tier } = s.metadata ?? {}
  if (!orderId || !listingId || !(tier && tier in TIERS)) {
    logger.error('Paid session missing metadata', { session: s.id })
    return
  }
  await db.runTransaction(async (tx) => {
    if ((await tx.get(seen)).exists) return
    const orderRef = db.doc(`boostOrders/${orderId}`)
    const listingRef = db.doc(`listings/${listingId}`)
    const [order, listing] = await Promise.all([tx.get(orderRef), tx.get(listingRef)])
    if (order.data()?.status === 'paid') {
      tx.create(seen, { type: 'checkout.session.completed', at: FieldValue.serverTimestamp() })
      return
    }
    // Stack on an existing boost; otherwise start now.
    const now = Date.now()
    const current = listing.data()?.boostedUntil
    const from = current instanceof Timestamp && current.toMillis() > now ? current.toMillis() : now
    const endsAt = Timestamp.fromMillis(from + TIERS[tier as Tier].days * DAY)

    if (listing.exists)
      tx.update(listingRef, { boostTier: tier, boostedUntil: endsAt, boostEndedAt: FieldValue.delete() })
    tx.set(
      orderRef,
      {
        status: 'paid',
        startsAt: Timestamp.fromMillis(from),
        endsAt,
        amountCents: s.amount_total ?? order.data()?.amountCents ?? null,
        stripePaymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
        paidAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    tx.create(seen, { type: 'checkout.session.completed', at: FieldValue.serverTimestamp() })
  })
}

// Hourly: clears boosts that have run out and flags "boost ended" for My
// listings. Browse already stops ranking them at boostedUntil, so this is
// housekeeping, not the clock.
export const expireBoosts = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1', memory: '256MiB' },
  async () => {
    const db = getFirestore()
    const due = await db.collection('listings').where('boostedUntil', '<=', Timestamp.now()).limit(400).get()
    if (due.empty) return
    const batch = db.batch()
    for (const d of due.docs)
      batch.update(d.ref, {
        boostTier: FieldValue.delete(),
        boostedUntil: FieldValue.delete(),
        boostEndedAt: FieldValue.serverTimestamp(),
      })
    await batch.commit()
    logger.info(`Ended ${due.size} boosts`)
  },
)
