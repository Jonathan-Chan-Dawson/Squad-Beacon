People feature

- screens/SquadsScreen.tsx: chat-first Squads entry with temporary search, compact communities and a secondary people/private-list directory, also reused by Profile’s Friends & Lists entry.
- screens/SquadProfileScreen.tsx: member-gated full Squad profile with Overview, Members, Activity history, authorized parent-community previews, and honest existing Settings/actions.
- squadProfile.ts: current-snapshot Squad membership, privacy, Beacon, Plan, Routine, Ping/Vote and linked-Organization selectors; Space parent access is selected in spaces/domain.ts.
- CommunicationHub.tsx: Chats/Communities views, compact chat rows, privacy-safe identity previews, searchable community results, and invitation/creation menus.
- communication.ts: snapshot-safe inbox counts and People search, plus canonical Squad chat summaries with source-linked latest Ping previews and separate pending-response state.
- SocialDirectoryResults.tsx: stale-snapshot-safe paginated community summaries with server-backed join/request/invite actions.
- priority.ts: Friends Now relevance tiers; search uses shared/search.ts.
- DirectoryControls.tsx: labeled directory scope controls.
- InviteQR.tsx: invite code/QR presentation.
- MiniAvatar.tsx: compact people avatar presentation.
