# Connected Planning 3.0 implementation status

Local implementation and validation recorded October 25, 2026. This report does not establish hosted deployment or native-device acceptance.

## Implemented

- Find a Time creation, stable candidate slots, zoned input, atomic availability, amendments, explicit finalization, zero-response confirmation after the deadline, and closure without publication.
- Pick One immediate saving and approval checkboxes with explicit saving. New Councils require explicit tie/zero-support resolution; historical Councils retain their policy.
- Compact option/result rows, segmented availability, radio selection, disclosures, native backup switches, and Planning-only centered confirmations. Responses filters are All / Pings / Decisions / Invites.
- Reviewed source-to-Beacon handoffs, restricted recovery context, canonical participation labels, direct Beacon access, and reconciliation when another actor publishes first. Availability, interest, and votes do not imply Going.
- Optional interest targets and private organizer messages. Backup-host eligibility, expiring account-bound claims, volunteer publication under the volunteer's identity, stored Draw results, deduplicated reminders, and terminal Not Organized closure.

## Database and rollout

[The additive migration](../supabase/migrations/20261025063145_connected_planning.sql) adds the scheduling, approval, recovery, claim, and policy contracts. It extends the existing action/request-identity dispatcher and authorized snapshot rather than replacing historical Council behavior.

Server operations revalidate actor identity, membership, source/destination access, deadlines, revisions, proposal validity, and claim ownership. Root continuation locks and unique relationships protect one authoritative source-linked Beacon; explicit Council replacement remains separately authorized. Private messages and recovery/claims are restricted to authorized readers.

Deploy and verify the schema before enabling the `connected_planning` capability. No hosted migration was applied in this session. Clients gate new actions when that capability is absent. Demo mode supports the interactive flows but does not establish server maintenance or claim-security acceptance.

## Validation evidence

- Full default selection: 547 tests passed, zero failures.
- Separate RSVP regression selection: 40 tests passed, zero failures.
- Latest dedicated database/domain selection: 8 tests passed, including application of all migrations in PGlite, authorization, historical behavior, amendments, publication races, expiry, and co-organizer/volunteer host identity.
- TypeScript and lint passed after UI cleanup. The full default test selection was rerun after the final source changes and again passed all 547 tests.
- An earlier web export succeeded. An intermediate browser run passed Time Finder review and canonical Beacon access; approval browser validation did not pass at that point. Its corrected test and the latest UI have not been browser-verified.

## Remaining acceptance

The refreshed web export/browser run was blocked by the automatic approval reviewer's account usage limit. No bypass was attempted. Final viewport coverage at 320, 375/390, 430 and desktop, light/dark inspection, keyboard/reduced-motion acceptance, native exports/device testing, and hosted Supabase verification remain incomplete. The earlier export and screenshots are not evidence for the final UI revision.

Existing unrelated working-tree changes were preserved. No deployment or commit was performed.
