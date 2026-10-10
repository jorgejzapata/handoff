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
