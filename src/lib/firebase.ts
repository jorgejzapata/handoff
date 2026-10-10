import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { getAnalytics, isSupported, setAnalyticsCollectionEnabled } from 'firebase/analytics'
import { analyticsAllowed } from './settings'

// Web config for handoff-dev. This is not a secret: it ships in every
// Firebase web app. Security comes from the rules files, not from hiding this.
const firebaseConfig = {
  apiKey: 'AIzaSyBomTmhpE6oxU5IJwxB29XCbxP8xX6wfDk',
  authDomain: 'handoff-dev-e63cc.firebaseapp.com',
  projectId: 'handoff-dev-e63cc',
  storageBucket: 'handoff-dev-e63cc.firebasestorage.app',
  messagingSenderId: '319974667369',
  appId: '1:319974667369:web:a643fa69d29cfa4dac9ef8',
  measurementId: 'G-P6K8KV93PM',
}

export const app = initializeApp(firebaseConfig)
// Stay signed in until you log out: the session lives in IndexedDB (or
// localStorage as a fallback) and refreshes itself, with no time limit.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
})
export const db = getFirestore(app)
export const storage = getStorage(app)

// `npm run dev` talks to the local emulators, never the real project.
// Set VITE_USE_EMULATORS=false in .env.local to point dev at the real project.
export const usingEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false'

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

// Analytics only runs on deployed builds, so local testing doesn't pollute GA4,
// and never starts when the student turned "Share usage analytics" off.
let analyticsPromise: ReturnType<typeof startAnalytics> | null = null

function startAnalytics() {
  return isSupported().then((ok) => (ok ? getAnalytics(app) : null))
}

export function getAnalyticsIfAllowed() {
  if (!import.meta.env.PROD || !analyticsAllowed()) return Promise.resolve(null)
  analyticsPromise ??= startAnalytics()
  return analyticsPromise
}

void getAnalyticsIfAllowed()

// Called from Account settings when the toggle changes.
export async function setAnalyticsEnabled(on: boolean) {
  if (!import.meta.env.PROD) return
  if (on) {
    const a = await getAnalyticsIfAllowed()
    if (a) setAnalyticsCollectionEnabled(a, true)
  } else if (analyticsPromise) {
    const a = await analyticsPromise
    if (a) setAnalyticsCollectionEnabled(a, false)
  }
}
