import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'

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
export const auth = getAuth(app)
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

// Analytics only runs on deployed builds, so local testing doesn't pollute GA4.
export const analytics = import.meta.env.PROD
  ? isSupported().then((ok) => (ok ? getAnalytics(app) : null))
  : Promise.resolve(null)
