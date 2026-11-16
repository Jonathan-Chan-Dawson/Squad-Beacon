# Beacon UI

Four tabs: Map, Beacons, Squads, Profile. The raised center button creates a beacon or status. Inbox is a fixed top-right button with Updates and Messages.

Beacons defaults to Now. Friends Now shows explicit availability (never inferred from missing activity), followed by Happening Now cards with one Join action. Now ranks favorites first; Upcoming is chronological; Past keeps memories. Search, category, joined-only and sorting live in Filter. Personal templates and a single private favorite manager stay secondary.

Favorites rank friends and squads without changing permissions. Private lists select sharing audiences. A crew target is a desired headcount, not a hard capacity: the UI says Need N more rather than promising limited spots.

Map takes the full tab area. Pins and friend avatars open a small inline RSVP tooltip. Details opens the translucent four-tab workspace: Overview, People, Tools and Chat. Chat expands the panel and requires joining (and approval where configured). Direct messages require accepted friendship. Location remains temporary, explicitly shared and freshness checked.

Normal creation covers activity, timing, place and audience. Advanced adds details, joining approval, desired headcount and meeting pin. A status can explicitly mark Free to hang; it expires with its beacon. Templates save independently from publishing.

Goals and habits have no UI. Profile contains identity, optional personal details, memories and privacy/notification controls. The private signup birthdate is never exposed as the optional public birthday note.

Mint, Sunset and Midnight palettes apply across the main UI. Profile > Style my mini adjusts an original illustrated avatar; no third-party avatar account is required. Friends Now includes Free/Starred filters and a searchable roster. Find Friends uses fictional profiles only in demo; real accounts keep explicit invitations.

## Beacon presentation

Use calm section hierarchy, compact metadata and action rows, existing theme tokens, and one primary action per context. Information rows are not large buttons. Keep secondary configuration in focused editing or an inline disclosure. Do not rely on color alone for lifecycle, selection or progress. Controls remain at least 44px and reflow for narrow widths and larger text.

Activity schedule organizes stages inside one Beacon. A Plan connects multiple Beacons. Keep backend identifiers unchanged. Tool selection uses grouped tiles on phones and a contextual sidebar for selected tools on wider screens. Keep everyday controls separate from appearance and administrative settings. Do not cover activity content with a fixed management toolbar.

Schedule and hosting configuration use explicit Save/Cancel flows. Keep the original revision while editing, preserve local drafts on failed saves, and confirm before discarding changed drafts or replacing stages with presets. Organizer notes and participant answers remain permission-scoped and viewer/session-isolated.

See [the redesign plan](BEACON_UI_REDESIGN_PLAN.md) for the 120-item design checklist and [the redesign validation report](BEACON_UI_REDESIGN_VALIDATION.md) for implemented changes and verification boundaries. The existing theme implementation and feature inventories remain authoritative over historical descriptions above.
