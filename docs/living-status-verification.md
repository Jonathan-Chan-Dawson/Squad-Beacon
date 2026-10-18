# Living Status implementation and verification

## Delivered

### Foundation

- Added private Current Beacon preferences and a compatibility capability in `20261018201912_living_status_current_beacon.sql`, following the attachment foundation migration `20261018184636_status_activity_attachments.sql`.
- Blank solo Status notes persist as empty text. Other activity types retain nonblank-title validation.
- Current Beacon selection uses authoritative lifecycle, hosting/cohosting, and approved Going information. Automatic selection happens before viewer authorization; inaccessible candidates are omitted without substitution.
- Hide Note suppresses text and featured attachments independently of Current Beacon opt-in. Paused sharing suppresses all viewer content while retaining owner configuration.
- Edits, renewals, and quick updates retain preferences. Independent future configurations default off. Stale Specific selections remain private and never become Automatic implicitly.

### Editor and viewer

- Preserved the editable note above the owner's avatar. Added an independent Current Beacon switch and a conditional Automatic/Specific selector, with an explicit reset for unavailable selections.
- Kept the shared viewer identity-first, with a nonblank note, one featured activity, quiet secondary actions, and at most one Current Beacon row.
- Matching featured/current Beacons merge into one card. Current-only Status has no empty bubble or placeholder.
- Added soft note shading and a downward tail, category-tinted featured artwork, and a shared icon-led React/Message row below the activity. Selected emoji remain visible; reactions use the existing picker and backend. Featured cards align type and deadline/state in one header. Ping responses use defined rounded borders, inline icons, and a mint selected state.

### Integration

- Profile and Friends use compact authorized indicators. Current Beacon navigation dismisses the sheet before opening the existing destination and preserves the originating context.
- Reused canonical Ping, Beacon, Vote, and permitted Draw interactions. Featuring or sharing does not change participation or lifecycle.
- Added guards against stale protected projections and known access/participation revocation. No timeline, feed, or new browsing route was introduced.
- CARTO remains web-only. Native map implementation and Android Google Maps were not changed by this refinement.

## Verification completed

- TypeScript passed.
- Changed-source ESLint passed.
- 22 foundation/control/route tests passed, including full local database migration-chain assertions for authorization, blank notes, paused sharing, independent schedules, renewal continuity, and selection rules.
- 41 adjacent RSVP, planning, reaction, Profile, Friends, and map regression tests passed.
- 36 snapshot, widget, module, person-preview, and past-memory privacy tests passed.
- Four attachment domain tests passed.
- All 14 browser tests passed. They exercise blank/current-only Status, Hide Note versus Pause, preference continuity, merged featured/current Beacons, draft modes, direct responses/voting, emoji reaction selection, Profile entry, and Friends navigation/filter restoration.
- Captured and inspected 320px, 375px, 430px, and desktop screenshots, including current-only, editor, featured Ping, and merged Beacon states. Browser coverage includes narrow layouts, larger text, reduced motion, explicit action targets, and keyboard-driven inputs.
- Web export with minification disabled passed. Android bundle export passed after the final UI changes.

Local screenshots are under `.expo/living-status`, `.expo/status-note-layout`, and `.expo/status-phase4`.

### Follow-up visual refinement

- Matched the supplied compact card reference: type and deadline/state share the header, title/time sit beside artwork with a destination chevron, and Ping responses have equal-width outlined faces with icons and a solid mint selected state.
- React and Message now share one secondary row with icons. Removed repeated type/state and deadline lines from embedded previews while retaining full metadata in the picker and quick response surfaces.
- Restored the question title above quick-response controls in the planning list.
- TypeScript, changed-source ESLint, web export, and all six Status browser scenarios passed after this refinement. Screenshots were inspected at 320px, 375px, 430px, and desktop widths.
- Representative captures: `.expo/status-note-layout/ping-interested-375.png`, `.expo/living-status/merged-375.png`, and `.expo/status-phase4/vote-320.png`. This follow-up did not rerun native runtime checks or database tests because response mutations and schema were unchanged.

## Limitations and deployment status

- Database migrations are delivered alongside application changes but have **not** been deployed to a hosted or production database. Local database tests do not replace hosted RLS/advisor verification after deployment.
- Android export confirms bundling, not runtime behavior. Native device and iOS simulator testing were unavailable.
- A previous minified web build produced a recoverable React hydration error #418 before demo entry. The final non-minified browser build did not exhibit it. Production-minified startup hydration remains a follow-up verification item.
- Full-repository lint previously reported an existing unused `hasToolHistory` variable in the unchanged `ActivityDetailScreen.tsx`; changed-source lint passes.
- Screen-reader behavior, operating-system font scaling, and the native keyboard still require device verification.
