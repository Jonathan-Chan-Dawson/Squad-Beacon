# Create screen — focused mobile polish

Implemented locally on October 24, 2026. No database migrations, backend APIs, dependencies, draft format changes, or publication/recovery changes.

## Changed areas

- Saved Drafts: Content-sized hub pills capped at 200px with 44px independent Resume/Remove targets, 12px medium-weight titles, thinner borders, 6px rail gaps and reduced section spacing. The heading, dynamic See All count, full-list presentation, confirmations and protected recovery states remain intact. Blank Beacon, search, templates, starters and other hub sections are unchanged.
- Artwork: an 18px decorative pencil badge shares the 60px artwork button and Appearance editor. Starts/Ends retain their existing side-by-side layout.
- Location: accessible In person / Online radios preserve both place and meeting-link values. The search icon is inside the field; Map remains a separate action. Existing debounce, attribution, pin validation and Map-return sessions are unchanged.
- People & Community: flat Visibility, Invite People and Community rows. Exactly one of Visibility, Community or Joining & Capacity expands inline at a time, independently of Modules/Advanced Options. Compact rows expose their current value as an accessibility hint. AudiencePicker has an opt-in inline presentation backed by its unchanged eligibility rules; other consumers keep the sheet presentation.
- Community search uses existing authorized association candidates, prioritizes current/joined choices, shows six matches initially and supports Show more and Clear. Existing Network / Organization / Squad terminology and association-only semantics remain.
- Invitations use the existing SocialSelector in a full-screen modal over the mounted editor. Search, horizontal category/filter rails, Favorites, Private Lists, original selection icons, unavailable recipients, removal and the 20-person limit remain. A modal-local gesture/sheet provider keeps Private Lists management available on native modal surfaces. Back/Done retain live selections; invitations still send on publication.
- Joining & Capacity retains existing approval, numeric bounds, advisory/strict enforcement and seat counting. Validation reveals the appropriate inline section before focusing a failing capacity field. The editor reuses the existing keyboard frame; its publication footer and safe areas remain.
- Shared additions are presentation-only: optional Field leading adornment, inline AudiencePicker mode and compact CreationDisclosure presentation. No new draft store or audience mappings.

## Verification

- 52 targeted creation, capacity, draft repository/snapshot, invitation recovery, atomic database and Map draft tests passed.
- The 35-scenario Create browser regression run passed, including 320/375/430px in both themes, 1024px in both themes, long titles, enlarged browser text, optional sections, Preview, draft restart/failure/deletion/protection, template/reuse, Plan/Council, Map cancellation and organizer roles.
- Final export: web plus Android and iOS JavaScript bundles passed with `--no-bytecode`; this is bundle verification, not native installation or device execution.
- Final TypeScript and full application lint passed; changed-component lint also passed.
- The final exported build passed all eight 320/375/430/1024px theme/layout scenarios, restart restoration, independent people/community/capacity state and inline audience scenarios. The additional full-screen test passed the 20-person rejection, Favorites/Private Lists, nested list management, Tab containment, Escape and focus return. Together with the initial regression run, 36 distinct browser scenarios passed.
- An intermediate final rerun had two timing-sensitive failures: the multi-draft scenario hit its 30-second budget while the animated confirmation moved, and the keyboard test tabbed before Private Lists finished dismissing. The multi-draft test now uses reduced motion and a 60-second scenario budget; the keyboard test waits for the actual dialog element to become hidden. Both targeted reruns passed. No application assertion or storage safeguard was weakened; no baseline failure is being waived.

## Rendered evidence

Screenshots are local generated artifacts under `.expo/creation-mobile/` and `.expo/creation-inline/`.

- [375px dark editor](../.expo/creation-mobile/editor-375-dark.png)
- [320px light editor](../.expo/creation-inline/editor-320-light.png)
- [430px light inline visibility](../.expo/creation-mobile/visibility-430-light.png)
- [Selected people/community](../.expo/creation-mobile/selected-375-light.png)
- [Full-screen invitations](../.expo/creation-mobile/invitations-375-dark.png)
- [1024px editor](../.expo/creation-mobile/editor-1024-dark.png)
- [Compact Saved Drafts](../.expo/creation-inline/draft-pills.png)
- [Removal confirmation](../.expo/creation-inline/delete-confirmation.png)

## Verification boundaries

Browser keyboard/focus and local demo flows were exercised. Physical devices, native keyboards, hardware Back, GPS, VoiceOver/TalkBack and hosted backend publication were not exercised. Native safe-area/keyboard behavior uses existing supported components but still needs device verification. No hosted configuration or data was modified.

## Follow-up control polish

- Disclosure indicators use animated Lucide ChevronDown icons instead of text glyphs, preserving expanded states and reduced-motion behavior.
- Add People is a quiet outlined button with a person-plus icon. Invitation status and selected avatars/count are grouped separately from the action. Selection and publication behavior are unchanged.
- The In person / Online selector uses wider segments with a shorter 34px visible shape and extra vertical margin, retaining separate 44px touch targets. Artwork is 56px within a 60px target, with a 12px gap before the activity title.
