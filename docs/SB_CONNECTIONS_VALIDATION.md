# SB Connections — Phase 5 delivery and validation

Source checkpoint: 2026-10-29. Delivered in order: Phase 5.1 guest Beacon foundation, then Phase 5.2 external planning and continuity. Neither migration has been applied to a hosted backend by this task. Production sharing stays disabled until the [README setup and acceptance steps](../README.md#guest-invitations-sb-connections) are completed.

## Feature inventory

| Feature | State | Evidence / remaining acceptance |
| --- | --- | --- |
| Verified guest identity, 16+ eligibility, returning sessions | Implemented locally | Supabase passwordless transport; verified Auth IDs; secure HttpOnly cookies/refresh; no fabricated profiles. Real SMTP/delivery acceptance requires hosted setup. |
| HTTPS Beacon invitations and RSVP | Implemented locally | Preview/participation access, expiry/revoke/regenerate, canonical Going/Interested/Decline, approval/full/cancelled/closed states, host removal and shared capacity transaction. Hosted multi-connection concurrency unverified. |
| Pings | Implemented locally | Interested/Maybe/Pass and supported Interested availability; guest Auto-RSVP remains off. |
| Pick One and Approval Votes | Implemented locally | One effective canonical ballot; approved eligible options; changes before deadline; canonical tally, explicit ties and legacy resolution. |
| Draws | Implemented locally | Approved options and actual canonical results only. Guest pages read-only; existing organizer randomizer remains authoritative. |
| Find a Time | Implemented locally | Canonical Yes/Maybe/No, None work, slot revisions and refresh feedback; organizer selection/finalization preserved. |
| Authorized result following | Implemented locally | Result Beacon requires its own valid share; following never silently sets Going or enables sharing. |
| Selected Plan preview | Implemented locally | Stable approved stop IDs; new/unselected/private stops omitted; independently authorized child links; Routine-source Plans excluded. No chat, rosters or unpublished proposals. |
| Optional Status Note | Implemented locally | Owner-selected expiring text snapshot; exact text verified on enable. Clearing/completing/removing/superseding source or expiry/revocation disables access. No attachments, presence, availability, Current Activity or location. |
| Common sharing menu | Implemented locally | Share Link, Copy Link, QR Code, Guest Access Settings and host response controls. Integrated with eligible Beacons, decisions, Plans and own Status; account/target guards retained. |
| Social previews and QR flyers | Implemented locally | Escaped JavaScript-free metadata, 1200×630 PNG social cards and downloadable SVG QR flyers. Actual social-platform scraping unverified. Downloads/caches cannot be recalled. |
| Calendar handoffs | Implemented locally | Authorized ICS: stable UID, UTC instants, cancellation, escaping/folding; Google Calendar link. Manual exports only. |
| Event changes and response updates | Implemented locally | Returning visits read current authorized event/response state; eligible changes use canonical rules. No email/push change subscription. |
| Guest-to-member claiming | Implemented locally | Explicit review/confirm, verified guest cookie plus destination bearer, completed member profile, transaction/idempotency, member conflicts win, pending stays pending, finalized history retained. No memberships/roles granted. |
| Native invitation receiver and auth continuation | Partial acceptance | Invitation/target preservation, browser handoff and sign-in continuation implemented. Signed-device tests blocked on builds/devices. |
| Universal/App Links | Conditional implementation | Validated domain/signing config and dynamic association files implemented. Activation blocked on domain, Apple Team ID and Android certificate fingerprints. HTTPS fallback available. |
| Optional event-change email notifications | Deferred | Explicitly deferred in approved scope; verification email transport implemented. |

Public boards, payments, guest chat, calendar synchronization, widget rebuilds and navigation redesigns are excluded. Concurrent Phase 4/Auth edits were preserved.

## Canonical data and authorization contracts

Additive migrations, in order:

1. `20261028193122_guest_beacon_foundation.sql`: private identities, hashed shares, provenance/exclusions, replay/rate records; canonical RSVP ownership uses real `auth.users` IDs; profile deletion preserves cleanup. Full-event access requires a member profile even for approved guests. Adds `guest_sharing` capability.
2. `20261029000145_guest_planning_continuity.sql`: canonical Ping/vote/approval/availability/history ownership supports those same IDs; guest-aware projections/tallies/resolution, selected Plan/Status projections and transactional claims. Adds `guest_planning`. No parallel ballot, scheduler or Draw engine.

These public RPCs are service-role-only. Actors come from validated Auth sessions, never untrusted request-body identity fields.

| RPC | Interface |
| --- | --- |
| `guest_auth_limit` | `rate_key, command` → rate check |
| `guest_identity` | `actor, display_name, birth` → confirmed eligible identity |
| `guest_share_manage` | `actor, command, kind, target, settings, new_hash` → host-authorized settings |
| `guest_preview` | `link_hash, actor?, target?` → minimal page, own response and permitted outcome |
| `guest_respond` | `link_hash, actor, command, payload, request, target?` → idempotent canonical response |
| `guest_attendance` | `actor, target, participant?, command` → host attendance/approval/removal |
| `guest_decision_responses` | `actor, target, participant?, command` → organizer response view/removal before closure |
| `guest_claim` | `guest_id, member_id, command` → dual-proof preview/confirmation |

Only hashes of server-generated random bearer links persist. Authentication credentials stay out of URLs. Mutations enforce same origin, custom CSRF header, bounded input, verified sessions and separate HMAC rate keys for IP/email. Pages use no-store, no-referrer, noindex, CSP nonce and escaped markup/metadata. Card/calendar routes use anonymous safe projections.

Response provenance survives expiry/revocation so recorded tallies remain meaningful. Revocation stops access without silently deleting contributions. Live ownership can be claimed after revocation without restoring access; organizer exclusions follow the identity. Claims lock actors/targets, preserve member conflicts and approval state, and never reopen deadlines or rewrite finalized outcomes. Historical attribution remains. Guests cannot approve proposals, organize, change roles or publish.

Plan/result navigation checks the originating share and an independent child share; a target UUID alone grants nothing. New stops remain unshared. Status text is captured separately from private live configuration and never refreshed into an existing snapshot.

## Local verification evidence

- Guest checks: **50 passing** across the final foundation/planning suites (23, including parent tests) and final server/presentation suite (27). Run together with `npm run test:guest`. Covers complete ordered migrations in PGlite, role isolation, capacity, replay, approval/removal, expiry/revocation, ballots, stale slots, deadlines, ties, canonical Draw results, Plan privacy and claim conflicts/retries/revoked links/same-identity onboarding.
- `npm run test:guest:browser`: **6 passing** Playwright journeys. Two connect the real browser/client/handler to canonical PGlite functions through the HTTP backend adapter; external Supabase Auth/email is substituted. Covers returning approval/response changes/revocation, Ping/Pick One/Approval/Time revisions/Draw/Plan/result/claiming. Others cover invalid links, JavaScript-free metadata, preview-only states, 320px layout and reduced motion.
- `npm run typecheck` and `npm run lint`: passed at this checkpoint.
- Phone screenshots generated under `test-results/`; visual inspection confirmed narrow ballot/Plan layouts and the rendered flyer. Server tests validate PNG dimensions, escaping and ICS folding. An independent QR decoder verifies the exact invitation and child-target URLs from rasterized flyers; real phone-camera acceptance remains unverified.
- Production web export passed: `EXPO_OFFLINE=1 CI=1 expo export --platform web --max-workers 2 --output-dir .expo/sb-connections-final`; 54 static routes, including share/claim/invitation entrypoints.
- Existing RSVP suite: **41 passing**. Existing onboarding suite: **25 passing**. Full selected suite: **556 passing / 1 failing**, reproducing the previously observed `tests/livingPlans.database.test.ts:493` assertion that the trusted Routine runner generates reviewed occurrences. This failure predates the guest migrations; no unrelated Routine behavior was changed. Existing connected-planning/planning-thread integration checks pass in that run.

PGlite serializes execution; it does not prove multi-connection PostgreSQL race behavior. These checks establish neither hosted email nor native-device acceptance. Full Expo onboarding → claim-screen interaction is not covered by isolated guest browser fixtures; existing onboarding tests and dual-session API/database tests cover their respective boundaries.

## Remaining release steps

Canonical environment, migration, SMTP/template, Vercel packaging/routing, domain association and signed rebuild instructions live in [README](../README.md#guest-invitations-sb-connections). No remote project was guessed or modified. Guest templates do not replace existing signup/recovery templates.

Before production enablement: apply both migrations to the selected backend; deploy the endpoint and capability-enabled clients; verify real email/refresh, two-client PostgreSQL last-seat/deadline/claim races, actual social scraping/QR scanning and completed onboarding/claim UI; supply domain/signing credentials and test signed iOS/Android handoffs. Keep production `SB_GUEST_ENABLED=false` until acceptance passes. Disabling it later preserves participation.
