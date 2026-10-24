# Identity/status and Sonar refinement

## Identity and status

Beacons uses a compact shared identity/status pattern: a 44px profile avatar and name on the left, availability aligned to the top right, and the editable note spanning the full width beneath that identity row. The availability pill uses the existing status colors and a quiet tint; its menu shows descriptive rows with a checkmark on the selected status. The avatar opens Profile. Current Activity and Sonar remain below the identity block.

Profile puts location beside the handle, availability at the top-right of the identity row, and the editable note across the full width underneath. Both screens use a slim 30px visual availability pill inside a 44px touch target. Bio, counts, and Edit/Share/QR follow; Current Activity and Sonar remain outside and below that header. Visitor notes use the same attached placement, without owner editing controls.

The existing Status controller, editor, availability menu, scheduling, audience, pause, and Activity behavior are reused. `SharedStatusControl.identityOnly` separates the Profile header from Current Activity; `LivingStatusHeader.variant` selects compact or Profile presentation. No data model changes are involved.

## Sonar people picker

`SocialSelector` defaults to its established recipient-selection behavior. Its optional `groupBehavior="filterFriends"` mode uses search, avatars, plus/check rows, a selected-only view, and Friends/Favorites/Private Lists/Squads/Organizations/Networks filters. Group filters appear only for authorized groups and never become sharing recipients. Every roster is intersected with accepted, unblocked friendship.

The Sonar sheet has duration below the roster and a fixed confirmation footer. Opening, filtering, selecting, and cancelling do not request GPS or modify sharing. Active sessions preselect their recipients; Save people preserves expiry, while Extend Sonar explicitly extends it. Revoked selections require review/removal. Expired or changed sessions require reopening. Account changes are checked before location actions continue.

The existing service and its 1–50 individual-recipient contract are retained, with no migration. The shared service limit remains 24 hours; the existing duration presets remain unchanged. Native permission/start failure and Stop handling use the existing device service.

## Verification boundaries

- Passed: TypeScript, focused lint, web static export, and 25 domain tests.
- Passed browser checks: 5 identity/status cases at 320/430px in light/dark and 1024px in dark; 8 existing Activity/Status flows; 4 Sonar cases at 320/430px in light/dark; 3 existing Friends selector cases at 320/375/430px.
- Visual review confirms identity-attached notes, compact Beacons avatar/name/availability, Profile note-before-bio/actions hierarchy, and Sonar's fixed footer. Keyboard Space/Enter, 44px targets, explicit demo rejection, and selection retention are covered.

Local browser checks use the exported app and demo data, which cannot activate GPS. Domain tests cover friend/group filtering, revocation, request validation, unchanged expiry when saving, extension, and account/session changes. Device GPS permissions, background updates, native screen readers, and hosted recipient changes still require a real account and physical device.

Screenshots are stored locally under `.expo/identity-status/` and `.expo/sonar/`.
