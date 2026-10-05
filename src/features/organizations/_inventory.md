Organizations feature

- types.ts and domain.ts: organization, role hierarchy, membership, squad-link, and chat contracts with client-side role affordances. Database authorization remains authoritative.
- OrganizationDirectory.tsx: bounded safe-summary search/browse, invite and join actions, creation, and the reusable Communities directory. No unjoined roster or message data is hydrated.
- OrganizationProfilePreview.tsx: current-member compact profile with authorized child communities and Beacon previews in the shared single-Sheet flow.
- OrganizationScreen.tsx: Overview, Communities, and Activity are primary sections. Members, invitations, shared policy, join requests and text chat remain contextual secondary actions; child rosters and chat are separately authorized.
- GroupChatThread.tsx: organization and squad group text chat, read-state updates, blocked-author filtering, plus canonical Squad Ping cards and responses. Squad chat adds real Ping, Beacon, Plan, and admin Invite flows; the schema has no photo/GIF attachments or inline location sharing, so those controls are omitted.
- squadChat.ts: canonical current-member Squad Ping selection and privacy-filtered response counts, shared by conversation rows and the chat timeline.
- app/organizations.tsx, app/organization/[id].tsx, app/squad-chat/[id].tsx: directory, organization detail, and squad chat routes.
- 202610040001_organization_audience_type.sql and 202610040002_organizations_group_chat.sql: additive audience type, organization membership/actions, squad links, profile grants, group-chat tables/RLS, snapshot wiring, and realtime publication. Apply through a reviewed migration workflow; this change does not deploy migrations.
- Organization database tests cover role boundaries, pending/active access, linked private squad isolation, blocked messages, audience and custom-profile revocation, read state, and account-deletion audit behavior.
