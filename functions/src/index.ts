import { initializeApp } from 'firebase-admin/app'

initializeApp()

export { listingPage } from './share.js'
export { onNewMessage } from './email.js'
export { expireListings } from './expiry.js'
export { onUserCreated } from './welcome.js'
export { sendVerificationEmail } from './verify.js'
export { createBoostCheckout, stripeWebhook, expireBoosts } from './boosts.js'
