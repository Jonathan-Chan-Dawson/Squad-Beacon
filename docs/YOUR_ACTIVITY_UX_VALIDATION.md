# Your Activity UX — intermediate pass before Phase 4C

Implemented October 27, 2026. This pass owns personal Your Activity and local Plan/Calendar interactions. The Beacons bottom tab remains the social homepage. Phase 4C owns the subsequent app-wide navigation audit.

## Retained behavior

Authorized history/search/pagination/memories, Beacon RSVP and host distinctions, Plan roles/revisions/approvals, co-owners, suggestions, templates, Routines, canonical editor handoffs, legacy Plan capability fallback, Calendar timezone/DST selectors, daily itinerary deduplication and bounded Routine projections remain in place. No migrations, backend actions, dependencies, account setup or survey contracts were changed.

## Route contract and Phase 4C handoff

| Entry | Initial content | Contract |
| --- | --- | --- |
| `/your-activity` | Beacons | `tab=beacons|plans|calendar` selects content; invalid values fall back to Beacons. |
| `/plans` | Plans | Same workspace, preserving the URL and supported legacy/builder parameters. Explicit valid `tab` overrides the default. |
| `/calendar` | Calendar | Same workspace; a valid `date=YYYY-MM-DD` selects that day. Explicit valid `tab` overrides the default. |
| `/plan/[id]` | Existing authorized detail | Detail capability fallback and existing identity/return semantics remain intact. |

- Keep `create`, `planSeed`, `squadId`, `startDate`, `timezone`, `templates`, `template`, `sourcePlan`, `beaconDraft`, `routine` and existing return parameters intact when linking to their existing routes. The capability-specific editor continues to interpret its supported inputs.
- Aliases render the workspace directly; no redirect adds an intermediate Back step. Existing homepage, My Collection, Map and Squad callers continue to work through those routes.
- Subtab selection uses route parameter replacement without creating a new stack entry. Browser tests check history length across switching.
- After Living Plan creation or sheet dismissal, consume `create`; successful creation also clears creation-only Routine/template/source intent. Detail navigation uses the confirmed ID and passes `repeat=yes` when requested. Returning does not reopen the creation sheet.
- Back exits to the original caller; direct entry falls back to the Beacons homepage. Plan editor handoffs retain Plan/stop/insertion/audience/timezone/session context and use existing return handling.
- Close dismisses a sheet. Dirty creation, inline ideas and metadata edits require Keep editing/Discard. Browser reload warns about unsaved edits; persisted Plan data is separate from those drafts.
- Lazy visited panels remain mounted during switching; scroll, activity search/history, Plan filters, Calendar date/view and expansion remain local to that workspace instance. Detail return retains the existing mounted workspace. Separate alias entries and hard reloads do not promise cross-instance restoration.
- Account/demo/epoch changes remount the workspace. Pending creation recovery is in-session and scope-isolated; it is never a second persisted Plan model.

### Cross-feature work remaining for Phase 4C

- Audit global entry/Back consistency and choose any future canonical URL normalization app-wide. This pass deliberately preserves alias URLs.
- The compact aspiration link opens existing Profile; users select About to reach Making time for. A stable Profile section deep link requires coordination with Profile ownership in a later pass.
- Keep the existing legacy builder intact; its larger editor and requirements differ from capability-enabled Living Plans.
- Recheck native hardware Back, keyboard, larger system text and reduced motion on devices. No native-device acceptance is claimed here.

## Screenshots

- [Beacons, dark at 390px](screenshots/your-activity/dark-390-beacons.png)
- [All Plans, light at 390px](screenshots/your-activity/light-plans-all.png)
- [Calendar Month, light](screenshots/your-activity/light-calendar-month.png) and [Week, dark at 320px](screenshots/your-activity/dark-320-calendar.png)
- [Plan workspace](screenshots/your-activity/plan-workspace-with-idea.png)
- [Expanded Calendar itinerary](screenshots/your-activity/calendar-itinerary.png)
- [Stop menu](screenshots/your-activity/plan-stop-menu.png) and [Schedule menu](screenshots/your-activity/calendar-schedule-menu.png)

The screenshot set also includes all three subtabs at 320/375/390/430px in both themes.

## Local visual refinement

- Compact icon/label toolbars group creation/browsing, New Plan/Routines/Templates and Idea/Beacon/Decide without repeated full-width pills.
- Secondary scheduling/decision menus reuse PlanChoice rows; stop overflow reuses the app’s existing QuickChoiceDialog with icons and separated destructive actions. Inapplicable move actions are omitted. Menu continuations run only after dismissal, keeping follow-up actions intact.
- Reduced panel gaps, denser Plan rows, a smaller header/tab strip, and 44px Calendar date targets reduce vertical space while preserving touch targets and wrapping for larger text.
- New empty Plan workspaces use the shared semantic inline empty state. Progress says linked Beacons instead of implying attendance; zero counters are omitted.
- Plan rows use human-readable date-only labels, separate audience context from meaningful progress, and distinguish filtered emptiness. Dates never convert through the device timezone. Confirmed saving resets the list scroll to the top so the new Plan can be found immediately.
- Calendar rows put time before status and use consistent Beacon/itinerary/Routine icons. Expanded itineraries use a compact time column and direct Beacon links rather than nested full-width buttons.

## Plan lifecycle and recovery

- All authorized Plans is the default. List filtering is separate from creation audience; undated Plans remain visible.
- Continue Planning appears when the All list has more than three Plans (small lists do not need duplicate shortcuts), uses readable/contributor-eligible lifecycle data, caps at three, ignores missing references, and excludes cancelled, skipped/dismissed, terminal decision and completed historical work. Empty saved draft Plans remain eligible.
- Creation freezes one request ID/payload and immediately locks submission. A lost reply replays that request to recover the authoritative result; it never searches by title or guesses that an existing Plan is the result.
- Known preflight offline failures release the form for editing because nothing was sent; uncertain outcomes keep the same attempt and display a check-save prompt. The existing `private.requests` dispatcher path and database replay assertion establish source-level request support. An interrupted-reply browser test commits once in intercepted transport, returns 503, then verifies identical retry ID/payload, one Plan and the original returned destination.
- A small account/epoch-scoped recovery record retains the operation if failed snapshot loading temporarily removes the route. Refresh/retry does not silently create another Plan. No durable draft storage was added.
- Inline idea and Plan metadata updates retain revision checks; conflict review refreshes the saved version while retaining edited fields. Accepting the displayed version explicitly advances the edit revision before another save.
- Stop removal is confirmed and does not delete linked Beacons or decisions. Template saving remains a separate named operation.

## Validation

Screenshots live in `docs/screenshots/your-activity/`. Final acceptance results are listed below.

- `npm run typecheck`: passed.
- `npm run lint`: passed; final changed-component lint also passed.
- Focused pure/domain selection: 57 passed (activity workspace/history, Plan, Routine, creation, Map-context, connected-planning and Calendar suites).
- `npm run test:plans`: 46 passed, one failed. The same existing `tests/livingPlans.database.test.ts:493` trusted Routine runner assertion also fails in isolation (`scheduled >= 1`). No scheduler/migration/runner code was changed in this pass. Hosted scheduling remains unverified.
- Final browser acceptance: 18 passed against the completed preview build. This includes the existing homepage/legacy entry journey and the new compact menu interactions.
- The browser matrix covers all three subtabs at 320/375/390/430px in both themes, Calendar Month/Week/history-length restoration, Personal/Squad/undated creation, consumed creation intent, dirty-edit choices, offline form recovery, exact lost-reply replay, Idea/Beacon/Ping/Vote/Draw/Find a Time return, Routine creation, date/timezone scheduling, and expanded-itinerary Beacon/Plan opening with Back restoration.
- Additional shared semantic-copy/onboarding and UI-helper selection: 26 passed (overlaps the focused domain selection; do not add the counts).
- 33 final screenshots were saved; representative Plan, Calendar, Beacon, expanded itinerary, scheduling and stop-menu images were visually inspected.
- Web export: passed, 50 static routes. Restricted-runner exports stalled; the local build completed outside that runner.
- Local database tests establish local behavior only. Browser flows use demo or intercepted account transport; no hosted writes or deployment were performed.


### Reproduce the workspace browser checks

Use an isolated preview port so another task’s server is not reused:

```powershell
node node_modules/expo/bin/cli export --platform web --max-workers 1 --output-dir .expo/activity-preview
$env:PLAYWRIGHT_PORT = "4283"
$env:PREVIEW_DIR = "../.expo/activity-preview"
node node_modules/@playwright/test/cli.js test tests/browser/activityWorkspace.spec.ts tests/browser/livingPlans.spec.ts
node --import tsx --test tests/activityWorkspace.test.ts
```

The existing Plan/Routine cases in `tests/browser/createFlow.spec.ts` were updated narrowly for Save Plan and the direct Beacon action, preserving the concurrent unrelated test changes.

Button sizing follow-up: workspace toolbars now use the standard app PrimaryButton/SecondaryButton height, text and padding. Buttons wrap naturally on narrow screens instead of shrinking. Earlier screenshots show the prior compact toolbar sizing.
