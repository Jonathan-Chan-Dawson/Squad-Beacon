# Prompt 6: Live Updates and Map simplification

Build on Prompts 0/1 and retain unfinished Prompt 4/5 verification. Implementation and reciprocal review use Sol 6.1 with high reasoning. The request is in the attached Prompt 6 specification; this plan records repository integration decisions.

## Boundaries

The internal feature directory is `src/features/pulse`; user copy lives in one `copy/pulse.ts` file and says Live Update, Area Update, or What's it like here? It describes places, never people. There are no reporter identities, head-counts, comments, reactions, feeds, profiles, rankings, new tabs, or new map modes. Posting never asks for location and has one proximity-verification TODO at its call site. Creating a Beacon remains an explicit navigation to the existing editor.

## Packets and contracts

1. Core: types and pure aggregation/expiry/confidence wording/category profiles/layer policy first, then an additive Supabase migration, summary-only RPC adapter, demo store, and cancellable bounds-query hook. The hook owns 350-ms settled-camera debounce, 60-second tier/bounds cache, viewer/session isolation, optimistic updates and rollback. It makes no queries while Live Updates is off.
2. UI: compact Add Live Update sheet, existing-slot place preview, semantic badges/meters, note overflow, success/confirmation feedback, empty/retry states, reduced-motion behavior, and accessibility announcements. UI receives summaries and draft answers only, never raw reports.
3. Map integration: four permanent controls, shared Options, calm drag state, persisted camera/preferences/hints, place/search/long-press selection, separate Live Update collisions and zoom tiers, Beacon satellite badges, list accessibility alternative, and native/web rendering adapters.
4. Root: integration contracts, unchanged Beacon access checks, reciprocal review, database/pure/component/browser/native checks, and final evidence.

Reuse the existing MapBounds/MapViewport, WorldwidePlace, saved ActivityPlace, camera and editor contracts. The current place adapter has no typed place category; add a small shared place-category classification from provider types, falling back to unknown/crowd-only for unclassified saved places and Area Updates. Do not infer access or people from a place category. Preserve provider attributions.

`PulseSummary` remains the only UI data model. If needed to implement per-kind weak wording, add a small optional per-kind confidence projection; a global recent-count cannot establish two independent reports for each kind. No identity or raw-report arrays may be included. Coordinate public component/hook contracts before parallel edits.

## Server and abuse protection

Add one new migration following the existing sequence. Authenticated insert/delete is owner-only; raw SELECT is denied. Because direct inserts must not bypass RPC limits, enforce timestamps, TTLs, replacement and rate limits at the database boundary. Reuse trusted private request/rate bookkeeping where practical. Preserve authenticated-only RPCs and revoke helper access.

Aggregation uses the specified half-lives and weighted rounded levels, with recency tie-breaking and expiry/weight cutoffs. Conditions stay weak until at least two independent active reporters support them; confirmations never manufacture a second reporter. Confirmation expiry never exceeds created time plus two original TTLs. Validate every kind/value/category/note/coordinate and geohash key. Count posting submissions consistently when a sheet sends multiple selected groups.

Notes are short, optional, and place-oriented. Report hides the note immediately for that viewer and uses a server-supported report operation. Never expose the author to implement reporting or prefilled updates. The user's last selections can be retained in viewer-scoped client state rather than fetching raw rows.

Demo data consists of ten fictional places with varied ages and signal types, stored in memory and reset with the demo session. It never uploads, requests GPS, or modifies Beacon state.

**Do not apply the migration or deploy anything.** Provide a README explaining RPC contracts and the trusted scheduler required to delete expired reports. Local test databases may exercise the SQL to validate it; this is not deployment.

## Acceptance

Test conflicting levels, decay, expiry boundaries, independent closure evidence, confirmation cap/cooldown, rolling posting limits, reporter-free API output, bounds/dateline handling, meaningful signal cutoff, zoom caps and collision ranking. Test category-specific sheet groups/disabled Post and no-data preview, plus off-means-zero-query behavior.

Native checks cover visible sheets, Map gestures, satellite/collision rendering, drag calm/restore, and sticky actions. Browser checks supplement them. This Windows workspace cannot test iOS simulator behavior or physical-device haptics, GPS, thermal load, or sustained 60-fps performance on mid-range hardware. Record those limits rather than claiming the physical target.

## October 10 integrated verification

Full typecheck and lint passed, all 263 unit/database tests passed, and a fresh web export built 39 routes. All three Live Updates browser checks passed, including posting, summary/badge changes, saved choices, confirmation cooldown, note reporting and zero GPS requests. Four additional layout checks and all four Profile/Settings checks passed on the final bundle; see [LAYOUT_CLEANUP_VALIDATION.md](LAYOUT_CLEANUP_VALIDATION.md). The badge test now scopes its locator to the Map because the accessible list row uses the same summary label.

Android Map controls and the shared Create menu were inspected. The final Create menu has a correctly aligned title/Close row and all three actions above the system navigation area. Full native Map gesture/performance and posting acceptance remains incomplete. Neither pending migration was applied, and no service was deployed.
