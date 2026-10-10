// Storage security rules tests. Run with: npm run test:rules
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { getBytes, ref, uploadBytes } from 'firebase/storage'

let env

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-handoff-rules',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
after(() => env.cleanup())
beforeEach(() => env.clearStorage())

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const asJpeg = { contentType: 'image/jpeg' }
const anon = { firebase: { sign_in_provider: 'anonymous' } }
const maya = { email: 'maya.r@colostate.edu', email_verified: true, firebase: { sign_in_provider: 'password' } }

describe('listing photos', () => {
  test('owner (even anonymous, while drafting) can upload a JPEG to their own folder', async () => {
    const s = env.authenticatedContext('maya', anon).storage()
    await assertSucceeds(uploadBytes(ref(s, 'listing-photos/maya/l1/p1.jpg'), jpeg, asJpeg))
  })

  test("can't upload into someone else's folder", async () => {
    const s = env.authenticatedContext('jake', anon).storage()
    await assertFails(uploadBytes(ref(s, 'listing-photos/maya/l1/p1.jpg'), jpeg, asJpeg))
  })

  test('only JPEGs', async () => {
    const s = env.authenticatedContext('maya', anon).storage()
    await assertFails(uploadBytes(ref(s, 'listing-photos/maya/l1/p1.png'), jpeg, { contentType: 'image/png' }))
  })

  test('signed-out visitors can view a photo but not upload', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      uploadBytes(ref(ctx.storage(), 'listing-photos/maya/l1/p1.jpg'), jpeg, asJpeg),
    )
    const s = env.unauthenticatedContext().storage()
    await assertSucceeds(getBytes(ref(s, 'listing-photos/maya/l1/p1.jpg')))
    await assertFails(uploadBytes(ref(s, 'listing-photos/maya/l1/p2.jpg'), jpeg, asJpeg))
  })
})

describe('avatars', () => {
  test('a signed-up student can upload their own avatar', async () => {
    const s = env.authenticatedContext('maya', maya).storage()
    await assertSucceeds(uploadBytes(ref(s, 'avatars/maya.jpg'), jpeg, asJpeg))
  })

  test("anonymous accounts and other people's avatars are blocked", async () => {
    await assertFails(uploadBytes(ref(env.authenticatedContext('maya', anon).storage(), 'avatars/maya.jpg'), jpeg, asJpeg))
    await assertFails(uploadBytes(ref(env.authenticatedContext('jake', maya).storage(), 'avatars/maya.jpg'), jpeg, asJpeg))
  })
})
