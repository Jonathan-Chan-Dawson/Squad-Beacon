Maps feature

- MyBeaconsSheet.tsx: underlined Hosting/Joined count tabs, category icons and time/location rows inside a scrolling 70% sheet.
- myBeacons.ts: authorized unexpired Hosting/Joined navigation; explicit Beacon context preserves discovery filters and restores the prior camera on removal.
- markerIdentity.ts: viewer-authorized ownership/saved/friend/live marker state, shared pulse metrics, first-name freshness labels and deterministic label collision suppression. Beacon markers retain category artwork, ownership stars or saved Bookmarks, and quiet friend rims; compact petals omit rims. Live pulses run only on individual undimmed markers and stop during gestures; reduced motion uses a static ring.

- screens/MapScreen.tsx: full-map tab; coordinates search, safe area/context, inline discovery, area/compass, previews, and map options.
- Map controls: Navigation, Layers and Weather share the top-right rail; Layers is the single style selector. Bottom-right Place reuses location picking, tap/drag pin adjustment, worldwide search, and a pin-anchored tooltip with direct creation actions before template-first Beacon or real Ping creation. Placement and Cancel preserve the user-controlled camera; Cancel restores the prior query without clearing selected markers or filters; editor picking retains its token return. Scale and attribution stay bottom-left.
- MapExplorationHeader.tsx: compact search and combinable All/Friends/Interests controls; fixed Surprise Me, Happening Now, and icon-only Filters. Dropdowns use real Private Lists and shared category/ranking state.
- discoveryFriends.ts: authorized friend-host/approved-attendance matching and private-list people scopes. Shared canonical filter normalization lives in shared/explorationFilters.ts.
- surpriseDiscovery.ts / SurprisePreviewActions.tsx: viewport-scoped weighted discovery cycles, eligibility rechecks, Try Another and explicit previous-view restoration. MapScreen owns the viewer/filter session; internal camera command acknowledgments gate native/web previews. Surprise is disabled during Plan Focus and absent during placement.
- AdvancedMapFilters.tsx: synchronized independent Happening Now/date restrictions, category checkboxes, For Me ranking and People & groups/Plans controls in a sticky-footer partial Sheet. All clears quick restrictions; Reset explicitly restores discovery defaults.
- filtering.ts: shared privacy-first Beacon filter selectors for Map and Upcoming, including local-date overlap and capacity/RSVP semantics; gates raw meeting-place details through the canonical profile-preview rule.
- MapPanel.tsx, MapTooltip.tsx: selected beacon and friend/map overlays.
- BeaconOverviewSheet.tsx: map-owned expandable Beacon sheet with compact, overview, and near-full-height snap states, accessible resize handle, and exposed-map dismissal. MapPanel restores tab/feature scroll offsets; actual modules are prioritized by lifecycle and category in mapBeaconFeatures.ts. One/two modules stay inline; larger configurations switch directly between usable module content.
- BeaconPanelNavigation.tsx, beaconToolPreference.ts: fixed text tabs with animated underline, single-row icon tool pills with overflow fades, touch swipe content frame, reduced-motion support, and device-local last tool selection scoped to viewer/Beacon. Preserve map-panel, beacon-activity-subtabs and beacon-sheet-content testIDs.
- BeaconSheetPeople.tsx: reuses ActivityDetailPeople, profile previews, canonical invitations/admission actions, and inline removal confirmation with existing permissions.
- MapRelationshipActions.tsx: shared Plan/decision context entry; Overview shows permitted stop progress and next scheduled stop. Suggested Beacon detail uses MapScreen's existing focus callback. Context removal retains ordinary filters and restores the prior camera.
- Overview retains the external BeaconMusicLink and canonical Repeat creation route. Web chat expands through the same sheet resize action; native chat opens the dedicated activity chat screen. Author previews retain existing permissions.
- components/BeaconMap.tsx, BeaconMap.native.tsx, BeaconMap.web.tsx: platform variants; keep these siblings together. MapScreen owns overlay controls via `hideControls`; `viewportInsets` reserves overlay-safe camera space on native and web. Native `mapPadding` is attached only after `onMapReady`, then tracks current inset values.
- cluster.ts: pure Web Mercator/screen-pixel grouping shared by native and web markers.
- relevance.ts: shared entity ranking for cluster previews.
- directions.ts: physical-location directions links; never includes the viewer's location.
- placeSearch.ts: validates bounded worldwide results without persistent caching.
- searchWorldwidePlaces.ts: authenticated Places proxy client; no Google key in the app.
- WorldwidePlaceSearch.tsx: explicit worldwide search, provider credits, and platform-safe result actions.

- Final map controls: search includes Explore area; All/Friends/Interests scroll separately from fixed Dices/Now/icon-only Filters. Context focus chips use their own rail. Share location opens the existing consent flow; active sharing exposes Stop/Manage.
- MapControlPopover.tsx: shared leftward anchored surfaces with outside-tap shield, Escape/Android Back dismissal, reduced motion, and screen bounds. Navigation, map-area weather, and Map Display are independently accessible and mutually exclusive.
- mapWeather.ts: debounced Open-Meteo current conditions, bounded ten-minute area cache, validation and unavailable/loading handling; persisted Show Weather preference. Native bearing callbacks support heading-only north reset; Leaflet has no compass.
- soloActivity.ts, MapPersonPreview.tsx: privacy-checked current solo Status Notes, compact activity previews and existing raised-hands reactions. The 202610120001 migration enables consented add/remove on visible current statuses without changing RLS or creating RSVPs.

- Web basemaps retain CARTO light/dark styling and attribution; app config forwards the exact CARTO_BASEMAPS_API_KEY environment value to the web tile URL via Expo extra. BeaconMap.web.tsx centers live Beacon ripple spans in the real badge face while preserving Leaflet anchors and reduced motion. Native aligns its screen-sized pulse with a settled-camera face projection; neither platform animates cluster members. Both use the canonical Beacon live predicate in features/beacons/beaconLive.ts. tests/browser/mapRipple.spec.ts exercises actual factory/CSS geometry without tile requests.

- Web dark basemap separates CARTO dark_nolabels and dark_only_labels tiles, brightens only the label layer, and shares retry/attribution behavior.

- components/BeaconLocationPreview.native.tsx: shared noninteractive, permission-gated physical-location mini map used by native detail and Overview; caller controls Map focus.

- nativeMapPresentation.ts: shared zoom modes, selected-marker protection, ranked Beacon grouping, neighbor-aware count placement and rendering budget; friend positions never feed Beacon density. Grouping uses tighter 32/40/52/64px screen-space distances across tiers with fractional-zoom compensation; mixed friend/Beacon attachment uses 32px (28px in Friends emphasis).
- clusterLayout.ts, clusterBloom.ts: shared petal geometry, compact shadows, adaptive close-zoom friends and unified total-count badges; far/micro modes omit friend satellite rings.
- components/LivingMapMarkers.native.tsx: original-artwork native blooms, shared shadow/count styling and accessible expanded touch targets.

- Community discovery: Map previews and Beacon Overview use BeaconCommunityRow, batched viewer-authorized associations and canonical profile routes. communityReturnState.ts retains viewer/Beacon sheet position; camera, filters and contextual selection remain Map-owned.

- webConstellation.ts: Leaflet DOM adapter for the shared bloom geometry, progressive far/micro previews, exact accessible counts and direct singleton/explorer actions.

- Map selection: singleton markers open their exact preview; all genuine multi-item groups open Nearby without changing the camera. Map-only card density uses Bookmark and Close headers, compact linked context, and counted anchored Tools menus; public previews stay anchored to coarse coordinates. Explicit navigation, search, Plan focus and Zoom to Fit retain camera control.

- Plan Focus reuses contextFilters authorization, numbered physical stops and static paths; MapScreen isolates markers, fits on entry/explicit action and restores the prior camera/valid selection. Small clusters use MapNearbyPanel compact selection; quiet-map result feedback follows deliberate actions only.

- Map Beacon cards place compact reaction and action controls above a full-size bottom action; ordinary 320px previews fit without scrolling while preserving the bounded fallback for larger content.
