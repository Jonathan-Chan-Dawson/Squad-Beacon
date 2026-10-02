Public discovery feature

- types.ts: deliberately sanitized public summary and opt-in/action contracts. Public cards are not Activity objects.
- domain.ts: opt-in validation, safe-summary filtering, and interest/coarse-area ranking. These are client presentation helpers; server authorization remains authoritative.
- DiscoverScreen.tsx and route integration will be added after the shared 005/006 snapshot handoff.
