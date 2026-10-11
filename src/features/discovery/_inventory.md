Public discovery feature

- types.ts: deliberately sanitized public summary and opt-in/action contracts. Public cards are not Activity objects.
- domain.ts: opt-in validation, safe-summary filtering, and interest/coarse-area ranking. These are client presentation helpers; server authorization remains authoritative.
- publicDirectory.ts / usePublicBeacons.ts: viewer-bound summary parsing and Map discovery loading.
- PublicBeaconPreview.tsx: coarse-area preview and join/request actions inside the existing Map callout.
- BeaconDiscoverySettings.tsx: explicit host publishing from existing Beacon settings.
- MapScreen integrates public summaries, unified search, and the existing community previews.
- 202610110001_map_discovery.sql supplies authenticated discovery, publishing, joining, and capacity enforcement.
