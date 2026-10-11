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
once. Boosts unlock at 25 live listings. Both counts live in `stats/listings`,
kept by the `onListingStatusChange` function, and skip internal accounts:
flip "Test account" in Admin → Users for Jorge and the test accounts.

Switches live in one Firestore doc, `config/pricing`, edited in the Firebase
console (no redeploy):

| Field          | Values                       | Missing means                 |
| -------------- | ---------------------------- | ----------------------------- |
| `listingFee`   | `"off"`, `"test"`, `"stripe"` | `"test"` on dev, `"off"` on prod |
| `freeListings` | number of free spots         | 50                            |

- `"stripe"`: real Stripe Checkout; the webhook publishes the listing once
  paid, and the rules stop the app publishing for free.
- `"test"`: a fake checkout, no card (dev only; prod treats it as off).
- To try a real test payment on dev: set `listingFee: "stripe"` and
  `freeListings: 0`, then pay with card `4242 4242 4242 4242`.

To preview the paid screens locally without Stripe, open any page with
`?devPublished=60` (and `&devLive=30` for boosts); `?devPublished=clear` resets.
