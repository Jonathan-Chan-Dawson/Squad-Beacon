People preview components

- `ChatIdentityHeader.tsx`: accessible avatar-and-name DM header that opens the compact profile preview after dismissing the keyboard.
- `ProfilePreviewFrame.tsx`: shared, single-Sheet parent profile and in-Sheet Beacon preview frame; Beacon content rechecks visibility and gates approval-only meeting details.
- `PersonProfilePreview.tsx`: Person preview opened from a friend DM; contains safe identity, Star/Unstar, at most two current mutual contexts, authorized View Map, current/next Beacon, and View Full Profile.
- `SquadProfilePreview.tsx`: membership-gated Squad preview with privacy-filtered member avatars, authorized linked Organization/Space previews, current and next readable Squad Beacons, one pending scoped Ping/Vote, Plan/Routine context, and at most four contextual actions.
- `SpaceProfilePreview.tsx` and `OrganizationProfilePreview.tsx`: membership-gated community previews that preserve parent/child navigation and show only authorized child communities and Beacons.
- `SocialCommunityInlinePreview.tsx`: recursive child/parent preview rendered in the same Sheet, with current-access checks and a working back stack.
- `personPreview.ts`: pure privacy/current-snapshot selectors for DM access, profile visibility, Beacon context and approved participation, shared contexts, Beacon meeting-detail access, and fresh geographically valid locations.
