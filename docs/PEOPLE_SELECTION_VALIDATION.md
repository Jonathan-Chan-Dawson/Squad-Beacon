# People selection and menu cleanup

Implemented in the existing selection, creation and Sonar surfaces:

- Shared SocialChoiceRow and SocialCategoryRail provide compact accessible rows, explicit selected state, wrapping text and minimum touch targets.
- SocialSelector's filterFriends mode supports context-specific eligible IDs, optional maxSelected and selectionLabel. Invitations have no picker cap; Sonar retains its existing 50-person maximum.
- Friends exposes Favorites and custom Private Lists as secondary filters. Groups browse eligible accepted friends; no membership is converted into recipients.
- Private List management stays inline inside a selector, retaining existing list mutations and protected deletion confirmation.
- Invitation editing is staged: Done commits, Back/Escape discards. The shared overlay registry handles isolation, focus containment and restoration.
- Creation disclosures retain their summary while expanded, with active backgrounds, borders and rotating reduced-motion-aware chevrons. Visibility and community association retain distinct semantics.
- Map and legacy /location links open ProfileSonarCard. Session validation, device updates, privacy, expiry-preserving saves, explicit extension and stop stay in the canonical implementation.
- Beacon invitations recommend 50. Publishing more requires ConfirmDialog; failures remain retryable and selections stay intact. Atomic publication accepts larger explicit batches.

The additive migration 20261026031141_beacon_invitation_recommendation.sql raises the approved Beacon invitation throttle to 300/hour and removes the old atomic 20-recipient check. Other invitation policies and the general action ceiling are preserved. It has been tested locally, not applied to a hosted database.

Validation: baseline typecheck/lint passed. Focused logic/database tests include 51-recipient commit/replay, quota rollback, permission revocation, account changes, draft recovery, and Sonar session expiry/recipient behavior. Browser coverage includes phone/desktop sizes, light/dark, reduced motion, keyboard controls, cancellation and overlay regressions. Final results: typecheck and lint pass, all 44 focused logic/database tests pass, all 27 browser tests pass, and web export succeeds. Rendered screenshots were inspected for the 320px creation disclosures, Sonar, and invitation picker.

Retained: complex scheduling, location search, creation fields and long management flows; custom Friends feed rendering and its controlled browse state. Existing Planning and Map working-tree changes were preserved.

Unavailable here: native Android Back, operating-system keyboard behavior, accessibility text scaling, device location permissions and real device session updates. Browser checks and local PGlite do not establish native or hosted acceptance.
