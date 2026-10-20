Maps feature

- MyBeaconsSheet.tsx: underlined Hosting/Joined count tabs, category icons and time/location rows inside a scrolling 70% sheet.
- myBeacons.ts: authorized unexpired Hosting/Joined navigation; explicit Beacon context preserves discovery filters and restores the prior camera on removal.
- markerIdentity.ts: independent ownership badge and relationship identity, rose friend-host hearts, first-name freshness labels and deterministic label collision suppression.

- screens/MapScreen.tsx: full-map tab; coordinates search, safe area/context, inline discovery, area/compass, previews, and map options.
- Map side controls: direct pin-to-create action and a compact compass toolbar for location, overview, everywhere, and place search. Map type lives in a secondary display menu; additional map settings retain their existing sheet and device preferences.
- MapExplorationHeader.tsx: compact accessible search, area/count row, quick-scope chips, reduced-motion inline filter tray, and Search this area action.
- AdvancedMapFilters.tsx: radio When/Join rows, two-column category checkboxes, segmented format and progressive People & groups/Plans sections in a sticky-footer partial Sheet.
- filtering.ts: shared privacy-first Beacon filter selectors for Map and Upcoming, including local-date overlap and capacity/RSVP semantics; gates raw meeting-place details through the canonical profile-preview rule.
- MapPanel.tsx, MapTooltip.tsx: selected beacon and friend/map overlays.
- BeaconOverviewSheet.tsx: map-owned expandable Beacon sheet with compact, overview, and near-full-height snap states, accessible resize handle, and exposed-map dismissal. MapPanel restores tab/feature scroll offsets; actual modules are prioritized by lifecycle and category in mapBeaconFeatures.ts. One/two modules stay inline; larger configurations switch directly between usable module content.
- BeaconPanelNavigation.tsx, beaconToolPreference.ts: fixed text tabs with animated underline, single-row icon tool pills with overflow fades, touch swipe content frame, reduced-motion support, and device-local last tool selection scoped to viewer/Beacon. Preserve map-panel, beacon-activity-subtabs and beacon-sheet-content testIDs.
- BeaconSheetPeople.tsx: reuses ActivityDetailPeople, profile previews, canonical invitations/admission actions, and inline removal confirmation with existing permissions.
- MapRelationshipActions.tsx: shared Plan/decision context entry; Overview shows permitted stop progress and next scheduled stop. Suggested Beacon detail uses MapScreen's existing focus callback. Context removal retains ordinary filters and restores the prior camera.
- Overview retains the external BeaconMusicLink and canonical Repeat creation route. Chat expands through the same sheet resize action; author previews swap into MapPersonPreview and keep the mounted conversation/draft.
- components/BeaconMap.tsx, BeaconMap.native.tsx, BeaconMap.web.tsx: platform variants; keep these siblings together. MapScreen owns overlay controls via `hideControls`; `viewportInsets` reserves overlay-safe camera space on native and web. Native `mapPadding` is attached only after `onMapReady`, then tracks current inset values.
- cluster.ts: pure Web Mercator/screen-pixel grouping shared by native and web markers.
- relevance.ts: shared entity ranking for cluster previews.
- directions.ts: physical-location directions links; never includes the viewer's location.
- placeSearch.ts: validates bounded worldwide results without persistent caching.
- searchWorldwidePlaces.ts: authenticated Places proxy client; no Google key in the app.
- WorldwidePlaceSearch.tsx: explicit worldwide search, provider credits, and platform-safe result actions.

- Final map controls: search includes Explore area; audience scopes scroll separately from fixed Now/Filters. Context focus chips use their own rail. Share location opens the existing consent flow; active sharing exposes Stop/Manage.
- MapControlPopover.tsx: shared leftward anchored surfaces with outside-tap shield, Escape/Android Back dismissal, reduced motion, and screen bounds. Navigation, map-area weather, and Map Display are independently accessible and mutually exclusive.
- mapWeather.ts: debounced Open-Meteo current conditions, bounded ten-minute area cache, validation and unavailable/loading handling; persisted Show Weather preference. Native bearing callbacks support heading-only north reset; Leaflet has no compass.
- soloActivity.ts, MapPersonPreview.tsx: privacy-checked current solo Status Notes, compact activity previews and existing raised-hands reactions. The 202610120001 migration enables consented add/remove on visible current statuses without changing RLS or creating RSVPs.

- Web basemaps retain CARTO light/dark styling and attribution; app config forwards the exact CARTO_BASEMAPS_API_KEY environment value to the web tile URL via Expo extra. BeaconMap.web.tsx centers active Beacon ripple spans in the real badge face across dots/chips/selection while preserving Leaflet anchors and reduced motion. tests/browser/mapRipple.spec.ts exercises actual factory/CSS geometry without tile requests.

- Web dark basemap separates CARTO dark_nolabels and dark_only_labels tiles, brightens only the label layer, and shares retry/attribution behavior.
