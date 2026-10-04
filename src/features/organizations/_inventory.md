Organizations feature

- types.ts: separate organization/member records and action payloads. Organizations are not squads; ownership is stored on the organization and is not a mutable membership role.
- domain.ts: client-side role affordance helpers for owner/admin/member workflows. Database/RPC authorization remains authoritative.
- OrganizationScreen.tsx and route integration will be added after the shared 005/006 snapshot handoff.
