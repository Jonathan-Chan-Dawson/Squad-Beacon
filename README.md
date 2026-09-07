# Squad Beacon

An Expo SDK 57 / TypeScript pilot for friends who want to turn intentions into shared activities.

## Run it

Use Node 24 (tested with 24.12.0) and npm in the project’s WSL directory.

```sh
npm ci
npm start
```

Press **Explore the demo** to try the app without accounts or credentials. Demo people are fictional; changes last only for that demo session. Demo never uploads photos, sends push notifications, or shares device location.

For a browser preview:

```sh
npm run export:web
node scripts/serve-preview.cjs
```

Open http://127.0.0.1:4173. Web provides an activity list instead of native maps and background location. Real phone testing needs an Expo development build, not just Expo Go.

## Implemented pilot

- Map, Activities, Squads, Progress, and Profile tabs; create/edit/cancel/complete activities.
- Separate activity mode and audience. Solo, Squad, and Invite-only activities; Interested, Going, approval requests, host invitations/removals, comments and reactions.
- Three optional starter goal slots, additional goals, milestones, progress, schedule-aware habits, daily check-ins, personal bests, badges, and weekly recap.
- Accepted friendships, exact username invitations, deep links and QR invitations, private friend lists, shared squads with owners/admins and explicit invitations.
- Verified email/password accounts, password recovery, age eligibility, private compressed avatars, report/block/delete flows, and restricted moderator reports/metrics.
- Temporary location sharing to selected accepted friends; up to four hours, only latest point, five-minute freshness, explicit stop.
- Supabase schema, RLS and transactional commands; generic realtime inbox notifications plus fresh authorized snapshots every 15 seconds.
- Durable push queue, retries, Expo ticket receipts, device-token cleanup, quiet hours, habit/activity reminders, SQL cleanup schedules.
- In-app privacy/community text and public support-page draft.

Premium, paid subscriptions, ads, points, direct messaging, stranger discovery, recurring events, calendar integration and challenges remain deferred as agreed. All pilot features are free.

## Connect a real backend

1. Create a Supabase project in your chosen US region. Copy `.env.example` to `.env`; set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in the mobile app.
2. Install/use the Supabase CLI (`npx supabase`). Run `npx supabase login`, `npx supabase link --project-ref YOUR_REF`, then `npx supabase db push`. Apply all three migrations before serving clients.
3. Require confirmed email, a minimum ten-character password, and production SMTP. Configure Resend with a verified sending domain in Supabase Auth. The default Supabase sender is not a production email service.
4. Add `squadbeacon://auth/callback` to Auth redirect URLs. The app handles PKCE `code` links and `token_hash` links with `type=signup` or `type=recovery`. For verification across devices, customize the Supabase email templates to use the token-hash callback. Browser auth redirects need the deployed web origin added explicitly.
5. Deploy `delete-account` and `push-worker` with `npx supabase functions deploy FUNCTION_NAME`. Both verify requests inside their handlers: deletion validates the bearer token with Auth; the worker requires its secret header. Do not remove those checks when using `verify_jwt=false`.
6. Set server-only `WORKER_SECRET` to a cryptographically random secret. Configure `WEB_ORIGINS` as a comma-separated allowlist if using web account deletion. Optionally set `EXPO_ACCESS_TOKEN` when Expo enhanced push security is enabled. Supabase supplies the server URL/service-role environment values.
7. In Supabase Vault, create `beacon_worker_url` and `beacon_worker_secret`; the latter must match `WORKER_SECRET`. Run `supabase/schedules.sql` in the SQL editor to schedule minute-level delivery and independent cleanup. Monitor failed cron and function runs.
8. After an operator account finishes onboarding, appoint a moderator from the trusted SQL editor:
   `update private.accounts set moderator=true where id='OPERATOR_AUTH_USER_UUID';`
   The role is never editable by clients. The moderator’s Profile shows the safety inbox.
9. Set `EXPO_PUBLIC_SUPPORT_EMAIL`. Replace the public support draft with the operator’s reviewed privacy policy, contact information, providers, retention details, and community standards before distribution.

No cloud project, paid account, deployment, or store listing has been created automatically. Real account and provider setup requires your credentials.

## Mobile builds

Set `EXPO_PUBLIC_EAS_PROJECT_ID` after `eas init`. Default application identifiers are `com.squadbeacon.app`; change them before creating store records if that namespace is not yours.

For Android, enable **Maps SDK for Android** and set `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment. Restrict the key to the application package and the correct development/Play signing certificate. iOS uses Apple Maps.

```sh
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Test with physical iOS and Android phones. Push requires EAS project configuration and APNs/FCM credentials. Temporary background location requires foreground and background permissions. The OS can stop updates after termination or due to battery restrictions; the UI must never be treated as guaranteed live tracking.

The project keeps Expo SDK 57. Relevant exact-version references:

- https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
- https://docs.expo.dev/versions/v57.0.0/sdk/location/
- https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/
- https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run export:web
npx playwright install chromium
npm run test:e2e
```

The database tests execute the real migration SQL in embedded PostgreSQL (PGlite), using a small Auth/Storage schema harness. They verify RLS and transactional behavior, including direct API-equivalent unauthorized reads and writes. They do not replace hosted Supabase Auth, Storage HTTP, Realtime, Edge Function or phone testing.

Browser tests exercise the demo’s RSVP/comment, goals, habits, squad creation and activity creation flows. On Windows they use installed Chrome; elsewhere they use Playwright Chromium.

The installed dependency audit reports 15 moderate advisories (the same count reported before feature dependencies were added). Review the dependency audit before public release; no forced SDK upgrade was applied.

Type-check Edge Functions separately with Deno:
`deno check --config supabase/functions/deno.json supabase/functions/delete-account/index.ts supabase/functions/push-worker/index.ts`.

## Privacy and operational boundaries

- The server enforces permissions immediately. Previously fetched content cannot be recalled from a recipient’s device. Foreground clients replace snapshots every 15 seconds and on inbox updates, clear data after fetch errors, and clear protected memory on background/sign-out. Reopening a screen never grants server access.
- Meeting details live in a separate protected table. Approval-gated activities hide them until approval/invitation. Removed attendees have explicit exclusions even if they still match the general audience.
- Live location recipients must be accepted friends for all ages, a deliberately simple pilot default. No route history or durable offline coordinate queue exists. Expired/stopped sessions deny reads even if cleanup is delayed.
- Stopping while offline shuts down the device task; the existing server point may remain readable until its five-minute freshness window or session expiry. Reconnect to revoke server access.
- Private avatar bytes are fetched through authenticated storage downloads and kept only in component memory; the app does not create public URLs or long-lived signed URLs.
- Push payloads contain generic notification text, no coordinates, comment bodies or private goal text. Workers recheck access and quiet hours before dispatch. Delivery is at-least-once: a worker crash after Expo accepts a push can cause a duplicate push, although inbox actions and queue rows are deduplicated.
- Safety reports are retained for 90 days; deleted reporters are unlinked. Notices last 30 days; action deduplication records last seven days; coarse usage events last 90 days.
- Metrics store action categories and relational identifiers only. They contain no coordinates, birth dates, titles, or comment text. The moderator dashboard exposes aggregate activity and queue counts.
- The authorized snapshot API is intentionally sized for a small pilot. Before broader release, add pagination and incremental subscriptions, quantify database/egress use, add central crash reporting with content scrubbing, and verify provider-specific limits.
- No claim of legal compliance is made by the 16+ age gate. Complete the US youth/privacy and store review with the actual operator and distribution setup.

## Pilot and monetization

Recruit 5–10 existing friend groups (30–100 people) through your own approved channels. Watch whether groups repeatedly organize activities without prompting. Review invitation acceptance, repeat activity, weekly active squads, check-ins, reports, failed pushes, database size and egress.

Budget a small pilot at roughly $25–$75/month, excluding labor, store accounts, domains, taxes and overages. Start with Supabase Pro around $25/month and Expo free allowances; upgrade based on measured usage. Prices must be rechecked before purchase.

Keep the core free. After validation, test premium at $3.99/month or $29.99/year for deeper insights, themes, advanced reminders and planning templates. Add RevenueCat and native store billing at that stage, including purchase restoration and server-verified entitlements. Privacy and blocking remain free.
