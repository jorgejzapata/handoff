// Firestore security rules tests. Run with: npm run test:rules
// (starts the Firestore emulator, runs these, then shuts it down)
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

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

describe('everything else', () => {
  test('unknown collections are denied, even for verified students', async () => {
    const db = env.authenticatedContext('maya', { email: 'maya.r@colostate.edu', email_verified: true }).firestore()
    await assertFails(setDoc(doc(db, 'listings/abc'), { title: 'Hi' }))
    await assertFails(getDoc(doc(db, 'listings/abc')))
  })
})
