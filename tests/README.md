# App testing

- `fixtures/neighborhood.ts`: fictional demo neighborhood: 36 profiles, 23 accepted friends, 12 discoverable people, live statuses, future plans and temporary shared locations. Only `startDemo()` loads it; never seeds a real account or a remote database.
- `domain.test.ts`: domain behavior.
- `database.test.ts`: migrations and access checks in an isolated PGlite database.
- `browser/`: phone-sized Playwright flows.

Run `npm test`, `npm run export:web -- --max-workers 2`, then `npm run test:e2e`.

In demo: Beacons > Find friends. Search a fictional profile, send a request, then use the clearly marked simulated acceptance action. Leave/re-enter demo to reset all changes. Real accounts continue to use username, QR and contact invitations.
