# Messaging hub — Prompt 1

The Squads tab now owns Chats and Communities in one destination. Each view retains its search and list instance; returning from a conversation retains the selected people list and chat filter. `/communities` redirects into the Communities state, and legacy Friends/Lists/Pings entry parameters remain supported.

Private Lists reuse the existing owner-private lists and memberships. Friends and Favorites are live, eligibility-filtered selections. Choosing a list only filters Chats. Editing its membership retains the existing sharing effect elsewhere. Rename/delete actions validate ownership; deletion rejects audience or profile-sharing references rather than silently changing access.

DM and Squad threads share grouped bubbles, compact planning/Beacon previews, a bounded multiline composer, and a keyboard frame with one owner for keyboard avoidance and bottom safe-area spacing. The embedded Organization chat retains its parent keyboard avoidance. Explicit Ping links focus compact timeline previews; ordinary inbox entry respects unread position. Incoming history updates preserve the reader's anchor; sending or Jump to latest intentionally moves to the bottom.

## Database rollout

Apply `supabase/migrations/202610140003_messaging_hub.sql` before releasing the corresponding client. This source change does not apply migrations to a hosted project.

- Adds owner-private `dm_message_reads` and an optional canonical-message boundary for existing group read positions.
- Extends the authenticated snapshot and action wrapper without replacing existing send, planning, membership, or privacy business logic.
- Backfills existing DM history as read. Read updates require an authorized canonical message and cannot move backward, including timestamp ties.
- Adds `rename_list` and protected `delete_list`; retains existing `create_list` / `list_member` interfaces.

The application retains its complete snapshot-backed histories and FlashList virtualization. It does not introduce a replacement transport, new file storage, calls, recipient read receipts, or history pagination.

## Verification

Focused coverage lives in `tests/messagingHub.test.ts`, `tests/messagingHub.database.test.ts`, and `tests/browser/messagingHubPrompt1.spec.ts`, with updated hub and profile-navigation regression tests. Browser scenarios cover 320/375/430px widths, contextual search, list management/filtering, DM/Squad sending, draft restoration, history anchoring, and compact linked previews.

Native keyboard acceptance requires actual iOS and Android device/emulator checks; browser viewport tests do not establish native keyboard correctness. Prompt 2 profile/management work and unrelated workspace changes are outside this implementation.

Completed checks: 35 unit/database cases and 16 browser scenarios passed across the focused and regression suites. TypeScript, ESLint, and the Expo web export passed. Android emulator checks confirmed keyboard open/close, 44–120px multiline growth, reachable Send controls, and send/reset behavior in the shared composer. iOS device/simulator verification remains unavailable on this Windows host. The migration was exercised locally; it has not been applied to hosted Supabase.
