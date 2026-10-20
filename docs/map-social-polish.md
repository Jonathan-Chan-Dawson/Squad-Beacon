# Final Map & Social Selection Polish

Implemented October 20, 2026.

## Phase 1: Map identity

- Owned Beacons have teal stars on their pins and cluster-preview icons. Joined-only Beacons remain unstarred. Ownership improves preview priority without bypassing clustering.
- Friend-host hearts use rose colors appropriate to light and dark appearances. Relationship badges move left when an ownership star is present.
- Existing zoom tiers, selected-pin protection, marker sizes, density limits, and public-location privacy remain in place.
- Friend labels show first name and shared-location freshness, with truncation and deterministic collision suppression.
- Area summaries show total Beacons, an optional live count, and an ownership count.

## Phase 2: Social selection

- A controlled selector now serves Friends planning, creation invitees, and community association. It retains the existing Friends rows and selection footer.
- Underlined category tabs scroll horizontally. Private-list filters, Favorites, existing Close Friends lists, management, bulk selection, and limited undo reuse current account data.
- Recipient kinds are explicit. Friend-only flows submit individual IDs; selecting a group never expands its membership into invitations.
- Stored `space` records display as Organizations; stored `organization` records display as Super-Organizations in this selector. No new entity or database migration was introduced. Persistent list audiences retain their separate meaning.
- Friends retains availability filters, search/list state, and scroll restoration. Friends and Chats have compact Add Friends separation.

## Phase 3: Filters and navigation

- Expanded Filters uses the Plan form's card surfaces, fields, and action primitives, preserving immediate application, reset, counts, and contextual removal.
- Navigation includes My Beacons with authorized Hosting and Joined tabs with counts, category icons, separate time/location subtitles, live indicators, and a 70% height cap. Located entries focus at zoom 16; unavailable or online locations open details. Explicit context preserves discovery preferences and camera restoration.
- Weather retains its complete label and temperature preview. Native providers and web satellite messaging remain unchanged.
- Sheets use a dedicated spring: damping 30, stiffness 220, mass 1, and overshoot clamping. Other animation presets are unchanged.

## Verification and limits

- 59 focused unit tests passed (`npm run test:map-social`).
- 25 browser checks passed, including 320/375/430px layouts, 28px controls inside 44px targets, selection/list persistence, long names, context restoration, filter reset, map badge colors, chat separation, and existing navigation.
- TypeScript and changed-source lint checks passed. Web and Android/Hermes exports succeeded. No native device runtime validation was performed.
- The existing local CARTO key returned HTTP 200 PNG tiles for both light and dark styles. Build configuration forwards the key through Expo extra to web tile requests.
- Vercel lists the Squad Beacon project but returns HTTP 403 for project details. No local Vercel CLI was available. Production environment/deployment verification and any required production configuration correction remain blocked by that access restriction. No credentials were printed or committed, and no deployment was performed.


## Menu refinement

- Friends separates All Friends/Favorites from Private Lists with a divider and Manage entry. Close Friends uses a people icon; custom list initials use deterministic, theme-aware accents. Management shares the same icons and divider.
- Expanded Filters uses radio rows for When/Join, a two-column category checkbox grid, and a format segmented control. Compact map pills and removable filters retain their existing behavior.
- The web dark basemap separates CARTO's label tiles and increases label contrast without brightening markers or cards. Light tiles and native providers are unchanged. The right toolbar has 12px more clearance.

- Refinement validation: 60 focused unit checks and 20 relevant browser checks passed. Browser checks cover 320/375/430px layouts in light/dark appearance, Hosting/Joined tabs and the height cap, radio/checkbox/format controls, reset, context restoration, list separation and selection persistence, long names, and retained rose-heart/ownership badges. Both configured dark-layer endpoints and light tiles return PNG/200; the complete dark map was inspected at Beacon zoom.
