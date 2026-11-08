# BEACON+ tools and Squad Boosts — local validation

This is a dated implementation record. [README](../README.md#premium-tools-and-squad-boosts) owns current setup instructions; feature inventories own code navigation. Earlier working-tree changes, including Plan creation, the template browser and Map work, were preserved.

## Local implementation

The three additive migrations introduce unlimited incrementally loaded Checklists, paid assignments/deadlines/reminders, configuration-only advanced tools and presets, private verified Boost allowances, allocation lifecycle records, authorized shared entitlement projections and Squad-aware Routine eligibility:

- `20261107011114_premium_tools_checklists.sql`
- `20261107012458_premium_beacon_tools.sql`
- `20261107014652_squad_boost_lifecycle.sql`

Squad Overview opens one focused Boost management route. Premium shows allowance, allocations, available slots and cooling slots. Demo totals are independent of personal allocation records; manual contributions clear a Squad's total override. Personal template quotas remain 10/50/unlimited and 2/10/unlimited. No billing or purchases were implemented.

Advanced tools expand within their existing module. Presets never carry participation, invitations, scores or private entries. Local focus persistence uses account/Beacon/session keys and chunked storage with absolute deadlines. Journal rendering retains plain text and only recognizes HTTPS links. Memory collections and Afterglow retain references and recheck source access. Plan preparation shows loaded authorized tasks and links to complete Checklists rather than presenting a separate task system.

## Verified behavior

- Premium tools: ordered migration history in PGlite, TypeScript/SQL feature-tier parity, forged tier rejection, private-record write denial, more than the former item/section limits, bounded snapshot plus cursor paging, reminder replay, configured scoring, Journal privacy and reference-only media authorization.
- Boost lifecycle: pooled benefits for a Free organizer, owner-only contribution controls, capacity and transfer waits, non-extending grace, grant-expiry-based transition timestamps, membership-loss reconciliation, Routine pause and explicit resume. Demo checks retain the oldest allocations on downgrade and preserve cooling slots on upgrade.
- Plan suite: **54 passed** across draft, recurrence, Calendar and database cases.
- Premium/module/draft regression selection: **57 passed**.
- Existing Council, publication and profile-permission database selection: **9 passed**.
- Browser journeys: Premium and Plan editor **8 passed**; tools/Boost/focus **4 passed**; Your Activity workspace **16 passed**; Library **2 passed**. Library tests now select Plus before creating paid folders/Lists and use the current Library navigation; their content and privacy assertions remain intact.
- Web export: **58 routes**, including `/settings/premium` and `/squad-boosts`.
- `npm run typecheck` and `npm run lint` completed successfully; `git diff --check` found no whitespace errors.
- Screenshots reviewed locally: narrow light/dark Boost management and the inline focus sequence. Artifacts are under `.expo/` and Playwright's output directory.

Commands and detailed output were retained locally under `.expo/premium-tools-*.log`. The focused suites are `npm run test:premium-tools`, `npm run test:premium` and `npm run test:plans`; additional selections are listed in [tests/_inventory.md](../tests/_inventory.md).

## Rollout boundaries

No hosted migration, verified grant mutation, trusted-runner activation or push delivery was performed. PGlite executes the complete ordered SQL history but does not prove multi-connection PostgreSQL advisory-lock behavior. Before hosted rollout, exercise simultaneous allocation/withdrawal, grant expiry/downgrade and membership removal against isolated PostgreSQL, then verify actual runner/push delivery and native-device behavior. Native background/reopen timer and SecureStore acceptance also remain device checks.

An older backend keeps supported Free actions; advanced features are capability-gated. Shared Premium access remains independent of resource permissions and never upgrades private Library/Journal access.
