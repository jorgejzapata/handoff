# handoff

Student sublease marketplace, starting at CSU.

React + TypeScript (Vite) on Firebase: Auth, Firestore, Storage, Hosting.

## Run it locally

Two Terminal tabs, both in this folder:

```
npm install            # first time, and after pulling new dependencies
npm run emulators      # tab 1: local Auth, Firestore, Storage (UI at localhost:4000)
npm run dev            # tab 2: the app at localhost:5173
```

`npm run dev` always talks to the emulators, never the real project.
Emulator data is saved to `.emulator-data/` when you stop them with Ctrl+C.

## Deploy

```
npm run deploy         # builds, then deploys Hosting to handoff-dev
```

Firestore and Storage rules are deployed separately, on purpose:
`firebase deploy --only firestore:rules,storage`.

## Projects

- `handoff-dev-e63cc`: development (current)
- `handoff-prod`: not created yet

## Boosts (Stripe)

Boosts switch on at 25 live listings (`BOOST_GATE` in `functions/src/boosts.ts`
and `src/lib/boosts.ts`). 7 days $5, 30 days $15; verified .edu members get 20% off,
checked server-side from the auth token.

One-time setup per project (test keys on dev, live keys on prod):

```
firebase functions:secrets:set STRIPE_SECRET_KEY -P dev       # sk_test_...
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET -P dev   # whsec_..., from the endpoint below
```

In Stripe → Developers → Webhooks, add an endpoint:
`https://us-central1-<project-id>.cloudfunctions.net/stripeWebhook`, listening for
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed` and `checkout.session.expired`.

Then `npm run deploy:rules` (boostOrders rules) and `npm run deploy`.

## Pricing and the $1 listing fee

The first 50 listings ever published are free; after that, posting costs $1
once (`FREE_LISTINGS` in `src/lib/pricing.ts` and `functions/src/stats.ts`).
Boosts unlock at 25 live listings. Both numbers live in `stats/listings`, kept
by the `onListingStatusChange` function, and skip internal accounts: flip
"Test account" in Admin → Users for Jorge and the test accounts.

The $1 checkout runs in test mode on dev and localhost (no card, no charge).
Prod has it off, so posting stays free there until Stripe is wired up.
To preview the paid side locally, open any page with `?devPublished=60`
(and `&devLive=30` for boosts); `?devPublished=clear` resets.
