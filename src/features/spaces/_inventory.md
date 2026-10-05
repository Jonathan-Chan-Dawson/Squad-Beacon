# Spaces

Lightweight Squad hubs, independent of Organizations. Membership in a Space never grants access to private Squad chats or rosters.

- `types.ts`: Space, membership and Squad-link data shapes.
- `domain.ts`: current-viewer membership, management and visible-Squad selectors.
- `SpacesDirectory.tsx`: searchable join/invitation directory, standalone Space creation, and owner-authorized multi-Squad grouping without membership copying.
- `SpaceScreen.tsx`: Space overview, contextual search across privacy-visible members/authorized Beacons/connected Squads, policy and request management, and permission-scoped Squad connections.
- `domain.ts`: `visibleSquadSpace` requires current Squad access plus active, readable Space membership before exposing parent context.
- `SpaceProfilePreview.tsx`: member-gated compact profile, parent/child community previews, and current authorized Beacon previews in the shared Sheet.
- `SpaceScreen` settings use the shared social policy controls; Space membership and each Squad roster/chat remain independent.
