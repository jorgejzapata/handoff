import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

// The two numbers that switch on Handoff's pricing, kept in one public doc,
// stats/listings, so the app can show "32 of 50 free spots left" without
// reading every listing:
//
//   published  every listing ever published (the $1 fee starts at FREE_LISTINGS)
//   live       listings live right now (boosts unlock at BOOST_GATE)
//
// Listings by internal accounts (Jorge and the test accounts) never count.
// Mark an account internal with the "Test account" switch in Admin → Users,
// which writes internal/{uid}.
//
// `published` only ever goes up, so a deleted listing can't flip posting back
// to free. The one exception: marking an account internal recounts from
// scratch, so test listings made before it was marked drop out.

// Default free spots; config/pricing.freeListings overrides it. Keep the
// default in sync with src/lib/pricing.ts and firestore.rules.
export const FREE_LISTINGS = 50

export async function internalUids() {
  const snap = await getFirestore().collection('internal').get()
  return new Set(snap.docs.map((d) => d.id))
}

async function recount() {
  const db = getFirestore()
  const internal = await internalUids()
  const [everPublished, live] = await Promise.all([
    db.collection('listings').where('publishedAt', '!=', null).select('ownerId').get(),
    db
      .collection('listings')
      .where('status', '==', 'active')
      .where('expiresAt', '>', Timestamp.now())
      .select('ownerId')
      .get(),
  ])
  const count = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
    docs.filter((d) => !internal.has(d.get('ownerId'))).length
  return { published: count(everPublished.docs), live: count(live.docs) }
}

async function writeStats({ fresh }: { fresh: boolean }) {
  const db = getFirestore()
  const ref = db.doc('stats/listings')
  const next = await recount()
  await db.runTransaction(async (tx) => {
    const prev = (await tx.get(ref)).data()
    const published = fresh ? next.published : Math.max(prev?.published ?? 0, next.published)
    if (prev && prev.published === published && prev.live === next.live) return
    tx.set(ref, { published, live: next.live, updatedAt: FieldValue.serverTimestamp() })
  })
  return next
}

// Only status changes move the numbers; edits to text or photos don't.
export const onListingStatusChange = onDocumentWritten(
  { document: 'listings/{listingId}', region: 'us-central1', memory: '256MiB', maxInstances: 5 },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (before?.status === after?.status && String(before?.expiresAt) === String(after?.expiresAt)) return
    const n = await writeStats({ fresh: false })
    logger.info('Listing stats', n)
  },
)

export const onInternalChange = onDocumentWritten(
  { document: 'internal/{uid}', region: 'us-central1', memory: '256MiB', maxInstances: 2 },
  async () => {
    const n = await writeStats({ fresh: true })
    logger.info('Listing stats recounted', n)
  },
)

// The total that decides the next listing's price, read server-side.
export async function publishedCount() {
  const snap = await getFirestore().doc('stats/listings').get()
  return (snap.get('published') as number | undefined) ?? (await recount()).published
}

export async function liveCount() {
  const snap = await getFirestore().doc('stats/listings').get()
  return (snap.get('live') as number | undefined) ?? (await recount()).live
}
