People feature

- socialSelection.ts / components/SocialSelector.tsx: controlled recipient selection with explicit supported kinds, scrolling underlined categories, divided private-list filters, and bulk-selection undo. Stored spaces display as Organizations and stored organizations as Super-Organizations; membership never expands into invitations.
- Chat rows retain their existing layout, with a compact Friends/Add Friends separator before the start-chat friend rows.

- screens/MessagingHubScreen.tsx: same-tab Chats/Communities hub, independent search state, compact controls and legacy entry parameters; screens/SquadsScreen.tsx preserves the public entry point.
- privateLists.ts / components/PrivateListsSheet.tsx: eligible personal people filters, automatic Friends/Favorites and persisted owner-private list editing.

- components/CommunityAvatar.tsx, SquadIconPicker.tsx and squadIcons.ts: shared group/list symbols and an admin-only persisted Squad icon choice. People keep the existing privacy-aware ProfileAvatar minis/photos.

- screens/ResponsesScreen.tsx: full-screen live decision/invitation/join-request inbox; compact filters/rows and existing canonical actions. components/ResponsesSheet.tsx retains compatibility for existing launchers.
- SquadsScreen and CommunicationHubScreen use Chats/Communities access, one compact response row and a searchable vertical New Message directory. Interactive Ping cards remain in Squad chat.

- screens/SquadsScreen.tsx: chat-first Squads entry with temporary search, compact communities and a secondary people/private-list directory, also reused by Profile’s Friends & Lists entry.
- screens/SquadProfileScreen.tsx: one member-gated Squad Info overview; focused Members, Invite, Beacons & Plans and Settings routes retain existing handlers and normal Back navigation. Legacy tab parameters remain valid.
- squadProfile.ts: current-snapshot Squad membership, privacy, Beacon, Plan, Routine, Ping/Vote and linked-Organization selectors; Space parent access is selected in spaces/domain.ts.
- CommunicationHub.tsx / screens/CommunicationHubScreen.tsx: chat-first home and a separate Communities directory; adaptive empty states, a bounded joined-community preview, contextual filters, compact discovery rows and existing invitation/creation menus.
- communication.ts: snapshot-safe inbox counts and People search, plus canonical Squad chat summaries with source-linked latest Ping previews and separate pending-response state.
- SocialDirectoryResults.tsx: stale-snapshot-safe paginated community summaries with server-backed join/request/invite actions.
- priority.ts: Friends Now relevance tiers; search uses shared/search.ts.
- DirectoryControls.tsx: labeled directory scope controls.
- InviteQR.tsx: invite code/QR presentation.
- MiniAvatar.tsx: compact people avatar presentation.

- screens/PersonProfileScreen.tsx: direct full profile, compact relationship actions, permission-gated Beacon/shared-context previews and contextual Safety & Privacy with confirmed friendship removal.
- components/ProfilePrimitives.tsx: accessible compact action rows, quiet navigation rows and short populated sections.
- app/communities.tsx: focused community directory route; legacy links and entity identifiers remain stable.

- Prompt 2: SquadProfileScreen uses compact profiles, a combined three-item activity preview, horizontal member previews, virtualized focused Members, multiple authorized community disclosures and categorized guarded settings. VirtualizedCommunityDirectory owns full safe community lists and existing membership actions.

- components/PrivateListAvatar.tsx: shared Close Friends people icon and deterministic theme-aware custom-list initial colors in the selector and management.
