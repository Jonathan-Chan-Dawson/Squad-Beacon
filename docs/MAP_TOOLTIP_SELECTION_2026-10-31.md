# Map tooltip and selection validation — 2026-10-31

Implemented the Map-only compact card variant, shared Info/X header controls, direct singleton selection, immediate multi-item explorers, exact explorer-row selection, and selection without camera commands. Public previews use authorized coarse anchors. Petal geometry, grouping, count artwork, participation rules, and pin/draft handoffs retain their existing pipelines.

Callouts clamp within the available viewport. When a short screen cannot fit a natural-height preview above or below its marker, the preview moves within the viewport and omits its pointer rather than clipping its primary action or moving the map.

## Verified

- TypeScript and source lint passed.
- Focused Map, filtering/privacy, identity, discovery, contextual-focus, RSVP, and creation-handoff suites passed. The final regression selection passed 119 tests; layout/context coverage passed 28 tests (overlapping selections, not an additive total).
- Six cluster DOM fixture cases passed across phone widths/themes, including singletons at distant tiers, mixed groups, and immediate explorer activation.
- All 14 app browser cases verified against the final web export: 320×568, 375×844, 430×900 and 1280×900; light/dark themes; one-tap person/Beacon previews; Info/X ordering; camera stability; keyboard activation; public coarse previews; explorer search and selection persistence during panning; selected preview persistence through pan/zoom; explicit Zoom to Fit; outside/Escape dismissal; pin placement/search/cancel/creation and existing draft return. Twelve passed in the complete run; two passed on focused rerun after correcting test text/label expectations.
- The 320px final screenshot was visually inspected: the primary button is fully visible. The 375px dark preview was also visually inspected.
- Web export and production iOS/Android bundles passed.

## Limits

No emulator was launched. Native touch behavior, native screen-reader behavior, native reduced-motion rendering, device camera behavior, and native performance remain unverified on physical devices. Browser checks and bundles do not establish hosted backend acceptance. Browser tests include keyboard controls and reduced motion, but do not substitute for a full assistive-technology or large-text audit.

Generated previews, screenshots, and detailed command logs are local under `.expo/map-selection-*` and are not committed source artifacts. Repeatable interaction coverage lives in `tests/browser/mapSelection.spec.ts`; cluster routing/layout coverage lives in the existing Map policy and DOM suites.
