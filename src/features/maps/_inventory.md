Maps feature

- screens/MapScreen.tsx: full-map tab; coordinates search, safe area/context, inline discovery, area/compass, previews, and map options.
- MapExplorationHeader.tsx: compact accessible search, area/count row, quick-scope chips, reduced-motion inline filter tray, and Search this area action.
- AdvancedMapFilters.tsx: progressive People & groups, Activity, Time & place, Joining, and Plans sections in a sticky-footer partial Sheet.
- filtering.ts: shared privacy-first Beacon filter selectors for Map and Upcoming, including local-date overlap and capacity/RSVP semantics; gates raw meeting-place details through the canonical profile-preview rule.
- MapPanel.tsx, MapTooltip.tsx: selected beacon and friend/map overlays.
- components/BeaconMap.tsx, BeaconMap.native.tsx, BeaconMap.web.tsx: platform variants; keep these siblings together. MapScreen owns overlay controls via `hideControls`; `viewportInsets` reserves overlay-safe camera space on native and web. Native `mapPadding` is attached only after `onMapReady`, then tracks current inset values.
- cluster.ts: pure Web Mercator/screen-pixel grouping shared by native and web markers.
- relevance.ts: shared entity ranking for cluster previews.
- directions.ts: physical-location directions links; never includes the viewer's location.
- placeSearch.ts: validates bounded worldwide results without persistent caching.
- searchWorldwidePlaces.ts: authenticated Places proxy client; no Google key in the app.
- WorldwidePlaceSearch.tsx: explicit worldwide search, provider credits, and platform-safe result actions.
