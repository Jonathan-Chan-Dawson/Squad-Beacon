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

Beacon grouping happens independently of friend positions. Only friends within the collision distance attach as satellites; no source coordinates change. One to seven small satellites follow the actual direction of shared locations when they fit without collisions. If every nearby friend cannot fit, the icons are replaced by one compact people-count satellite on the nearest free edge. Icons and totals never appear together in a collapsed bloom. Far zoom caps individual dots at three and micro scale keeps at most two faint dots. Distant friends retain their own groups. Friend-only clusters show mini petals for two through four people and compact totals from five.

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
