# Phase 4R interface refinement — 2026-10-28

This report covers the Front-End Remodel 2 interface/integration pass. Phase 5 guest-sharing, auth, server, migrations and dependency changes were concurrent work by **SB Connections** and are not attributed to this pass. File ownership was coordinated; its additions were preserved.

## Delivered behavior

| Area | Result |
| --- | --- |
| Map browsing | Removed the automatic empty-area illustration/card and discovery tips. Explicit search/filter actions can show a compact dismissible result row. Automatic refreshes/tab returns do not create a new empty-area prompt. Errors retain separate Retry feedback. |
| Sonar | One people/review flow. Search, a compact Filter disclosure, selected-only browsing and group/private-list filters retain selections. Bulk actions use the complete eligible filtered set; unions over 50 are disabled and explained. Only Start initiates the existing location/permission sequence. Existing Manage/Save/Extend/Stop guards remain. |
| Responses & Invitations | Bell opens `/responses` directly. Needs Action is the default; ordinary notices, unread styling and Mark all read live under Updates. The bell counts unread notices independently of pending actions. Legacy `inbox=yes` is consumed. Removed the old notification modal and large duplicate homepage entry. |
| Quick Activity | Centered adaptive sheet, fixed completion actions, compact 3-by-2 categories, duration presets and shared hours/minutes Custom controls. Optional details remain collapsed for new Notes. Drafts, edit values and the 5–1440-minute contract remain. |
| Extra activity choices | Walking, Outdoors, Food, Music, Work and Rest sit behind **See more**, with matching Lucide icons and explicit parent categories. They fill only an empty title and preserve existing text. Available in Activity Notes and Beacon category controls. See [category follow-up](PHASE_4R_CATEGORY_FOLLOWUP.md). |
| Public creation | Explicit opt-in, off for a new draft, with city/general area and eligibility explanation. Creation is confirmed before the existing discovery action. The frozen pending listing is checkpointed; a lost reply retries the listing for the confirmed Beacon. Publication and invitation recovery retain their existing authoritative IDs. No new audience or permission broadening. |
| Timing | One staged Beacon timing editor for creation and management: Starts, Duration, end summary, Cancel/Done. Web uses a labeled local picker; native uses existing platform pickers. Shared fields accept ISO instants and explicit timezones, with one wall-time conversion. Planning adapters no longer convert twice. Existing-Beacon changes still require Save and notify attendees. |
| Plan Focus | Authorized numbered physical stops, static dashed connectors with privacy/online/missing-stop gaps, visible-stop count, Fit Plan, View Plan and exit. Unrelated discovery/friend/pulse markers are suppressed without changing saved filters. Entry fits once; explicit Fit handles subsequent fitting. Exit restores the prior camera and valid prior selection. Identity epochs invalidate old contexts. Zero, coincident and widely separated physical stops have explicit fit behavior. |
| Clusters | Two/three separated Beacons retain actual positions. Inseparable small groups use a compact existing selection panel rather than radial expansion. Four/five-item groups remain contained; dense groups retain the explorer. Decorative friend satellites are reduced to at most one close single-Beacon preview, with truthful separate counts. |
| Detail/navigation polish | Two-line narrow titles and aligned content inset; Chat Back is labeled Back to Overview; staged People Picker cancellation is Cancel; unavailable-Beacon wording is clearer. Profile consumes optional `section=aspirations`, opens About and positions Making time for. |

## Navigation and persistence checks

| Journey | Contract retained |
| --- | --- |
| Bell / Chats → Responses | Direct full screen; ordinary Back returns to the caller. Updates and action counts remain distinct. |
| Legacy inbox link | Consumed once; no modal reopening loop. |
| Detail Chat → Overview → exit | First Back changes the subview; subsequent Back uses existing navigation/fallback. |
| Map → detail / Plan Focus | Existing authorized callbacks and paths; no manufactured return stack. Filters retain their values. |
| Calendar / Plan → creation | Existing caller context and authoritative completion remain. Public listing is a separate recoverable continuation. |
| Timing Cancel / Close / Escape | Discards the timing session without applying other field changes. Done stages changes; managing still uses the existing final save. |
| Account/demo changes | Existing operation guards remain. New listing continuation checks its actor and epoch; map context state includes identity epoch and mode. |

## Validation evidence

The affected unit regression selection passed **174 tests**, including creation handoffs/draft storage, listing recovery, selection limits, calendar/planning, Activity Notes, navigation workspace, social filters and map privacy/grouping. The focused map/timing selection independently passed **76 tests** earlier in the pass. Counts overlap and must not be added.

**Final results:** typecheck passed; lint passed with zero warnings; web export passed. The main acceptance run passed **27 browser tests**, and a supplemental run passed **6** additional category/People Picker and retained Chat/Calendar/Plan navigation checks: **33 browser checks in total**. These include 320/375/390/430px composer/timing captures in both appearances, 320/430px Sonar keyboard/selection checks, a main-screen tour in both themes, and representative enlarged text and Escape dismissal. No hosted database or native-device acceptance is implied.

Intermediate failures exposed and repaired a Plan Focus/Map controls overlap and duplicate keyboard button roles on web stop markers. The duplicate Selected filter in compact Sonar was removed. Earlier browser fixtures were corrected to use the existing discovery RPC and current Plan/Manage actions. Superseded failed attempts are retained in ignored local logs, not treated as final results.

An additional connector check passed for the physical itinerary. It verifies the dashed SVG path, its visible ancestors and nonzero geometry; a vertical SVG line has a zero-width DOM bounding box, so a generic element-visibility assertion alone is unsuitable. This is a repeat of the physical-Plan case, not an extra unique test in the count above.

Reproduce with `npm run typecheck`, `npm run lint`, the affected unit suites listed in `tests/_inventory.md`, and Playwright's `refinement.spec.ts`, `refinementTour.spec.ts`, `sonarPeople.spec.ts` and focused `activityWorkspace.spec.ts` cases. The final isolated export was `.expo/phase4r-accepted-preview`. Local evidence logs are `.expo/phase4r-regressions.log`, `.expo/phase4r-check-status.json`, `.expo/phase4r-accepted-browser.log` and `.expo/phase4r-navigation-browser.log`. The check-status file records explicit zero exit codes for typecheck and lint.

Local build exports were isolated under `.expo/phase4r-*`; no deployment was performed. Browser account fixtures intercept transport and establish frontend behavior, not hosted service acceptance. Demo Sonar checks establish consent/review and demo safety, not real location delivery.

Before/after comparison images for composer and timing cover 320/375/390/430px in both appearances. The preserved “before” preview is the end of checkpoint 1, before composer/timing changes; it is not a reconstructed original Map screenshot. Browser text enlargement is a simulation, not native operating-system font scaling.

| Representative surface | Evidence |
| --- | --- |
| Composer, 320px light | [Before](screenshots/phase4r/before/composer-320-light.png) / [After](screenshots/phase4r/after/composer-320-light.png) |
| Timing, 390px dark | [Before](screenshots/phase4r/before/timing-390-dark.png) / [After](screenshots/phase4r/after/timing-390-dark.png) |
| Extra choices / enlarged text | [See more](screenshots/phase4r/after/more-activity-choices.png) / [125% text simulation](screenshots/phase4r/after/composer-larger-text.png) |
| Map / Plan Focus | [Quiet area](screenshots/phase4r/after/quiet-map.png) / [Physical stops](screenshots/phase4r/after/plan-focus-physical.png) / [Zero physical stops](screenshots/phase4r/after/plan-focus.png) |
| Inbox / Sonar | [Updates](screenshots/phase4r/after/inbox-updates.png) / [Review sharing](screenshots/phase4r/after/sonar-review.png) |
| Recovery | [Confirmed Beacon, pending listing](screenshots/phase4r/after/public-listing-recovery.png) |
| Existing main screens | [Chats](screenshots/phase4r/after/squads-dark.png), [Profile](screenshots/phase4r/after/profile-light.png), [Your Activity](screenshots/phase4r/after/your-activity-light.png), [Settings](screenshots/phase4r/after/settings-dark.png), [Help](screenshots/phase4r/after/help-light.png) |

The `before/` and `after/` folders contain the remaining size/theme captures. The screen tour covers Map, Beacons, Squads/Chats, Profile, Your Activity, Plans, Calendar, Create, Inbox, chat, people, Settings and Help. Existing effective interfaces were left in place.

## Acceptance still requiring devices or hosted services

- **Native/simulator/physical devices:** platform date/time dialogs, Android Back, real keyboard avoidance and accessibility text scaling; map marker taps and camera padding; location permission denial/revocation and background Sonar delivery.
- **Hosted account/data:** actual public-preview publication/retry and admission permissions; real inbox notice updates and mark-read propagation; account switching during real pending network operations. Local tests and intercepted browser responses do not establish hosted acceptance.
- **Map manual review:** overlapping/coincident stops, geographically wide itineraries, permission loss while focusing, dense native clusters and outdoor touch usability.
- **Product review:** stronger category taxonomy, a direct category chooser and recent choices are proposed separately. Existing main-screen layouts/themes were retained; speculative redesigns remain outside this pass.

No migration, new dependency, global navigation manager or replacement map/selection engine was added by Phase 4R.
