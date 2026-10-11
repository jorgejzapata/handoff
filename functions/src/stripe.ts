import Stripe from 'stripe'
import { defineSecret } from 'firebase-functions/params'

// Shared Stripe setup for boosts and the listing fee.
//
// Secrets (set once per project):
//   firebase functions:secrets:set STRIPE_SECRET_KEY -P dev    (sk_test_...)
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET -P dev (whsec_...)
// and the same with -P prod and live keys.
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')

export function stripe() {
  return new Stripe(STRIPE_SECRET_KEY.value())
}
