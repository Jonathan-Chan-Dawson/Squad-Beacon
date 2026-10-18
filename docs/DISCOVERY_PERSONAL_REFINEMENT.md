# Discovery & Personal Experience Refinement

This increment addresses the first request only: Map discovery, My Collection, and the Status composer. Beacon detail destinations, readiness, What to Bring, Activity tools, and Memories are reserved for the separate second increment.

## Changes

- Public discovery markers use category artwork in compact, stronger pins. Authorized organization, Network, Squad, and friend relationships use small identity emblems, independent from access rules. Existing authorized friend avatars, low-zoom dots, clustering, controls, and live/selected emphasis remain in place.
- Map preview “See overview” pushes the existing full Beacon page directly. The mounted Map retains its selection, camera, filters, and removable Plan/Vote context.
- My Collection is a full-page destination from the Beacons homepage. Six concise destinations cover Saved Beacons, My Plans, Favorite Friends, Favorite Squads, My Templates, and Library. Recently Saved sorts by the viewer’s bookmark timestamps. Saved previews use an authorized existing photo where available and category artwork otherwise. Legacy collection shortcuts now open these full pages.
- Status opens with distinct availability choices, an expressive Activity Note, visibility, and duration. Description/categories and advanced fields remain accessible under More Details & Settings. Save stays in the sheet footer; Clear and Create Beacon are secondary actions. Duration selection no longer changes availability. Web uses a centered composer; native uses the existing adaptive, keyboard-aware sheet.

## Data and compatibility

No schema or Supabase policy changes. Existing privacy selectors, signed media access, atomic Status actions, template actions, favorite actions, and navigation destinations are reused. Existing unrelated local changes were preserved.

## Validation

- Focused domain tests cover Map clustering/filtering/context, Status persistence and atomic rollback, themes, Library authorization, and marker identity separation.
- Browser coverage includes 320/390/430px composer and collection layouts, saving/clearing Status, duration/availability independence, light appearance, reduced motion, saved Beacon removal, direct Map-to-Beacon navigation, and camera/selection restoration.
- TypeScript, focused lint, web export, and iOS/Android bundle exports were checked. Native exports validate bundling, not physical-device keyboard or screen-reader behavior.
- The broader existing demoMapFixtures browser suite exposed three unresolved checks: a React hydration warning, an expected available badge absent from a demo friend preview, and a cluster expected at the initial Map camera. Its public join/occupancy interactions succeeded. These failures have not been established as pre-existing; the focused navigation test passes.
