# Adaptive Beacon Card Polish — validation and delivery

## Delivered

- Browse and Map opt into the typed shared discovery card shell. Home and profile retain their existing presentations and card behavior.
- A subtle divider separates social metadata from card context.
- Compact RSVP and membership states reuse the existing authorization and action callbacks. Capacity metadata follows the canonical policy: strict limits can show remaining spots or Full; soft limits are suggested sizes and do not block joining.
- A linked Plan is surfaced only after the existing readable-Plan check, with its title as the card context. The card does not disclose Plan stop or total counts.
- Public preview sheets render the safe public summary. Join state is scoped to the viewer/account epoch, and late results for a changed viewer or Beacon are ignored.
- This card polish adds no dependencies or database migration.

## Visual refinements

- Titles use an 18px semibold style. Timing stays compact beside the More menu and close control; reaction metadata aligns with the divider, and Plan and community context use consistent 24px icons.
- Host cards show **Hosting** with the accessible label **Hosting management** and keep the existing open callback.
- Browse and Map omit context text when the same timing, strict-capacity, or community fact is already visible. Map public and readable previews share a 44px top-corner close control.
- The Map control rail, including Weather, hides while a Beacon preview is open and returns when it closes. Person previews retain their existing rail exclusion.

## Current visual-refinement checks

- TypeScript, ESLint for changed sources, and 33 focused tests passed. A final all-platform export passed for iOS and Android Hermes and web (47 routes).
- All 20 unique focused browser cases passed across the main run and recheck. Nineteen passed in the main run; the public Map preview case hit the known `Cannot read properties of null (reading 'getCenter')` Map initialization failure before the preview rendered, then passed in an unchanged isolated recheck (7.1 seconds). The Map engine was not changed. Coverage spans 320/390/520px browser widths and light/dark appearance; native device acceptance remains untested.
- Refreshed screenshots are available in `.expo/refinement-captures`: [Browse Plan, community, and capacity (390px, dark)](../.expo/refinement-captures/adaptive-browse-plan-community-capacity-390-dark.png), [Browse public card (320px, light)](../.expo/refinement-captures/adaptive-browse-public-card-320-light.png), [Map readable card (390px, light)](../.expo/refinement-captures/adaptive-map-readable-card-390-light.png), [Map public preview (320px, light)](../.expo/refinement-captures/adaptive-map-public-preview-320-light.png), [Map without Plan or community context (390px, light)](../.expo/refinement-captures/adaptive-map-basic-no-plan-community-390-light.png), and [Map community action (520px, dark)](../.expo/refinement-captures/adaptive-map-nonmember-community-compact-520-dark.png).

## People previews

- Readable Beacon cards show up to three approved, profile-visible attendee avatars, prioritizing friends and including the host when they are the viewer. The attendee action appears only when the current viewer can use Beacon modules.
- Browse opens the activity's People tab through the validated `tab=people` route. Map also passes `from=map`; its selected Beacon and camera remain available when returning.
- The detail route accepts only the known People tab value and renders the roster only while `canUseBeaconModules` permits it. Public anonymous cards retain an aggregate count and do not expose attendee avatars or a People action.
- This People preview pass passed 34 focused unit tests, TypeScript, changed-source ESLint, the web export (47 routes), and all 8 unique adaptive browser journeys. The new Browse and Map captures are [Browse People at 320px, light](../.expo/people-preview-captures/adaptive-browse-people-320-light.png) and [Map People at 390px, dark](../.expo/people-preview-captures/adaptive-map-people-390-dark.png). No checks remain for this change; native exports and device acceptance were not rerun in this pass.

## Verification status

- Final full test suite: **475 passed, 0 failed**; focused checks: **35 passed**. TypeScript and full lint passed.
- **All 26 unique browser journeys passed across the main run and rechecks**: 17 existing journeys, 3 regression rechecks, and 6 adaptive-card cases. In the final post-divider six-case run, 5 passed and 1 hit a Map initialization error (`Cannot read properties of null (reading 'getCenter')`) before the tooltip rendered. The unchanged Map case passed in an isolated rerun (6.4 seconds). This is an intermittent Map initialization limitation; the Map engine was not changed. The adaptive cases cover 320/390/520px browser widths and light/dark appearance; this is browser coverage, not a large-text or native device test.
- Final post-divider exports passed: web rendered **47 routes**, and Android and iOS Hermes exports succeeded.
- Final curated screenshots are available in `.expo/adaptive-captures`: [Browse Plan, community, and capacity (390px, dark)](../.expo/adaptive-captures/adaptive-browse-plan-community-capacity-390-dark.png), [Browse public card (320px, light)](../.expo/adaptive-captures/adaptive-browse-public-card-320-light.png), [Map card without Plan or community context (390px, light)](../.expo/adaptive-captures/adaptive-map-basic-no-plan-community-390-light.png), and [Map nonmember community action (520px, dark)](../.expo/adaptive-captures/adaptive-map-nonmember-community-compact-520-dark.png). The browser tests also write screenshots under `test-results/adaptive*.png`.
- Platform exports are tracked separately and do not establish native device acceptance.

## Device acceptance still needed

Native screen-reader behavior, large-text accessibility, touch interactions, and sustained Map performance have not been tested on devices. Verify these on responsive Android and iOS targets; no device result is claimed here.
