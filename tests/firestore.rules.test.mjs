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
  writeBatch,
  increment,
  addDoc,
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

    test('gender is optional, from a fixed list, with a short self-description', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      const ref = doc(db, 'users/maya')
      await assertSucceeds(updateDoc(ref, { gender: 'nonbinary' }))
      await assertSucceeds(updateDoc(ref, { gender: 'self', genderSelfDescribe: 'Genderfluid' }))
      await assertFails(updateDoc(ref, { gender: 'robot' }))
      await assertFails(updateDoc(ref, { genderSelfDescribe: 'x'.repeat(31) }))
    })

    test('verifiedAt is set once, only by a verified student, at server time', async () => {
      const unverified = env.authenticatedContext('maya', maya).firestore()
      await assertFails(updateDoc(doc(unverified, 'users/maya'), { verifiedAt: serverTimestamp() }))
      const verified = env.authenticatedContext('maya', { ...maya, email_verified: true }).firestore()
      const ref = doc(verified, 'users/maya')
      await assertFails(updateDoc(ref, { verifiedAt: Timestamp.fromMillis(0) }))
      await assertFails(updateDoc(ref, { verifiedAt: serverTimestamp(), signupReason: 'hacking' }))
      await assertSucceeds(updateDoc(ref, { verifiedAt: serverTimestamp(), signupReason: 'say-hi' }))
      await assertFails(updateDoc(ref, { verifiedAt: serverTimestamp() })) // only once
      await assertFails(updateDoc(ref, { signupReason: 'publish' }))
    })

    test('message-email setting is a single on/off switch', async () => {
      const db = env.authenticatedContext('maya', maya).firestore()
      const ref = doc(db, 'users/maya')
      await assertSucceeds(updateDoc(ref, { notificationPrefs: { email: false } }))
      await assertFails(updateDoc(ref, { notificationPrefs: { email: 'nope' } }))
      await assertFails(updateDoc(ref, { notificationPrefs: { sms: true } }))
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

    test('owner can delete their own profile (account deletion); nobody else can', async () => {
      await assertFails(deleteDoc(doc(env.authenticatedContext('jake', { email: 'jake@colostate.edu' }).firestore(), 'users/maya')))
      await assertSucceeds(deleteDoc(doc(env.authenticatedContext('maya', maya).firestore(), 'users/maya')))
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

  test('rooms can say who lives there and who can move in; whole places cannot', async () => {
    await seedListing('l1', { ...newDraft('maya'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    await seedListing('l2', { ...newDraft('maya', { listingType: 'takeover' }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    const db = env.authenticatedContext('maya', unverifiedMaya).firestore()
    const room = doc(db, 'listings/l1')
    await assertSucceeds(updateDoc(room, { householdGenders: ['men'], openTo: ['men'], updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(room, { openTo: ['women', 'nonbinary'], updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(room, { openTo: [], updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(room, { openTo: ['guys'], updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(room, { openTo: 'men', updatedAt: serverTimestamp() }))
    const whole = doc(db, 'listings/l2')
    await assertFails(updateDoc(whole, { openTo: ['men'], updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(whole, { openTo: [], updatedAt: serverTimestamp() }))
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

  test('a verified student can publish a complete draft', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertSucceeds(updateDoc(doc(db, 'listings/l1'), publishPatch()))
  })

  test('unverified and anonymous accounts cannot publish', async () => {
    await assertFails(
      updateDoc(doc(env.authenticatedContext('maya', unverifiedMaya).firestore(), 'listings/l1'), publishPatch()),
    )
    await assertFails(updateDoc(doc(env.authenticatedContext('maya', anon).firestore(), 'listings/l1'), publishPatch()))
  })

  test('a verified non-school email cannot publish', async () => {
    const db = env.authenticatedContext('maya', verifiedGmail).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l1'), publishPatch()))
  })

  test('any school (.edu) email works; look-alike domains do not', async () => {
    const as = (email) => env.authenticatedContext('maya', { email, email_verified: true }).firestore()
    await assertFails(updateDoc(doc(as('maya@school.edu.evil.com'), 'listings/l1'), publishPatch()))
    await assertFails(updateDoc(doc(as('maya@edu'), 'listings/l1'), publishPatch()))
    await assertFails(updateDoc(doc(as('maya@notanedu'), 'listings/l1'), publishPatch()))
    await assertSucceeds(updateDoc(doc(as('Maya@Mail.DU.edu'), 'listings/l1'), publishPatch()))
  })

  test('an incomplete draft cannot go live', async () => {
    await seedListing('l2', { ...newDraft('maya', { ...complete, photos: [] }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    await seedListing('l3', { ...newDraft('maya', { ...complete, leaseAckAt: null }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l2'), publishPatch()))
    await assertFails(updateDoc(doc(db, 'listings/l3'), publishPatch()))
  })

  test('expiry can be at most about 3 months out', async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(updateDoc(doc(db, 'listings/l1'), { ...publishPatch(), expiresAt: inDays(120) }))
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

describe('saved places', () => {
  const jake = { email: 'jake@colostate.edu', email_verified: true }
  const entry = () => ({
    savedAt: serverTimestamp(),
    title: 'Sunny room near Old Town',
    rentCents: 65000,
    thumbUrl: null,
    availableFrom: '2027-01-06',
    availableTo: '2027-05-15',
    neighborhood: 'Campus West',
  })
  const save = (db, listingId = 'live') => {
    const b = writeBatch(db)
    b.set(doc(db, 'users/jake/saved', listingId), entry())
    b.set(doc(db, 'listings', listingId, 'saves', 'jake'), { at: serverTimestamp() })
    return b.commit()
  }

  beforeEach(async () => {
    const base = { ...newDraft('maya', complete), createdAt: Timestamp.now(), updatedAt: Timestamp.now(), publishedAt: Timestamp.now(), expiresAt: inDays(30), listerFirstName: 'Maya', listerSince: 'Oct 2026' }
    await seedListing('live', { ...base, status: 'active' })
    await seedListing('gone', { ...base, status: 'filled' })
  })

  test('a verified student can save and unsave a live place', async () => {
    const db = env.authenticatedContext('jake', jake).firestore()
    await assertSucceeds(save(db))
    await assertSucceeds(getDocs(collection(db, 'users/jake/saved')))
    const b = writeBatch(db)
    b.delete(doc(db, 'users/jake/saved/live'))
    b.delete(doc(db, 'listings/live/saves/jake'))
    await assertSucceeds(b.commit())
  })

  test("unverified students can't save, and nobody saves a place that isn't live", async () => {
    await assertFails(save(env.authenticatedContext('jake', { ...jake, email_verified: false }).firestore()))
    await assertFails(save(env.authenticatedContext('jake', jake).firestore(), 'gone'))
  })

  test("nobody can read or write someone else's saved list", async () => {
    await assertSucceeds(save(env.authenticatedContext('jake', jake).firestore()))
    const maya = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(getDocs(collection(maya, 'users/jake/saved')))
    await assertFails(setDoc(doc(maya, 'users/jake/saved/live'), entry()))
    await assertFails(deleteDoc(doc(maya, 'listings/live/saves/jake')))
  })

  test('only the lister can count saves', async () => {
    await assertSucceeds(save(env.authenticatedContext('jake', jake).firestore()))
    await assertSucceeds(getDocs(collection(env.authenticatedContext('maya', verifiedMaya).firestore(), 'listings/live/saves')))
    await assertFails(getDocs(collection(env.authenticatedContext('jake', jake).firestore(), 'listings/live/saves')))
  })

  test("listers can't pad their own save count", async () => {
    const db = env.authenticatedContext('maya', verifiedMaya).firestore()
    await assertFails(setDoc(doc(db, 'listings/live/saves/maya'), { at: serverTimestamp() }))
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

// ---- messaging ----

const jakeVerified = { email: 'jake@colostate.edu', email_verified: true }
const jakeUnverified = { email: 'jake@colostate.edu', email_verified: false }
const outsiderAuth = { email: 'sam@colostate.edu', email_verified: true }

async function seedLiveListing(id = 'live', owner = 'maya') {
  await seedListing(id, {
    ...newDraft(owner, complete),
    status: 'active',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    publishedAt: Timestamp.now(),
    expiresAt: inDays(30),
    listerFirstName: 'Maya',
    listerSince: 'Oct 2026',
  })
}

function newConversation(extra = {}) {
  return {
    listingId: 'live',
    listerId: 'maya',
    seekerId: 'jake',
    participantIds: ['maya', 'jake'],
    listingTitle: complete.title,
    listingThumbUrl: null,
    listingRentCents: 65000,
    listingFrom: complete.availableFrom,
    listingTo: complete.availableTo,
    listerFirstName: 'Maya',
    listerPhotoUrl: null,
    seekerFirstName: 'Jake',
    seekerPhotoUrl: null,
    lastMessage: { text: 'Hi Maya! Is your place still open?', senderId: 'jake', sentAt: serverTimestamp() },
    unreadCount: { maya: 1, jake: 0 },
    lastReadAt: { jake: serverTimestamp() },
    closedReason: null,
    blockedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  }
}

async function startAs(auth, uid, convId = 'live_jake', conv = newConversation()) {
  const db = env.authenticatedContext(uid, auth).firestore()
  const batch = writeBatch(db)
  batch.set(doc(db, 'conversations', convId), conv)
  batch.set(doc(collection(db, 'conversations', convId, 'messages')), {
    senderId: uid,
    text: conv.lastMessage.text,
    sentAt: serverTimestamp(),
    type: 'text',
  })
  return batch.commit()
}

async function seedConversation(extra = {}) {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'conversations/live_jake'), {
      ...newConversation(),
      lastMessage: { text: 'Hi', senderId: 'jake', sentAt: Timestamp.now() },
      lastReadAt: { jake: Timestamp.now() },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...extra,
    }),
  )
}

function sendAs(auth, uid, other, { text = 'Sounds good', type = 'text', extra = {} } = {}) {
  const db = env.authenticatedContext(uid, auth).firestore()
  const convRef = doc(db, 'conversations/live_jake')
  const batch = writeBatch(db)
  batch.set(doc(collection(convRef, 'messages')), { senderId: uid, text, sentAt: serverTimestamp(), type })
  batch.update(convRef, {
    lastMessage: { text, senderId: uid, sentAt: serverTimestamp() },
    [`unreadCount.${other}`]: increment(1),
    [`unreadCount.${uid}`]: 0,
    [`lastReadAt.${uid}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })
  return batch.commit()
}

const mayaVerified = verifiedMaya

describe('conversations: starting a thread', () => {
  beforeEach(() => seedLiveListing())

  test('a verified student can say hi', async () => {
    await assertSucceeds(startAs(jakeVerified, 'jake'))
  })

  test('unverified students cannot say hi', async () => {
    await assertFails(startAs(jakeUnverified, 'jake'))
  })

  test("the thread id must be listing_seeker, so there's one thread per seeker", async () => {
    await assertFails(startAs(jakeVerified, 'jake', 'live_someoneelse'))
  })

  test("can't fake the lister's name or message the listing's owner as themselves", async () => {
    await assertFails(startAs(jakeVerified, 'jake', 'live_jake', newConversation({ listerFirstName: 'Admin' })))
    await assertFails(startAs(mayaVerified, 'maya', 'live_maya', newConversation({ seekerId: 'maya', participantIds: ['maya', 'maya'] })))
  })

  test("can't start a thread on a listing that isn't live", async () => {
    await seedListing('draft1', { ...newDraft('maya', complete), createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    await assertFails(startAs(jakeVerified, 'jake', 'draft1_jake', newConversation({ listingId: 'draft1' })))
  })

  test('a blocked student cannot start a new thread', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/maya/blocks/jake'), { createdAt: Timestamp.now() }))
    await assertFails(startAs(jakeVerified, 'jake'))
  })
})

describe('conversations: in a thread', () => {
  beforeEach(async () => {
    await seedLiveListing()
    await seedConversation()
  })

  test('only the two people can read the thread and its messages', async () => {
    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertSucceeds(getDoc(doc(jakeDb, 'conversations/live_jake')))
    await assertSucceeds(getDocs(collection(jakeDb, 'conversations/live_jake/messages')))
    const samDb = env.authenticatedContext('sam', outsiderAuth).firestore()
    await assertFails(getDoc(doc(samDb, 'conversations/live_jake')))
    await assertFails(getDocs(collection(samDb, 'conversations/live_jake/messages')))
  })

  test('inbox query works for a participant', async () => {
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertSucceeds(getDocs(query(collection(db, 'conversations'), where('participantIds', 'array-contains', 'maya'))))
  })

  test('both people can send messages', async () => {
    await assertSucceeds(sendAs(mayaVerified, 'maya', 'jake'))
    await assertSucceeds(sendAs(jakeVerified, 'jake', 'maya'))
  })

  test("outsiders can't post, and nobody can inflate unread counts", async () => {
    await assertFails(sendAs(outsiderAuth, 'sam', 'maya'))
    await assertFails(sendAs(jakeVerified, 'jake', 'maya', { extra: { 'unreadCount.maya': 50 } }))
  })

  test('messages cannot be edited or deleted', async () => {
    let msgId
    await env.withSecurityRulesDisabled(async (ctx) => {
      const ref = await addDoc(collection(ctx.firestore(), 'conversations/live_jake/messages'), {
        senderId: 'jake', text: 'Hi', sentAt: Timestamp.now(), type: 'text',
      })
      msgId = ref.id
    })
    const db = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertFails(updateDoc(doc(db, `conversations/live_jake/messages/${msgId}`), { text: 'Edited' }))
    await assertFails(deleteDoc(doc(db, `conversations/live_jake/messages/${msgId}`)))
  })

  test("reading clears my unread count, but not the other person's", async () => {
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertSucceeds(updateDoc(doc(db, 'conversations/live_jake'), { 'unreadCount.maya': 0, 'lastReadAt.maya': serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'conversations/live_jake'), { 'unreadCount.jake': 0, 'lastReadAt.jake': serverTimestamp() }))
  })

  test('only the lister can share the address', async () => {
    await assertSucceeds(sendAs(mayaVerified, 'maya', 'jake', { text: '1234 Elizabeth St', type: 'address' }))
    await assertFails(sendAs(jakeVerified, 'jake', 'maya', { text: '1234 Elizabeth St', type: 'address' }))
  })

  test('the lister can close the thread with a system line; the seeker cannot', async () => {
    const mayaDb = env.authenticatedContext('maya', mayaVerified).firestore()
    const batch = writeBatch(mayaDb)
    batch.update(doc(mayaDb, 'conversations/live_jake'), { closedReason: 'filled' })
    batch.set(doc(collection(mayaDb, 'conversations/live_jake/messages')), {
      senderId: 'maya', text: 'Maya marked this place as filled.', sentAt: serverTimestamp(), type: 'system',
    })
    await assertSucceeds(batch.commit())

    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertFails(updateDoc(doc(jakeDb, 'conversations/live_jake'), { closedReason: null }))
  })

  test('closed and blocked threads take no new messages', async () => {
    await seedConversation({ closedReason: 'filled' })
    await assertFails(sendAs(jakeVerified, 'jake', 'maya'))
    await seedConversation({ blockedBy: 'maya' })
    await assertFails(sendAs(jakeVerified, 'jake', 'maya'))
    await assertFails(sendAs(mayaVerified, 'maya', 'jake'))
  })

  test('either person can block, once', async () => {
    const db = env.authenticatedContext('jake', jakeVerified).firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/jake/blocks/maya'), { createdAt: serverTimestamp() })
    batch.update(doc(db, 'conversations/live_jake'), { blockedBy: 'jake' })
    await assertSucceeds(batch.commit())
    const mayaDb = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertFails(updateDoc(doc(mayaDb, 'conversations/live_jake'), { blockedBy: 'maya' }))
  })
})

describe('conversations: attachments', () => {
  beforeEach(async () => {
    await seedLiveListing()
    await seedConversation()
  })

  const photo = (uid, extra = {}) => ({
    url: 'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=t',
    path: `chat-attachments/${uid}/live_jake/abc123.jpg`,
    name: 'room.jpg',
    size: 250000,
    contentType: 'image/jpeg',
    width: 1600,
    height: 1200,
    ...extra,
  })

  function sendAttachment(auth, uid, other, type, attachment, text = '') {
    const db = env.authenticatedContext(uid, auth).firestore()
    const convRef = doc(db, 'conversations/live_jake')
    const batch = writeBatch(db)
    batch.set(doc(collection(convRef, 'messages')), { senderId: uid, text, sentAt: serverTimestamp(), type, attachment })
    batch.update(convRef, {
      lastMessage: { text: 'Sent a photo', senderId: uid, sentAt: serverTimestamp() },
      [`unreadCount.${other}`]: increment(1),
      [`unreadCount.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return batch.commit()
  }

  test('either person can send a photo or a PDF, with or without a caption', async () => {
    await assertSucceeds(sendAttachment(jakeVerified, 'jake', 'maya', 'image', photo('jake')))
    await assertSucceeds(
      sendAttachment(mayaVerified, 'maya', 'jake', 'file', photo('maya', { path: 'chat-attachments/maya/live_jake/lease1.pdf', contentType: 'application/pdf', name: 'lease.pdf' }), 'Here is the lease'),
    )
  })

  test("can't point at someone else's upload or another chat's folder", async () => {
    await assertFails(sendAttachment(jakeVerified, 'jake', 'maya', 'image', photo('maya')))
    await assertFails(sendAttachment(jakeVerified, 'jake', 'maya', 'image', photo('jake', { path: 'chat-attachments/jake/other_chat/abc.jpg' })))
  })

  test('only JPEG photos and PDF files, within size limits', async () => {
    await assertFails(sendAttachment(jakeVerified, 'jake', 'maya', 'file', photo('jake', { contentType: 'application/zip', path: 'chat-attachments/jake/live_jake/a.pdf' })))
    await assertFails(sendAttachment(jakeVerified, 'jake', 'maya', 'image', photo('jake', { size: 6 * 1024 * 1024 })))
  })
})

describe('listing views', () => {
  beforeEach(() => seedLiveListing())
  const view = { day: '20261010', at: serverTimestamp() }

  test('anyone, even signed out, can record one view per day', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(db, 'listings/live/views/20261010_visitorabc123'), view))
    // Same visitor, same day: no second count.
    await assertFails(setDoc(doc(db, 'listings/live/views/20261010_visitorabc123'), view))
  })

  test("the lister's own visits don't count", async () => {
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertFails(setDoc(doc(db, 'listings/live/views/20261010_mayavisitor1'), view))
  })

  test('only the lister can read views', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'listings/live/views/20261010_visitorabc123'), { day: '20261010', at: Timestamp.now() }))
    await assertSucceeds(getDocs(collection(env.authenticatedContext('maya', mayaVerified).firestore(), 'listings/live/views')))
    await assertFails(getDocs(collection(env.authenticatedContext('jake', jakeVerified).firestore(), 'listings/live/views')))
  })

  test('bad ids and extra fields are rejected', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'listings/live/views/whatever'), view))
    await assertFails(setDoc(doc(db, 'listings/live/views/20261010_visitorabc123'), { ...view, count: 500 }))
  })
})

describe('account settings: blocks and leaving', () => {
  beforeEach(async () => {
    await seedLiveListing()
    await seedConversation()
  })

  test('block saves a name for the blocked list, and only the blocker can unblock', async () => {
    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertSucceeds(setDoc(doc(jakeDb, 'users/jake/blocks/maya'), { createdAt: serverTimestamp(), firstName: 'Maya' }))
    await seedConversation({ blockedBy: 'jake' })
    const mayaDb = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertFails(updateDoc(doc(mayaDb, 'conversations/live_jake'), { blockedBy: null }))
    await assertSucceeds(updateDoc(doc(jakeDb, 'conversations/live_jake'), { blockedBy: null }))
    await assertSucceeds(deleteDoc(doc(jakeDb, 'users/jake/blocks/maya')))
  })

  test('leaving renames me to Former member and closes the thread', async () => {
    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertSucceeds(
      updateDoc(doc(jakeDb, 'conversations/live_jake'), { seekerFirstName: 'Former member', seekerPhotoUrl: null, blockedBy: 'jake' }),
    )
  })

  test("leaving can't rename the other person", async () => {
    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertFails(
      updateDoc(doc(jakeDb, 'conversations/live_jake'), { listerFirstName: 'Former member', listerPhotoUrl: null, blockedBy: 'jake' }),
    )
  })
})

describe('reports', () => {
  const report = (extra = {}) => ({
    reporterId: 'jake',
    targetType: 'listing',
    targetId: 'live',
    reason: 'scam',
    details: 'Asked for a deposit over Zelle before showing it.',
    status: 'open',
    createdAt: serverTimestamp(),
    ...extra,
  })

  test('verified students can report', async () => {
    const db = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertSucceeds(addDoc(collection(db, 'reports'), report()))
  })

  test("can't report as someone else, unverified, or pre-resolved", async () => {
    await assertFails(addDoc(collection(env.authenticatedContext('jake', jakeVerified).firestore(), 'reports'), report({ reporterId: 'maya' })))
    await assertFails(addDoc(collection(env.authenticatedContext('jake', jakeUnverified).firestore(), 'reports'), report()))
    await assertFails(addDoc(collection(env.authenticatedContext('jake', jakeVerified).firestore(), 'reports'), report({ status: 'dismissed' })))
  })

  test('only admins can read reports', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'reports/r1'), { ...report(), createdAt: Timestamp.now() }))
    await assertFails(getDoc(doc(env.authenticatedContext('jake', jakeVerified).firestore(), 'reports/r1')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext('jorge', { ...jakeVerified, admin: true }).firestore(), 'reports/r1')))
  })
})

describe('listings: taking down, keeping up, relisting', () => {
  beforeEach(() => seedLiveListing())

  test('owner can take a live listing down', async () => {
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertSucceeds(updateDoc(doc(db, 'listings/live'), { status: 'expired', updatedAt: serverTimestamp() }))
  })

  test('"Keep it up" pushes expiry out, at most about 3 months', async () => {
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertSucceeds(updateDoc(doc(db, 'listings/live'), { expiresAt: inDays(30), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'listings/live'), { expiresAt: inDays(120), updatedAt: serverTimestamp() }))
  })

  test('owner can relist a filled or expired listing', async () => {
    await seedListing('old', {
      ...newDraft('maya', complete),
      status: 'filled',
      listerFirstName: 'Maya',
      listerSince: 'Oct 2026',
      filledViaHandoff: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    const db = env.authenticatedContext('maya', mayaVerified).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'listings/old'), {
        status: 'active',
        publishedAt: serverTimestamp(),
        expiresAt: inDays(30),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test("can't relist someone else's listing", async () => {
    await seedListing('old', { ...newDraft('maya', complete), status: 'expired', listerFirstName: 'Maya', listerSince: 'Oct 2026', createdAt: Timestamp.now() })
    const db = env.authenticatedContext('jake', { email: 'jake@colostate.edu', email_verified: true }).firestore()
    await assertFails(
      updateDoc(doc(db, 'listings/old'), { status: 'active', publishedAt: serverTimestamp(), expiresAt: inDays(30), updatedAt: serverTimestamp() }),
    )
  })
})

describe('admin', () => {
  const adminAuth = { email: 'jorge@colostate.edu', email_verified: true }
  beforeEach(async () => {
    await seedLiveListing()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/jorge'), { addedAt: Timestamp.now() })
      await setDoc(doc(ctx.firestore(), 'reports/r1'), {
        reporterId: 'jake', targetType: 'listing', targetId: 'live', reason: 'scam', details: '', status: 'open', createdAt: Timestamp.now(),
      })
    })
  })
  const adminDb = () => env.authenticatedContext('jorge', adminAuth).firestore()
  const moderate = (status, extra = {}) => ({
    status, updatedAt: serverTimestamp(), moderatedBy: 'jorge', moderatedAt: serverTimestamp(), moderationReason: 'Reported as a scam', ...extra,
  })

  test('nobody can make themselves an admin', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('jake', jakeVerified).firestore(), 'admins/jake'), { x: 1 }))
  })

  test('admins (by admins/{uid} doc) read reports and listings in any status', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'reports/r1')))
    await seedListing('hidden1', { ...newDraft('maya', complete), status: 'hidden', createdAt: Timestamp.now() })
    await assertSucceeds(getDoc(doc(adminDb(), 'listings/hidden1')))
    await assertSucceeds(getDocs(collection(adminDb(), 'users')))
  })

  test('admins can hide, restore and remove a listing, with a reason', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'listings/live'), moderate('hidden')))
    await assertSucceeds(updateDoc(doc(adminDb(), 'listings/live'), moderate('active')))
    await assertSucceeds(updateDoc(doc(adminDb(), 'listings/live'), moderate('removed')))
    await assertFails(updateDoc(doc(adminDb(), 'listings/live'), moderate('active'))) // removed is final
  })

  test("admins can't edit listing content, and non-admins can't moderate", async () => {
    await assertFails(updateDoc(doc(adminDb(), 'listings/live'), { ...moderate('hidden'), rentCents: 100 }))
    await assertFails(updateDoc(doc(env.authenticatedContext('jake', jakeVerified).firestore(), 'listings/live'), { ...moderate('hidden'), moderatedBy: 'jake' }))
  })

  test('admins resolve reports', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'reports/r1'), { status: 'actioned', reviewedBy: 'jorge', reviewedAt: serverTimestamp(), adminNote: 'Hid it' }))
  })

  test('a suspended student can no longer post, message or report', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'suspensions/jake'), { reason: 'Scam messages', by: 'jorge', at: serverTimestamp() }))
    const jakeDb = env.authenticatedContext('jake', jakeVerified).firestore()
    await assertSucceeds(getDoc(doc(jakeDb, 'suspensions/jake')))
    await assertFails(startAs(jakeVerified, 'jake'))
    await assertFails(addDoc(collection(jakeDb, 'reports'), {
      reporterId: 'jake', targetType: 'listing', targetId: 'live', reason: 'scam', details: '', status: 'open', createdAt: serverTimestamp(),
    }))
  })

  test('admin actions are logged and append-only', async () => {
    const ref = await addDoc(collection(adminDb(), 'adminActions'), {
      adminId: 'jorge', action: 'hide', targetType: 'listing', targetId: 'live', reason: 'Reported as a scam', at: serverTimestamp(),
    })
    await assertFails(updateDoc(ref, { reason: 'edited' }))
    await assertFails(addDoc(collection(env.authenticatedContext('jake', jakeVerified).firestore(), 'adminActions'), {
      adminId: 'jake', action: 'hide', targetType: 'listing', targetId: 'live', reason: 'x', at: serverTimestamp(),
    }))
  })
})

describe('everything else', () => {
  test('unknown collections are denied, even for verified students', async () => {
    const db = env.authenticatedContext('maya', { email: 'maya.r@colostate.edu', email_verified: true }).firestore()
    await assertFails(setDoc(doc(db, 'messages/abc'), { text: 'Hi' }))
    await assertFails(getDoc(doc(db, 'reports/abc')))
  })
})
