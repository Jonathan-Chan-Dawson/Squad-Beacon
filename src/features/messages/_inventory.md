Messages feature

- ChatThread.tsx: reusable person/activity chat thread component.
- ChatComposer.tsx, ChatBubbleList.tsx and useOptimisticChat.ts: shared DM/Beacon/Squad message UI and sending/retry state. The compact emoji picker inserts real Unicode text; the + menu retains supported planning actions. Readable author avatars/names open the existing compact profile preview. Beacon sheets provide an inline preview callback to avoid another modal.
- `app/messages/[id].tsx`: guarded friend DM route with a safe tappable identity header.
- `previews/ChatIdentityHeader.tsx`: shared DM identity target; dismisses keyboard before opening a compact preview.
- `previews/ProfilePreviewFrame.tsx`: shared single-Sheet profile/Beacon body swap and permission-rechecked compact Beacon preview.
- `src/features/people/previews/PersonProfilePreview.tsx`: privacy-aware compact preview with canonical Starred, Message/friend-request actions, authorized map entry, and optional full-profile navigation.
- `previews/personPreview.ts`: pure current-snapshot selectors for accepted relationships, profile access, shared contexts, Beacon participation/status, and fresh valid shared locations.
