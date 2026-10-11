# Map cleanup and cluster interactions

Validated October 10, 2026.

## Final behavior

- Removed the Map carousel and persistent results sheet. Lists remain in the Beacons tab.
- Clusters use a compact themed background, up to fourteen icons in two rows, and +X overflow without a totals footer.
- Clicking a cluster opens a map-attached, searchable Beacons / People callout immediately. People includes authorized hosts and approved participants without requiring GPS, with duplicate people removed.
- Beacon and avatar callouts follow their projected map coordinates. They stay within the map, resize beside the anchor, and leave the selected marker visible. Items without a shared physical position use a bounded card within the map.
- See overview is a full-width primary action. Enabled Beacon features open as wrapped tabs inside the map callout, including Checklist, Beacon Sketchboard, reactions, comments, chat, reels and memories, focus, and host controls when permitted.
- Sketchboard notes use the existing canonical note actions and privacy controls. New drafts remain saveable, and switching tool tabs retains local drafts and timer state.
- Restored the top-right Compass shortcut.
- Solo, manually closed, strict-full, and ineligible invite Beacons are hidden by default. Selecting an involved person or authorized Squad can reveal readable Beacons. Selection never grants activity, profile, or meeting-location access.

## Verification

- npm run typecheck: passed.
- npm run lint: passed.
- npm test: 266 passed.
- npm run export:web: 39 routes exported.
- Playwright mapClusters and layoutConsistency: 8 passed at 320px, 390px, and 1280px.
- Browser checks cover immediate cluster search, participant lists, on-map person previews, saving Sketchboard notes at both phone widths, wrapped feature tabs, decision links, map preview bounds, and shared menu centering.
- Callout geometry tests verify placement above or below anchors, marker clearance, viewport gutters, and virtual/no-position fallback.
- Android emulator smoke checks confirmed the compact clusters, a three-Beacon/four-People cluster list, the People tab, a person preview on the map, and Beacon feature tabs in the map callout. Native screenshots are under test-results/native-map-cleanup.
- iOS device interaction was not run in this Windows environment.

The browser layout test waits for the opening menu to settle before evaluating all viewport boundaries. Backend services, deployed migrations, and app.config.ts were not changed.

## Automatic map browsing follow-up

Removed Search this area and its loading/count/timer UI. Beacon and avatar map layers no longer retain a geographic filter from a previously chosen area; their existing viewport clustering automatically follows pan and zoom. Privacy, availability and audience filters are preserved. Typecheck, targeted ESLint, web export and the browser pan/zoom regression check passed.
