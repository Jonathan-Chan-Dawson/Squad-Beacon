Maps feature

- screens/MapScreen.tsx: full-map tab; coordinates search, safe area/context, inline discovery, area/compass, previews, and map options.
- Map side controls: direct pin-to-create action; MapCompassSheet renders compact inline compass/search actions in a collapsible side menu. MapStyleControls is shared with MapOptions and uses the existing device preferences; additional map settings retain their existing sheet.
- MapExplorationHeader.tsx: compact accessible search, area/count row, quick-scope chips, reduced-motion inline filter tray, and Search this area action.
- AdvancedMapFilters.tsx: progressive People & groups, Activity, Time & place, Joining, and Plans sections in a sticky-footer partial Sheet.
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
