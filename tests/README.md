# App testing

- `fixtures/neighborhood.ts`: fictional base neighborhood with 36 profiles, 23 accepted friends, live statuses, future plans and temporary shared locations. The composed demo adds 34 profiles as actual members of the 35-person Huge Squad (70 profiles total); 46 are not incoming friend-request targets. Only `startDemo()` loads this fixture; never seeds a real account or a remote database.
- `domain.test.ts`: domain behavior.
- `database.test.ts`: migrations and access checks in an isolated PGlite database.
- `organizations.test.ts` and `organizations.database.test.ts`: organization role/domain behavior and PGlite authorization, chat, audience, profile-grant, and deletion-audit coverage.
- `browser/`: phone-sized Playwright flows.

Run `npm test`, `npm run export:web -- --max-workers 2`, then `npm run test:e2e`.

In demo: Beacons > Find friends. Search a fictional profile, send a request, then use the clearly marked simulated acceptance action. Leave/re-enter demo to reset all changes. Real accounts continue to use username, QR and contact invitations.
