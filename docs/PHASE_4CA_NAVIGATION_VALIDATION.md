# Phase 4C-A — navigation reliability

Audit date: October 27, 2026. This is a dated implementation/validation record, not a deployment or device-acceptance claim.

## Repairs and route contracts

Three localized defects were repaired in `ActivityDetailScreen.tsx` and the existing planning `DecisionRow.tsx`:

| Finding | Before | After | Regression evidence |
| --- | --- | --- | --- |
| P1: direct-entry Beacon Back has no exit | Open `/activity/demo-tools?tab=chat&from=map`, enter demo, press Back twice. Chat closes, but the second press leaves the same detail URL because no prior app route exists. | Chat still returns to Overview. Subsequent Back uses actual history when available; otherwise it replaces the route with `/(tabs)/activities`. `from=map` does not invent a Map origin. | The unchanged production export reproduced the stuck URL. New browser cases cover both themes at 320/390px, with and without `from=map`. |
| P1: web detail tabs do not announce selection | Tabs have a visual underline and native accessibility state, but the rendered web tabs lack `aria-selected`. | Each tab exposes its selected state explicitly on web while retaining the native state. | The unchanged export failed the selected-state assertion. New cases check Overview=true and People=false after returning from Chat. |
| P1: inbox loses its Squad Ping handoff | Expand the Squad Ping in Responses & Invitations. There is no Open Squad chat link, despite the existing authorized destination and permission helper. | Expanded eligible Squad Pings reuse `canOpenSquadPing` and the existing chat route with the exact `ping` ID. | Existing source-link browser regression reproduced the missing link. The repaired test follows the compact Ping to its canonical response route, responds, and returns through Chat to the original inbox with the same saved response. A new negative case checks friend-audience Pings. |

No public route, supported parameter, API, schema, permission, or publication contract changed. Unavailable Beacon routes retain their explicit Beacons-home exit. There is no new navigation framework, persistent state, dependency, or migration.

## Navigation contract matrix

“Preserved” means the inspected frontend contract was retained, with the evidence described below. It does not establish native/hosted acceptance.

| Entry and action | Destination and return contract | Retained context / failure behavior | Status and evidence |
| --- | --- | --- | --- |
| Homepage and collection activity shortcuts | Existing workspace/alias route and intended subtab; Back returns through actual history | Supported incoming route parameters stay intact | Preserved: homepage callers, route aliases and workspace inspected; workspace browser checks |
| `/your-activity`, `/plans`, `/calendar` | Same workspace; alias-specific defaults, valid explicit tab takes precedence | Visited panels stay mounted; subtab changes do not add history | Preserved: workspace code and browser history-length/filter/date assertions |
| Calendar → Beacon → Back | Existing Calendar instance | Expanded itinerary survives | Preserved: regression now presses the app's Back button instead of only browser Back |
| Calendar → Plan → Beacon → Back → Back | Original Plan, then original Calendar | Plan identity and expanded itinerary survive | Preserved: strengthened existing itinerary browser journey |
| Direct Beacon → Chat → Back → Back | Overview, then safe Beacons-home fallback | No assumed Map origin; no artificial stack entries | Fixed: four new viewport/theme cases |
| Missing Beacon with tool/origin hints | Unavailable screen → explicit Beacons-home exit | Hints cannot substitute another record or grant tool access | Preserved: new unavailable-route browser case and existing tool-entry unit tests |
| Map search → preview → See overview → Back | Full Beacon detail, then the originating Map preview | Selected Beacon and the search state present immediately before detail survive | Preserved: focused browser journey now checks the current full-detail route and app Back; choosing a search result already consumes its search text |
| Map feature → sheet; sheet → full detail/chat → Back | Existing Map-owned expandable sheet and native detail/chat routes | Existing sheet position, authorized tools and camera ownership remain intact | Source-traced: `MapScreen`, `MapPanel`, `BeaconOverviewSheet`; native sheet/detail/Chat return requires device acceptance |
| Map temporary focus → contextual × | Remove temporary context, restore the saved ordinary view | Ordinary filters remain; camera restore uses existing saved viewport | Preserved: Map context code, unit privacy checks and focused My Beacons restoration browser journey |
| Create → Map location → Confirm/Cancel | Existing token-scoped editor | Confirm changes only location; Cancel retains prior location and other draft values | Preserved: location unit tests and editor round-trip browser journey |
| Beacon creation → confirmed result / invitation retry | Authoritative result or originating Plan | Frozen request/payload, single creation, recoverable partial invitations | Preserved: handoff/draft unit suites and linked-Plan creation browser journey |
| Plan → Ping/Vote/Draw/Find a Time | Existing composer → originating Plan stop | Session, audience and insertion context survive; creation intent is consumed | Preserved: workspace browser journeys, connected-planning and publication unit tests |
| Inbox/chat → response | Inbox responses stay inline; a compact chat Ping opens its canonical response route | Shared submission exclusion, deadline/access checks and canonical result links | Fixed missing inbox → Squad chat link; browser round trip checks the exact Ping, shared saved response and Back through the real stack |
| People/group filters → Back/Escape or Done | Cancel staged changes or commit explicit individual selection | Group browsing never expands membership into invitations; eligibility is rechecked | Preserved: selector/caller inspection, social-selection units and picker browser suites |
| Nested sheets/dialogs → dismissal | Top registered overlay handles dismissal; parent remains usable | Existing focus containment/return, web scroll locks and Android Back listeners | Source-traced; browser Escape/focus checks; native keyboard/gesture acceptance remains open |
| Sign-out/account/demo/scenario change during requests | Root readiness and identity-keyed runtime re-establish valid context | Epoch checks reject stale results; optional survey never gates valid required profiles | Preserved: account/onboarding unit and browser suites; workspace identity-key inspection |

### Boundaries deliberately preserved

- Your Activity restoration remains local to its mounted workspace. Separate alias instances, hard reloads and app restarts do not gain new persistence guarantees.
- Plan creation recovery keeps its existing account/epoch-scoped operation and authoritative replay; it is not replaced by title matching or a new draft model.
- Map contextual exit restores the pre-focus camera according to its existing contract. It does not reset discovery filters.
- Beacon invitations, visibility, community association and organizer roles retain their separate semantics. Recipient recommendations remain advisory.
- No earlier-phase integration was rebuilt. The Profile aspiration shortcut still opens Profile rather than a new stable About-section deep link; see the Your Activity handoff.

The Map and Squad browser expectations also needed maintenance: location placement is now the separate Place control, Map See overview opens full detail, and chat Pings use compact links to canonical response routes. Tests now follow those existing behaviors rather than restoring obsolete menu entries, Map-only detail expectations, hidden full-size Ping cards, or outdated response copy. Responses submitted from another route legitimately appear under Answered & Active in the original inbox.

## Validation

### Commands and evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed; final check includes both repairs and the added browser cases |
| `npm run lint` | Passed, zero warnings |
| Selected unit/domain command below | 134 passed |
| `npm run test:plans` | 47 passed, including local PGlite tests |
| `npm run test:onboarding` | 23 passed, including local PGlite tests |
| Additional communication/planning permission selection | 17 passed: `node --import tsx --test tests/communication.test.ts tests/planningInteraction.test.ts tests/socialPlanningUx.test.ts` |
| Workspace/planning/picker browser selection below | 44 distinct cases passed across the final run and targeted retry: 43 passed in the final full run; one Windows screenshot file-open error passed on retry |
| Focused Map/Squad browser selection below | 5 passed; final six-case run also retried the workspace screenshot case successfully |
| Account-entry and onboarding browser suites | 30 passed against the development export containing the Beacon repairs; the later Squad link is checked in the final production journeys |
| Development export after Beacon repairs / final production export | Passed; 50 static routes each |

Counts overlap between unit commands and must not be added together. The previously documented Plan/Routine assertion failure did not recur in the current `test:plans` run.

Unit/domain selection (PowerShell):

```powershell
$cases = @(
  'activityWorkspace', 'accountEntry', 'onboarding', 'profileEditor',
  'createHandoff', 'creationLocationDraft', 'creationDraftSnapshot', 'creationDraftRepository',
  'mapContextFilters', 'activityToolEntry', 'livingPlans', 'plans', 'plansRoutine',
  'calendar', 'connectedPlanning', 'planningThreads', 'planningInteraction',
  'communication', 'socialPlanningUx', 'friendsBrowseSession'
)
node --import tsx --test ($cases | ForEach-Object { "tests/$_.test.ts" })
```

Final production browser selection (isolated preview):

```powershell
$env:PLAYWRIGHT_PORT = '4302'
$env:PREVIEW_DIR = '../.expo/phase4ca-production-final'
node node_modules/@playwright/test/cli.js test tests/browser/activityWorkspace.spec.ts tests/browser/planning.spec.ts tests/browser/connectedPlanning.spec.ts tests/browser/unifiedPeople.spec.ts tests/browser/creationMobilePolish.spec.ts --workers=1 --timeout=60000 --output=.expo/phase4ca-final-browser-results
```

The focused Map/Squad selection uses a separate port and the same production preview:

```powershell
$env:PLAYWRIGHT_PORT = '4305'
node node_modules/@playwright/test/cli.js test tests/browser/mapSocialPolish.spec.ts tests/browser/mapQuickPlace.spec.ts tests/browser/mapRefinement.spec.ts tests/browser/squadsChatFirst.spec.ts tests/browser/activityWorkspace.spec.ts --grep 'My Beacons reaches|returning from the Map|Compass opens|response prompt jumps|friend-audience Ping|workspace tabs.*dark' --workers=1 --timeout=60000 --output=.expo/phase4ca-return-acceptance-results
```

Account checks used port 4298, `PREVIEW_DIR=../.expo/phase4ca-final-web`, both `accountEntry.spec.ts` and `onboarding.spec.ts`, one worker, and a 120000ms timeout. Development exports retain the developer scenario lab. Ordinary production-oriented suites initially timed out when the development hot client reloaded them to Auth; those interrupted runs are not counted as passing acceptance. General navigation checks were rerun against the production export.

The initial production browser selection passed all 44 cases before the Squad link repair. The final selection after that repair passed 43, with the dark workspace case interrupted by `UNKNOWN: unknown error, open ...dark-390-plans.png` while saving its screenshot. The final six-case retry passed that case plus all five Map/Squad checks. This was a file-write failure, not a failed navigation assertion. Counts exclude repeat executions. Historical Your Activity screenshot files regenerated by existing tests were restored; only this phase's new captures are retained.

Both exports used Expo CLI with `--platform web --max-workers 2 --output-dir <isolated-directory>`, adding `--dev` for the development build. Offline mode avoided the initially stalled restricted-runner export. Logs and traces live under `.expo/phase4ca-*`; they are generated local evidence, not contributor prerequisites.

### Screenshots and environment limits

Reviewed all four Beacon screenshots for visible Back/Chat/menu controls, wrapping, tab selection and footer access, plus the restored Squad Ping link capture:

- [Light, 320px](screenshots/phase4ca/light-320-beacon-overview.png)
- [Dark, 320px](screenshots/phase4ca/dark-320-beacon-overview.png)
- [Light, 390px](screenshots/phase4ca/light-390-beacon-overview.png)
- [Dark, 390px](screenshots/phase4ca/dark-390-beacon-overview.png)
- [Restored Squad Ping handoff](screenshots/phase4ca/squad-ping-handoff.png)

The 320px cases use reduced motion; 390px cases use normal motion. Browser tests exercise keyboard selection, Escape, focus containment and return. They do not establish native software-keyboard, hardware Back, screen-reader, gesture or physical-device acceptance.

Unit checks exercise local/demo behavior; browser checks use demo data or intercepted account transport; database checks use local PGlite. No hosted mutations, migrations, deployment, email delivery, trusted scheduler, simulator or physical-device checks were performed.

## 4C-B Manual UX Review List

These are review targets, not authorization for a redesign. P2 opportunities below are subjective; environment checks have no claimed functional failure.

| Area | Location and observation | Why review / suggested direction | Priority and classification |
| --- | --- | --- | --- |
| Map | Native sheet's View full Beacon, dedicated Chat, and contextual-focus exit | Confirm device Back returns to the same selected sheet and viewport; exercise child overlays above location picking | Acceptance required: native hardware Back/gestures/keyboard |
| Beacons / Your Activity | Beacon hero at 320px truncates this long title and the mode chip; see new 320px screenshots | Owner can assess whether compact truncation supplies enough context and whether Chat Back needs a more explicit label | P2: subjective opportunity; Back defect and web selected-state defect are fixed |
| Create | Add People uses Back for staged cancellation and Done for confirmation | Review whether those labels make cancellation clear before changing wording; preserve staging | P2: subjective opportunity; native keyboard acceptance required |
| Plans / Calendar | Retained workspace and dirty-edit dialogs | Inspect larger system text and device gestures without expanding persistence or changing alias URLs | Acceptance required: native; no reproduced web return defect |
| Squads / Chat | Missing source link is fixed; compact Ping → response → Back works on web | Inspect actual device keyboard/focus after nested profile/member navigation | Acceptance required: native; no new layout redesign proposed |
| People Picker | Group filters and selected-individual count | Owner can review filter-versus-recipient clarity; keep explicit Done and no mass invitation | P2: subjective opportunity; browser coverage checks actual selection semantics |
| Profile / Status | Making time for shortcut currently opens Profile; user selects About | Stable section navigation remains a previously documented coordination target; confirm value before introducing a route contract | P2: earlier-phase integration gap, preserved |
| Pings / Votes / Councils | Missing Beacon screen currently says “This plan is no longer visible.” | The noun may confuse someone following a finalized Beacon link; review terminology with the owner | P2: observed copy opportunity, preserved |

No additional confirmed functional defect remains from the reproduced audit cases. Native and hosted acceptance remain open regardless of local passing results. The Profile section shortcut remains an explicitly preserved earlier-phase integration gap, and the copy/design observations above are deferred to owner review.
