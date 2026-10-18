# Profiles: living experience

Both full person profiles use the same identity, current/next Beacon, Overview / Beacons / About sections, album mosaic, and privacy-filtered selectors. Own-profile shortcuts lead into My Collection and Settings; privacy, temporary location sharing, platform-supported widgets, and moderation remain in their existing destinations.

Albums are derived from the profile owner's contributions to completed Beacons. Hosted and approved-Going participation is separate and remains in history without requiring uploads. Opening an album uses the existing Experiences tool route. No new media audience or public storage policy is introduced.

## Backend rollout

`20261018080702_profile_living_experience.sql` adds the bounded `profile_content_page` read API and a viewer-safe hide-featured projection. Deploy after the existing chronological application migrations, before shipping this client. The current user must still pass profile, activity, participation, and contribution-author authorization. Storage signing uses the existing private bucket policy.

The configured hosted project was inspected during implementation: it reports no migrations and lacks `private.profile_snapshot_data`, `private.beacon_approved_going`, and `private.social_active`. Consequently this additive migration was **not applied to that project**. Initialize the existing application schema in the intended deployment environment first; do not apply this one migration to an empty database or silently bootstrap an unrelated project. The complete migration chain, including this migration, is validated in disposable PGlite databases.

The existing activity-history API remains unchanged. `profile_content_page` accepts a target person, `all` / `upcoming` / `past` / `albums` filter, search text, keyset cursor, and bounded page size. Its results include contribution counts and cover paths, never signed URLs. Missing and restricted profiles return empty results. Personal counts and other-viewer counts have matching, explicitly labeled destinations.

## Verification

The full domain/database suite passed all 397 tests. After final selector refinements, all 31 focused profile/history/privacy tests passed again. The final browser run passed 12 checks. TypeScript, zero-warning lint, the web export, and Git whitespace checks passed.

- Domain/database coverage exercises participation without uploads, per-author album counts, deterministic pagination, hidden/expired/solo featured choices, profile and block revocation, storage-adjacent participant gates, and anonymous/session rejection.
- Browser coverage exercises both profile types at 360, 390, and 430 pixels in light and dark appearance, reduced motion, search state across tabs, and retained safety actions. Screenshots are written under `test-results/profile-*`.
- The existing demo account has no contributed albums, so visual review of that account uses its honest empty state. Photography overlays use a fixed dark gradient and white foreground in both themes; unavailable covers use category artwork.
- No Android device or emulator was connected during implementation. Native safe-area, enlarged system text, and frame-rate checks remain device acceptance work.

Profiles inherit the app's existing static-preview initial hydration warning. Profile browser tests begin collecting runtime errors after demo entry so that profile navigation is checked independently of that initial document warning.
