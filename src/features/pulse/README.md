# Live Updates core

The UI imports only `types.ts` summary/place/draft contracts. `reports.ts` is an internal pure/demo input and is never fetched by the client. Place classification uses provider types, not names or viewer data. Unknown places and geohash precision-7 Area Updates expose crowd choices only.

`aggregatePulse` applies the specified half-lives, rounded weighted levels, recency tie-breaks, per-kind weight cutoff and expiry boundary. One active owner/place/kind row is enforced in SQL, so supporting condition rows are independent. Confirmation changes weight/lifetime but does not create another reporter. The displayed confirmation count is the maximum active-row confirmation counter, which avoids multiplying one place confirmation across all its kinds.

`generatedAt` and `signals` contain only per-kind totals, counts, freshness and validity timestamps. The hook projects these every 30 seconds without network calls. A kind is conservatively discarded when its first contributing row expires; exact aggregation of remaining rows happens on the next normal bounds refresh. No contributor arrays, report IDs or reporter columns are returned. Notes also have a validity timestamp. Camera queries debounce 350 ms, cache a bounds/zoom-tier result for 60 seconds and abort stale requests. Off renders no summaries and makes no queries. Explicit Search this area refresh invalidates the cache. Posting/confirmation cancels any older camera response, validates the returned summary and checks the current viewer before committing it. No mutation retries automatically.

The ten demo places are fictional. Demo operations remain in memory, use the same validation/aggregation rules, count one selected-group batch as one submission and never upload or request location. Last answers and confirmation cooldowns are viewer scoped. A note report hides that exact sample immediately for this viewer, even if the report request fails; the server stores only private report bookkeeping. No existing profanity hook was found, so notes are trimmed, capped at 80 characters and reportable; no moderation system or queue is claimed.

The single retained in-memory client session survives Map remounts. The Store's viewer epoch changes on sign-in, sign-out and entering demo, so even re-entering demo with the same viewer ID creates fresh fixtures and empty answers/cooldowns. Foreground/background refresh does not reset that session. No state survives a JavaScript process restart. Area Update coordinates are canonicalized to the center of the precision-7 geohash cell, so nearby taps in the same cell can contribute to the same coarse summary.

## Unapplied migration

[`202610090002_live_updates.sql`](../../../../supabase/migrations/202610090002_live_updates.sql) is additive and **has not been applied or deployed**. It does not alter Beacon/profile/location access.

Authenticated RPC contracts:

- `get_pulse_summaries(bounds jsonb, zoom float8)` → a JSON array of whitelisted summaries, at most 500 places in the visible bounds, ranked by importance × freshness. Bounds support the dateline.
- `post_pulse(draft jsonb)` → the canonical place summary. Draft contains `placeKey`, `lat`, `lng`, `category`, `answers` and optional `note`. One batch of selected groups is one rolling-hour submission. The seventh submission within one rolling hour is rejected.
- `confirm_pulse(place_key text)` → the canonical place summary. Each viewer may confirm that place once per ten minutes. No expired row is revived; each lifetime is capped at created time plus two original TTLs.
- `report_pulse_note(place_key text, note_sample text)` → void. Only the matching active note is privately hidden for this viewer; there is no author or report-ID response.

Raw SELECT and UPDATE are denied. Insert/delete RLS is owner-only. The insert trigger also enforces rate limits, canonical timestamps/TTLs, one active row per kind and consistent coordinates/category for an already active place key. A private transaction marker lets the trusted posting RPC charge one batch while direct inserts are each charged; clients cannot forge it. Definer helpers have an empty search path and are not callable by authenticated/anonymous users.

`cleanup_pulse_reports()` is executable only by `service_role`. A **trusted scheduler still needs configuration** to call it periodically. It deletes expired rows and old rate/cooldown bookkeeping; no scheduler was configured by this task. The isolated `pulse.database.test.ts` loads the SQL only into a disposable local PGlite instance, checks privileges/rates/confirmation caps and compares server aggregation with the pure implementation. It does not connect to or modify a linked Supabase project.

References inspected before implementation: [Expo Router SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc), installed Supabase PostgREST abort/retry source, and PostgreSQL [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [triggers](https://www.postgresql.org/docs/current/trigger-definition.html), and [function security](https://www.postgresql.org/docs/current/sql-createfunction.html).
