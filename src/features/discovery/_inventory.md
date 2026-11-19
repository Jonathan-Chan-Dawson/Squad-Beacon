Public discovery feature

- usePublicBeacons.ts: shared member/signed-out summary loading and safe exact-ID continuation. Map and Browse retain their existing layouts; public previews prompt for authentication before joining. No separate guest layouts or fabricated Activity objects.
- BeaconDiscoverySettings.tsx: owner-only guest visibility metadata and explicit opt-in, separate from authenticated discovery publishing. The additive guest-discovery migration supplies the bounded anonymous summary RPC; existing tables and member permissions remain private.

- types.ts: deliberately sanitized public summary and opt-in/action contracts. Public cards are not Activity objects.
- domain.ts: opt-in validation, safe-summary filtering, and interest/coarse-area ranking. These are client presentation helpers; server authorization remains authoritative.
- publicDirectory.ts / usePublicBeacons.ts: viewer-bound summary parsing and Map discovery loading.
- PublicBeaconPreview.tsx: public-summary-only adapter for the shared discovery card, with coarse-area location, guarded join/request actions, and optional details/close controls.
- DiscoveryBeaconCard.tsx / discoveryCardPresentation.ts: shared compact editorial shell and pure accepted-count/capacity/social metadata formatting for authorized Activity and sanitized public-summary inputs.
- BeaconDiscoverySettings.tsx: explicit host publishing from existing Beacon settings.
- MapScreen integrates public summaries, unified search, and the existing community previews.
- 202610110001_map_discovery.sql supplies authenticated discovery, publishing, joining, and capacity enforcement.

- Community connections: beaconCommunities/useBeaconCommunities provide a viewer-scoped batched safe association projection; BeaconCommunityRow shares secondary canonical membership controls. CommunityPublicProfile, CommunityPublicBeacons, CommunityPublicRelatedCommunities and useCommunityPublicBeacons support summary-only public routes and scoped pagination. domain.ts merges public/readable Browse rows and ranks/diversifies only authorized contexts.

- CommunityBeaconTopics and useCommunityTopics expose optional official-source topics and account-scoped follows on community profiles. Map derives Following matches from authorized topic assignments in the snapshot.
