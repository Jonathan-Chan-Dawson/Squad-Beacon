Messages feature

- ChatThread.tsx: reusable person/activity chat thread component.
- `app/messages/[id].tsx`: guarded friend DM route with a safe tappable identity header.
- `previews/ChatIdentityHeader.tsx`: shared DM identity target; dismisses keyboard before opening a compact preview.
- `previews/ProfilePreviewFrame.tsx`: shared single-Sheet profile/Beacon body swap and permission-rechecked compact Beacon preview.
- `previews/PersonProfilePreview.tsx`: privacy-aware DM profile preview with canonical Starred state, authorized map entry, and full-profile navigation.
- `previews/personPreview.ts`: pure current-snapshot selectors for accepted relationships, profile access, shared contexts, Beacon participation/status, and fresh valid shared locations.
