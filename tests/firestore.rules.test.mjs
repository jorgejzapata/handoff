// Firestore security rules tests. Run with: npm run test:rules
// (starts the Firestore emulator, runs these, then shuts it down)
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

let env

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-handoff-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
after(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const maya = { email: 'maya.r@colostate.edu', email_verified: false }
const newUser = (extra = {}) => ({
  firstName: 'Maya',
  email: 'maya.r@colostate.edu',
  schoolId: 'csu',
  onboardingStep: 'profile',
  createdAt: serverTimestamp(),
  lastActiveAt: serverTimestamp(),
  ...extra,
})

describe('users/{uid}', () => {
  test('owner can create their own doc right after signup (not verified yet)', async () => {
    const db = env.authenticatedContext('maya', maya).firestore()
    await assertSucceeds(setDoc(doc(db, 'users/maya'), newUser()))
  })

  test("can't create someone else's doc", async () => {
    const db = env.authenticatedContext('jake', { email: 'jake@colostate.edu' }).firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ email: 'jake@colostate.edu' })))
  })

  test('signed-out visitors cannot create or read', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser()))
    await assertFails(getDoc(doc(db, 'users/maya')))
  })

  test('email must match the auth token', async () => {
    const db = env.authenticatedContext('maya', maya).firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ email: 'someone@else.com' })))
  })

  test('cannot set status, admin or unknown fields on create', async () => {
    const db = env.authenticatedContext('maya', maya).firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ status: 'active' })))
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ isAdmin: true })))
  })

  test('first name must be 1–40 characters', async () => {
    const db = env.authenticatedContext('maya', maya).firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ firstName: '' })))
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ firstName: 'x'.repeat(41) })))
  })

  test('createdAt must be the server time', async () => {
    const db = env.authenticatedContext('maya', maya).firestore()
    await assertFails(setDoc(doc(db, 'users/maya'), newUser({ createdAt: new Date('2020-01-01') })))
  })

  describe('existing doc', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), 'users/maya'), {
          firstName: 'Maya',
          email: 'maya.r@colostate.edu',
          schoolId: 'csu',
          createdAt: new Date(),
          status: 'suspended',
        }),
      )
    })

    test('owner can read; others cannot', async () => {
      await assertSucceeds(getDoc(doc(env.authenticatedContext('maya', maya).firestore(), 'users/maya')))
      await assertFails(
        getDoc(doc(env.authenticatedContext('jake', { email: 'jake@colostate.edu' }).firestore(), 'users/maya')),
      )
    })

    test('owner can edit profile fields', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      await assertSucceeds(updateDoc(doc(db, 'users/maya'), { bio: 'Ag business junior, quiet, early riser', gradYear: 'Junior' }))
    })

    test('bio is capped at 140 characters', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      await assertFails(updateDoc(doc(db, 'users/maya'), { bio: 'x'.repeat(141) }))
    })

    // The doc starts suspended, so this also proves a suspended student can't un-suspend themselves.
    test('owner cannot change email, school, status or createdAt', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      await assertFails(updateDoc(doc(db, 'users/maya'), { email: 'new@colostate.edu' }))
      await assertFails(updateDoc(doc(db, 'users/maya'), { schoolId: 'cu' }))
      await assertFails(updateDoc(doc(db, 'users/maya'), { status: 'active' }))
      await assertFails(updateDoc(doc(db, 'users/maya'), { createdAt: new Date() }))
    })

    test('nobody can delete from the client', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      await assertFails(deleteDoc(doc(db, 'users/maya')))
    })
  })
})

// ---- listings ----

const anon = { firebase: { sign_in_provider: 'anonymous' } }
const verifiedMaya = { email: 'maya.r@colostate.edu', email_verified: true }
const unverifiedMaya = { email: 'maya.r@colostate.edu', email_verified: false }
const verifiedGmail = { email: 'maya@gmail.com', email_verified: true }

const day = (iso) => Timestamp.fromDate(new Date(`${iso}T00:00:00Z`))
const inDays = (n) => Timestamp.fromMillis(Date.now() + n * 24 * 60 * 60 * 1000)

function newDraft(owner, extra = {}) {
  return {
    ownerId: owner,
    schoolId: 'csu',
    status: 'draft',
    listingType: 'room',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  }
}

// Every field Publish needs, already on the draft.
const complete = {
  listingType: 'room',
  rentCents: 65000,
  availableFrom: day('2027-01-06'),
  availableTo: day('2027-05-15'),
  title: 'Sunny room near Old Town',
  description: 'Big south-facing window, two quiet roommates, and a 5-minute bike ride to campus.',
  photos: [{ id: 'p1', path: 'listing-photos/maya/l1/p1.jpg', url: 'https://x', thumbUrl: 'https://x', width: 1600, height: 1200 }],
  approxLat: 40.575,
  approxLng: -105.085,
  neighborhood: 'Campus West',
  landlordStatus: 'allowed',
  leaseAckAt: Timestamp.now(),
}

const publishPatch = () => ({
  status: 'active',
  publishedAt: serverTimestamp(),
  expiresAt: inDays(30),
  updatedAt: serverTimestamp(),
  listerFirstName: 'Maya',
  listerSince: 'Oct 2026',
})

async function seedListing(id, data) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'listings', id), data))
}

describe('listings: drafts', () => {
  test('an anonymous visitor can start a draft (no account yet)', async () => {
    const db = env.authenticatedContext('anonMaya', anon).firestore()
    await assertSucceeds(setDoc(doc(db, 'listings/l1'), newDraft('anonMaya')))
  })

  test('signed-out visitors cannot start a draft', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'listings/l1'), newDraft('nobody')))
  })

  test("can't create a draft for someone else, or create it already live", async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(setDoc(doc(db, 'listings/l1'), newDraft('jake')))
    await assertFails(setDoc(doc(db, 'listings/l2'), newDraft('maya', { status: 'active' })))
  })

  test("can't set boost, counts or report fields from the client", async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(setDoc(doc(db, 'listings/l1'), newDraft('maya', { boostedUntil: inDays(7) })))
    await assertFails(setDoc(doc(db, 'listings/l2'), newDraft('maya', { reportCount: 0 })))
  })

  test('owner can autosave fields; bad values are rejected', async () => {
    await seedListing('l1', { ...newDraft('maya'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    const db = env.authenticatedContext('maya', unverifiedMaya).firestore()
    const ref = doc(db, 'listings/l1')
    await assertSucceeds(updateDoc(ref, { rentCents: 65000, title: 'Sunny room', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { rentCents: 5000, updatedAt: serverTimestamp() })) // under $100
    await assertFails(updateDoc(ref, { title: 'x'.repeat(61), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { listingType: 'mansion', updatedAt: serverTimestamp() }))
  })

  test("others can't read or edit someone's draft", async () => {
    await seedListing('l1', { ...newDraft('maya'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    const db = env.authenticatedContext('jake', { email: 'jake@colostate.edu', email_verified: true }).firestore()
    await assertFails(getDoc(doc(db, 'listings/l1')))
    await assertFails(updateDoc(doc(db, 'listings/l1'), { title: 'Mine now', updatedAt: serverTimestamp() }))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'listings/l1')))
  })
})

describe('listings: publishing', () => {
  beforeEach(() => seedListing('l1', { ...newDraft('maya', complete), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }))

  test('a verified CSU student can publish a complete draft', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertSucceeds(updateDoc(doc(db, 'listings/l1'), publishPatch()))
  })

  test('unverified and anonymous accounts cannot publish', async () => {
    await assertFails(
      updateDoc(doc(env.authenticatedContext('maya', unverifiedMaya).firestore(), 'listings/l1'), publishPatch()),
    )
    await assertFails(updateDoc(doc(env.authenticatedContext('maya', anon).firestore(), 'listings/l1'), publishPatch()))
  })

  test('a verified non-CSU email cannot publish', async () => {
    const db = env.authenticatedContext('maya', verifiedGmail).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l1'), publishPatch()))
  })

  test('an incomplete draft cannot go live', async () => {
    await seedListing('l2', { ...newDraft('maya', { ...complete, photos: [] }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    await seedListing('l3', { ...newDraft('maya', { ...complete, leaseAckAt: null }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l2'), publishPatch()))
    await assertFails(updateDoc(doc(db, 'listings/l3'), publishPatch()))
  })

  test('expiry can be at most 31 days out', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l1'), { ...publishPatch(), expiresAt: inDays(60) }))
  })
})

describe('listings: live', () => {
  beforeEach(async () => {
    await seedListing('live', {
      ...newDraft('maya', complete),
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      publishedAt: Timestamp.now(),
      expiresAt: inDays(30),
      listerFirstName: 'Maya',
      listerSince: 'Oct 2026',
    })
    await seedListing('hidden', { ...newDraft('maya', complete), status: 'hidden', createdAt: Timestamp.now() })
  })

  test('anyone can read a live listing, even signed out', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'listings/live')))
  })

  test('visitors can query live listings', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDocs(query(collection(db, 'listings'), where('status', '==', 'active'))))
  })

  test('hidden listings are not public', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'listings/hidden')))
  })

  test('owner can edit a live listing but cannot hide, remove or boost it', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    const ref = doc(db, 'listings/live')
    await assertSucceeds(updateDoc(ref, { rentCents: 60000, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { status: 'hidden', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { status: 'removed', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { boostedUntil: inDays(7), updatedAt: serverTimestamp() }))
  })

  test('owner can mark it filled', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'listings/live'), {
        status: 'filled',
        filledAt: serverTimestamp(),
        filledViaHandoff: true,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test("owner can't touch a hidden listing", async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(updateDoc(doc(db, 'listings/hidden'), { title: 'Back up', updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(db, 'listings/hidden')))
  })
})

describe('listings/{id}/private/location', () => {
  beforeEach(() => seedListing('l1', { ...newDraft('maya', complete), createdAt: Timestamp.now() }))
  const loc = { streetAddress: '1234 Elizabeth St', unit: 'Apt 2', exactLat: 40.5751, exactLng: -105.0901 }

  test('only the owner can write and read the exact address', async () => {
    const mayaDb = env.authenticatedContext('maya', anon).firestore()
    await assertSucceeds(setDoc(doc(mayaDb, 'listings/l1/private/location'), loc))
    await assertSucceeds(getDoc(doc(mayaDb, 'listings/l1/private/location')))

    const jakeDb = env.authenticatedContext('jake', { email: 'jake@colostate.edu', email_verified: true }).firestore()
    await assertFails(getDoc(doc(jakeDb, 'listings/l1/private/location')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'listings/l1/private/location')))
  })

  test('only the location doc, with only address fields', async () => {
    const db = env.authenticatedContext('maya', anon).firestore()
    await assertFails(setDoc(doc(db, 'listings/l1/private/other'), loc))
    await assertFails(setDoc(doc(db, 'listings/l1/private/location'), { ...loc, phone: '555' }))
  })
})

describe('everything else', () => {
  test('unknown collections are denied, even for verified students', async () => {
    const db = env.authenticatedContext('maya', { email: 'maya.r@colostate.edu', email_verified: true }).firestore()
    await assertFails(setDoc(doc(db, 'messages/abc'), { text: 'Hi' }))
    await assertFails(getDoc(doc(db, 'reports/abc')))
  })
})
