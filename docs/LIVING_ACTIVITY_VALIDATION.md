# Pass 3: Living Activity and social creation

Profile keeps identity, bio, location, Friends/counts, and the Edit Profile / Share Profile / QR row above the presence section. Availability, Status Note, Current Activity, and compact Sonar follow; smaller Featured and private Up Next previews sit below them.

## Behavior

- The empty Current Activity is one compact accessible target, with a decorative plus. Eligible live Beacons have a separate quiet text action.
- Activity Notes use category artwork, a subdued Solo label, direct one-tap editing, separate Do with others, and overflow management. They have no attendance tools.
- Status text, availability, Activity Notes, Current Beacon selection, Featured, and Sonar have independent controls. A fixed named place does not start location sharing or request GPS.
- Do with others reuses canonical Ping, Council, and template-first Beacon editors. Future planning leaves the note active. Guided Councils collect multiple options and retain completed publication steps when retrying.
- Current Beacon takeover requires existing sharing consent or an explicit confirmed selection. Superseded notes remain in private history and never resume automatically.
- Current Activity resolves the owner's selection before viewer authorization. Inaccessible selections have no alternate-content fallback. Shared projections serve Profile, Friends, homepage, and Map Person Preview.
- Creation drafts are session-only and account-scoped. Post-publication linking retries retain the created item ID. Audience selection respects each feature's supported canonical target and does not broaden unsupported selections.
- Featured/Current and Featured/Up Next duplicates render once. Up Next is owner-only; interest is not attendance.

## Database rollout

Apply `supabase/migrations/20261022173824_living_activity_presence.sql` after the existing migrations. This is an additive local migration; it has **not been applied to a hosted backend**.

Existing solo records default to ordinary Status Notes. The migration adds a solo-purpose discriminator and supersession metadata, private owner presence controls, atomic Activity Note save/end and takeover operations, bounded authorized projections, and the `living_activity` capability. It retains the existing Activity table, Status scheduling, canonical Planning actions, RSVP, and Sonar infrastructure.

Deploy the migration before relying on the capability. Older backends retain their existing Status interface and do not expose unsupported Activity Note controls. The migration fails closed if the expected legacy Status-writer shape has changed. Validate against a staging Supabase project before production rollout.

## Verification boundaries

Local verification on 2026-10-22:

- TypeScript and repository app/source/component lint passed. Focused lint was repeated after final component edits.
- 93 focused domain/database tests passed across Activity Notes, ordinary Status atomicity, Current Beacon, attachments, history, creation handoffs, RSVP privacy, snapshot normalization, communities, Map filtering and clustering.
- Web static export and Android/iOS Hermes exports passed, producing 49 static routes. Export output is local and ignored by Git.
- Eight browser tests passed against the final export. They cover the compact empty state and direct editing at 320, 375, 430 and 1024px, independent Status/availability, Ping and guided Council creation, explicit live takeover, light/dark Mint, keyboard entry, audience selection, enlarged text, minimum action target size, paused-sharing controls, visitor owner-control suppression, and Featured creation-sheet handoff.

Screenshots are local artifacts in `.expo/pass3/`. Profile action order is asserted in the browser tests; the empty Current Activity has no nested interactive button. The UI uses existing category artwork rather than external photos.

Database verification uses local PGlite with the repository migration chain and authenticated-role/RLS checks. It does not replace hosted Postgres verification. Browser verification uses the exported web app with demo data, rather than a hosted account.

Physical-device GPS, native screen-reader behavior, OS font scaling, real network/background lifecycle, and hosted-backend rollout remain manual checks. Android/iOS exports validate bundles, not device behavior. Web enlarged-text checks are a layout proxy for native accessibility font scaling.
