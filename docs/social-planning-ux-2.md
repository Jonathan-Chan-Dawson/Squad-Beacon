# Social Planning UX 2.0

## Implementation map

- Inbox: `ResponsesScreen`, `usePlanningResponses`, `inbox`, and `DecisionRow`.
- Shared participation: `PlanningResponseControls`, `PlanningResponseCard` reuse, `PingPreferences`, and `submission`.
- Creation: `PlanningComposer`, `composerSession`, and existing `creationSession` publication recovery.
- Compatibility: Council routes, the new Planning creation route, and `PlanningListScreen` management.
- Integration: `CreateHome`, `CreateScreen`, `createHandoff`, and `LivingActivitySection`.
- Coverage: new `socialPlanningUx` tests and updated Planning browser scenarios; the default test command includes the new guards.

## Participation

Responses & Invitations owns everyday Ping and Council participation. Rows keep
their controls after saving; their saved choices and eligibility come from the
canonical Planning records. The inbox keeps a section-placement snapshot during
interaction, then regroups on refresh, filter changes, or focus. Badge counts use
the existing actionable selectors, independently of row placement.

`planningInteraction` supplies eligible approved options and visible responses.
`PlanningResponseControls` is shared with embedded and dedicated Ping contexts.
Compact responses and expanded preferences share a submission lock. Expanded
details expose Ping preferences and suggestions; advanced organizer management
continues on the existing Council screen.

## Navigation

- `/responses?threadId=...` expands and scrolls to a readable decision.
- Ordinary participant `/council/[id]` links forward to the inbox. Explicit
  `mode=manage`, organizer links, and links containing additional context retain
  the dedicated screen.
- `/councils` shows management, contributed proposals, and history.
- Legacy Council creation parameters forward to `/planning/create`.
- All composers use `/planning/create?kind=ping|vote|draw&sessionId=...`.

## Drafts and publication

Each creation attempt has a unique account-scoped session ID, and each Council
option has a stable ID. Beacon editor handoffs carry both. Unsaved editor fields
remain in their existing editor session when navigating back and reopening the
same option. Saving returns a draft payload, without creating an activity or
proposal. The Council composer validates audience and schedule before publication.

Planning drafts and publication checkpoints are **in-memory navigation recovery**.
They do not survive browser refresh, process termination, or application restart.
The UI states this limitation. Existing explicitly saved Beacon drafts retain
their separate persistence behavior; restoring an option editor cannot reconstruct
a missing parent Council session and therefore cannot publish a replacement.

Publication uses the existing `publishPlanningSession` and canonical action
request-ID deduplication. Submitted values and request IDs are frozen before the
first request; confirmed thread/option IDs are retained. Editing is locked during
uncertain publication. Verification retries use the original requests and never
replace the payload or repeat confirmed options. No alternate creation endpoint,
client-side Draw, schema, or decision engine is introduced.

## Integration boundaries

Activity Note changes retain the existing save action and independent privacy,
availability, Featured Activity, Current Activity, and Sonar behavior. Optional
place information is carried only from a readable owned Activity Note. Destination
permissions are revalidated. Interested does not imply Going; Auto-RSVP remains
explicit and subject to canonical Beacon participation rules.

Find a Time, approval voting, persisted interest thresholds, private organizer
notes, and Adventure Roulette remain deferred.

## Verification

- Initial TypeScript and lint checks passed. The initial full suite passed 513 tests.
- The final full suite passed 526 tests, including concurrent Map work in the shared checkout.
- Planning/permission/Activity Note checks passed 26 tests; the final response and draft guard run passed 13 tests.
- All 25 browser scenarios passed: direct responses, canonical Draw results, creation, option handoffs, legacy links, independent drafts, 320/390/430px layouts, existing Beacon creation, templates, Plans/Routines, and publication recovery.
- After tightening the option audience guard, its unit assertions and the normal option-editor browser handoff passed again.
- TypeScript, full-project lint, web export, and Android Hermes export passed. Mobile screenshots were inspected at 320 and 430px; responsive checks also covered 390px and reduced motion.
- Physical devices, native screen readers, and an iOS build were not available on this Windows host.

Logs, isolated exports, browser configuration, traces, and mobile screenshots are
kept under the ignored `.expo/social-planning/` directory. Initial sandbox build
and localhost restrictions were resolved by running the local compiler and browser
checks with the required access. Transient concurrent Map import/type errors were
resolved by that work; this change did not edit Map implementation files.
