# Squad Beacon

An Expo SDK 57 / TypeScript pilot for friends who want to turn intentions into shared activities.

## Run it

Use Node 24 and npm. For the Windows Android emulator, run commands in PowerShell from the Windows checkout so Metro and Android SDK tools run on the same host.

```sh
npm ci
npm start
```

### Android development startup

With a development build already installed and an emulator running (or a USB-debugging phone connected), run:

```sh
npm run start:android
```

This starts Metro on IPv4 localhost and opens the development build through ADB. IPv4 is selected explicitly because ADB forwards to `127.0.0.1`, while Windows may otherwise bind Metro only to IPv6 `::1`. Keep the terminal running. `npm run android` builds and installs the native app when needed; `start:android` reconnects an existing build without rebuilding it.

For a physical phone over Wi-Fi, or when Metro runs in WSL, use:

```sh
npm run start:tunnel
```

If Expo prompts to install `@expo/ngrok`, accept the installation. Open the new QR code/link in the Squad Beacon development build. Both devices need internet access for the tunnel.

`java.net.ConnectException` / `ECONNREFUSED` on port **8081** means the development build cannot reach Metro. Return to the development launcher and open the new server link instead of retrying a saved address such as `172.17.60.27:8081`. For localhost/USB connections, check `adb devices` and, if necessary, run `adb reverse tcp:8081 tcp:8081` from the same host as Metro. This error occurs before the app's map can load. See the [Expo CLI connection documentation](https://docs.expo.dev/more/expo-cli/#server-url).

To install an Android app that starts without Metro, build and install the preview APK:

```sh
npx eas-cli build --profile preview --platform android
```

Press **Explore the demo** to try the app without accounts or credentials. Demo people are fictional; changes last only for that demo session. Demo never uploads photos, sends push notifications, or shares device location.

For a browser preview:

```sh
npm run export:web
node scripts/serve-preview.cjs
```

Open http://127.0.0.1:4173. Web includes an interactive OpenStreetMap map. Native maps support street/satellite views and compass controls; the contacts picker runs on phones. Real phone testing needs an Expo development build, not just Expo Go.

## Implemented pilot

- Four tabs: Map, Beacons (Now / Upcoming / Past), Squads, and Profile. A raised circular Create button sits in the center. Notifications stays in tab headers; Profile has a Settings gear.
- Plans schedule a set of beacons in an IANA timezone. Plans can be personal or shared with a squad; squad templates are member-readable and admin-managed.
- Quick creation with More options, reusable starter templates, an optional live preview, completed-plan repeat suggestions, and optional crew targets.
- One-tap In/Maybe/Out, host approval only when selected, status-to-beacon conversion, and real written memories on completed plans.
- Explicit contact-picker invitations via SMS draft; contacts are never uploaded.
- Separate activity mode and audience. Solo, Squad, and Invite-only activities; Interested, Going, approval requests, host invitations/removals, comments and reactions.
- Friends Now prioritizes explicitly free friends and private favorites. One favorite manager covers friends and squads; private lists remain sharing audiences.
- Personal templates, inline map RSVP/details/comments/participant chat, and accepted-friend messages. Goals and habits are removed from the UI; historical database tables remain for migration compatibility.
- Accepted friendships, exact username invitations, deep links and QR invitations, private friend lists, shared squads with owners/admins and explicit invitations.
- Verified email/password accounts, password recovery, age eligibility, private compressed avatars, report/block/delete flows, and restricted moderator reports/metrics.
- Temporary location sharing to selected accepted friends; up to four hours, only latest point, five-minute freshness, explicit stop.
- Supabase schema, RLS and transactional commands; generic realtime inbox notifications plus fresh authorized snapshots every 15 seconds.
- Durable push queue, retries, Expo ticket receipts, device-token cleanup, quiet hours, habit/activity reminders, SQL cleanup schedules.
- In-app privacy/community text and public support-page draft.

Premium, paid subscriptions, ads, points, stranger discovery, recurring events, calendar integration and challenges remain deferred as agreed. All pilot features are free.

Notification handling and native contacts setup: [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md). Apply the `202609290001_simple_beacons.sql` migration and redeploy the push worker for crew targets, status conversion, and notification deep links. Apply `202610010001_plans_profile_survey.sql` to enable Plans, squad plan templates, aspiration links, and the profile survey in connected accounts. Apply `202610010002_beacon_modules.sql` for collaborative beacon checklists and shared notes; apply `202610010003_shared_libraries.sql` for revision-safe author note edits and private per-user library folders; apply `202610010004_planning_threads.sql` and `202610010005_beacon_controls.sql` for planning threads, capacity/role/arrival controls, tool switches, and persistent invitations. Apply `202610030001_profile_privacy.sql` to enable authenticated full-profile audiences and privacy-filtered profile/location/avatar access. Public preserves existing in-app relationship discovery; it does not make profiles internet-public. Custom profile access is the OR of selected people, current members of selected squads, and members of selected private lists. Profile privacy never grants GPS access; location still requires explicit sharing and remains subject to profile access. Folders organize a participant's view and never grant access to a beacon. Turning a tool off pauses new writes but keeps authorized history readable. An invitation remains separate from Going and survives I'm Out until the host removes it. Existing profiles are marked as survey-skipped; new accounts start pending. `npx supabase db push` applies pending migrations; no remote deployment is performed by this workspace task. Rebuild the native app for expo-contacts.

## Connect a real backend

1. Create a Supabase project in your chosen US region. Copy `.env.example` to `.env`; set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in the mobile app.
2. Install/use the Supabase CLI (`npx supabase`). Run `npx supabase login`, `npx supabase link --project-ref YOUR_REF`, then `npx supabase db push`. Apply all migrations in `supabase/migrations` before serving clients.
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

For Android, enable **Maps SDK for Android** and set `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment (or local `.env` for local builds). The maps plugin uses that value, falling back to the existing `android.config.googleMaps.apiKey` in `app.json`. Restrict the key to the application package and the correct development/Play signing certificate. Rebuild the native app after changing the key; restarting Metro alone does not update native map credentials. iOS uses Apple Maps.

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

Browser tests exercise the demo’s Now/favorites, RSVP/chat, personal templates, Profile/Settings, Notifications, organizations and narrow-screen flows. On Windows they use installed Chrome; elsewhere they use Playwright Chromium.

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

Map workspace migration: apply `supabase/migrations/202609290002_map_workspace.sql` before using real-account templates, favorites, chat, availability, and extra profile fields. It is covered by local database acceptance tests; this change does not deploy the remote database.

## Playful neighborhood update

- Friends Now uses compact vertical status rows with direct stars, message/profile targets and Free/Starred filters. Demo Find Friends uses fictional profiles; no real accounts are created.
- Test fixture data lives in `tests/fixtures/neighborhood.ts`; test instructions live in `tests/README.md`.
- Tap your Profile avatar to style the built-in SVG character (216 combinations). Uploaded photos remain supported in Edit profile. Apply `202609290003_mini_avatars.sql` to persist choices for real accounts.
- Mint, Sunset, Midnight, Ocean and Berry each have light/dark versions, with Midnight/Dark as the fresh-install default. Settings → Appearance saves the palette and Device/Light/Dark choice separately. Device follows system changes; legacy saved themes retain their former appearance.
- Map selection opens an inline RSVP tooltip positioned relative to the map coordinate. Details opens a separate translucent workspace with Overview, People, Comments and Chat. No native callout or modal is used for RSVP.

Avatar art is generated locally from a bounded numeric seed; this is an original simple illustration system, not a Snapchat/Bitmoji integration. Web map avatars are illustrated; private uploaded photos remain in app profile views. Live-location illustrations still respect permission and freshness checks. Theme transparency is a tinted overlay, not a native blur effect.

## Spaces, Organizations and Routines

Squads centers Chats and Communities. Search and chat filters appear only when requested. Actionable Pings sit above conversations with direct responses; Squad Pings jump to their source-linked card in Squad chat. Invitations and further decisions use a compact secondary sheet.

Spaces are independent lightweight homes for Squads. Create one with a name, then invite accepted friends and connect Squads you manage. Space invitations require acceptance. Space membership never enrolls people in a Squad or reveals private Squad links, rosters or chat. Organizations remain independent and provide the richer role hierarchy, invitations/bans, linked Squads and shared chat. Neither community membership nor profile access grants GPS sharing.

Apply `202610040006_spaces.sql` after the existing October 4 migrations to enable Spaces for connected accounts. Its RLS, action dispatcher and snapshot changes are covered locally; no hosted migration is applied automatically. Chat photo/GIF attachments and direct location messages are not offered until their storage and permission contracts exist.

The final social architecture adds independent discoverability, joining and invitation settings; shared community roles; authenticated paginated discovery; join-request review; and Organization → Space → Squad links. Community cards open a quick preview before the full profile. Public discovery returns safe summaries, never private chat, rosters, profile grants or coordinates.

Apply `202610040007_social_architecture.sql` after `202610040006_spaces.sql` for these connected-account contracts. Existing communities retain private/invite-only defaults. Organizing a Squad into a Space preserves the original Squad and its history; copying eligible members requires explicit confirmation. Grouping multiple Squads only adds links. Beacon community associations are separate metadata and never change audience access. This workspace does not apply remote migrations.

Apply `202610040001_organization_audience_type.sql` before `202610040002_organizations_group_chat.sql`, committing the enum migration before it is used. Apply `202610040003_plan_routines.sql` for independent Plan membership and recurring schedules. Routine generation reuses Plans rather than a second Beacon scheduler. See [the Plan inventory](src/features/plans/_inventory.md) for trusted runner setup. Local tests do not deploy these migrations or activate hosted automation.

Plans, Favorites and My templates shortcuts are confined to Activities → Past. Widget Studio is in Profile; native widgets require an iOS rebuild and do not run on Android/web/Expo Go. Quick Create reuses existing Beacon/Status/Plan editors. Outstanding acceptance and product gaps are tracked in [the refinement ledger](REMAINING_UI_CHANGES.md).
