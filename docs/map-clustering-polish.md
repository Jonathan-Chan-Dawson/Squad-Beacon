# Map bloom clustering polish

The active web and native renderers now share bloom geometry and presentation policy. Existing singleton Beacon pins, ownership stars, relationship badges, floating cards, filters, authorization, and selected-item protection remain in place.

## Presentation

- Close (16+): original singleton markers and overlapping cluster petals.
- Medium (12-15): all petals for 2-5 Beacons; six for 6-10; seven for 11+. Two petals balance around the center; three form an equilateral arrangement. Owned/joined previews retain priority, followed by category variety.
- Far (9-11): miniature petals and circular shadows with attached compact counts.
- Very far (below 9): one or two micro petals, minimal shadows, and faint presence dots.
- Existing 0.35 zoom hysteresis remains to prevent tier flicker.

## Counts and privacy

`+N` counts hidden Beacons only. The separate people icon counts all actual authorized nearby person markers, including the visible satellites. Twenty Beacons and eleven friends produce seven medium petals, `+13`, and a friend total of eleven. Presence never means Going or attendance.

Beacon grouping happens independently of friend positions. Nearby friends retain individual satellites only when the complete set fits the bloom’s current limit (up to three for one/two Beacon petals, five for medium blooms and seven for large blooms; distant tiers and collisions reduce capacity). Above that capacity **all** satellites are hidden. Their count represents the full authorized nearby-friend total, never just hidden overflow.

Mixed clusters use exactly one compact bottom-right count display: `👥 +18 · +13` means 18 nearby friends and 13 hidden Beacons. If satellites remain visible, their people count is omitted; Beacon overflow alone stays `+13`. People-only clusters retain their independent labeled totals. Count indicators share geometry and width metrics across native/web, reserve artwork and neighboring decorations, and shift only outward/down when needed. The searchable explorer retains its existing sections. Friend-only counts open Friends; combined counts open the general searchable explorer; overflow-only counts preserve the normal small-bloom expansion/large-bloom explorer behavior.

The decoration pass preserves Beacon petals, ownership stars, geographic anchors and independent friend groups. Small shadows and the existing soft gradients remain unchanged by this count cleanup. Geometry remains memoized, and the final rendering budget counts the single indicator once.

The searchable explorer retains Beacon/Friend sections and full totals, deduplicates public/readable Beacons, and no longer adds hosts or attendees to nearby-friend results. Friend access/freshness is rechecked while it is open. Small Beacon groups remain directly expandable even when many friends are nearby.

## Files

- `src/features/maps/clusterLayout.ts`, `clusterBloom.ts`, `nativeMapPresentation.ts`, `mapPointOffset.ts`: shared geometry, ranking, collision attachment, and zoom policy.
- `src/features/maps/webConstellation.ts`, `components/LivingMapMarkers.native.tsx`: matching artwork and separate counts.
- `src/features/maps/components/BeaconMap.{tsx,native.tsx,web.tsx}`: live rendering and Friends prominence.
- `src/features/maps/MapNearbyPanel.tsx`, `screens/MapScreen.tsx`: explorer counts and authorized nearby results.
- `tests/nativeMapPresentation.test.ts`, `clusterRendering.test.ts`, `clusterBloom.browser.test.ts`, `browser/mapClusters.spec.ts`: policy, geometry, rendered interactions, and updated explorer terminology.

## Validation

- 83 focused tests passed: presentation, rendering/cache identity, clustering, filtering/context restoration, marker identity, discovery, and social map policy.
- TypeScript check passed.
- Full-app web smoke test passed: searchable Beacons/Friends, search empty state, exact profile selection, and the floating profile card.
- Final iOS/Android exports passed in `.expo/cluster-native-final/`; the final web export passed in `.expo/cluster-web-final/`.
- Changed map components passed lint.
- Shipped web bloom renderer exercised at 320/375/430px in light/dark, all four tiers, crowded mixed groups, direct selection, separate friend exploration, Escape, keyboard activation, and reduced motion. Fixture faces isolate shared bloom layout from map tiles; this is not native runtime verification.
- The requested 2B/2F, 2B/25F, 7B/18F, 20B/5F, and 40B/60F cases passed the phone-size renderer checks. Seven-icon capacity, no duplicate totals, east/west badge placement, unchanged Beacon geometry, and direct Friends entry are covered.
- Native count badges use real 44px overlay buttons rather than touch handlers embedded in marker bitmaps; their projections refresh after camera movement and safe-area changes. Stale presentation projections are hidden immediately.
- QA screenshots: `.expo/cluster-bloom-qa/` (ignored local artifacts).
- Native device verification remains outstanding; this Windows environment cannot run an iOS simulator.


## Visual follow-up — 2026-10-25

Validated 75 policy/identity/filtering/context tests and the shipped DOM renderer at 320, 375 and 430px in both light and dark appearance, including reduced motion, independent friend groups, mixed overflow, exact Beacon selection and searchable Friends entry. Phone captures are `.expo/cluster-bloom-qa/phone-polish-{width}-{light|dark}.png`. These are renderer fixtures with simplified Beacon faces, not native device screenshots. Native runtime/device checks were not performed; no emulator was launched.

Follow-up validation: the full TypeScript check and lint for all changed map sources passed. The workspace’s temporary missing dialog declarations were resolved before the final TypeScript run. The rendering budget still accounts for the final, decluttered satellite and badge counts.


## Count cleanup — 2026-10-25

Combined the previous separate People and Beacon overflow badges into one bottom-right indicator. Expanded small blooms keep exact Beacon selection and a single Friends entry. Headless phone captures for this pass are `.expo/cluster-bloom-qa/count-cleanup-{width}-{light|dark}.png` (320, 375, 430px). These are shipped-renderer fixtures; native device checks were not performed and no emulator was launched.
