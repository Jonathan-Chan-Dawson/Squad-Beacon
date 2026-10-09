# Prompt 4 Squads and messaging validation

The user's latest instruction routes remaining implementation and review to Sol 6.1. Architecture and canonical access constraints are in [SQUADS_MESSAGING_REDESIGN_PLAN.md](SQUADS_MESSAGING_REDESIGN_PLAN.md).

## Current validation status (2026-10-09)

Final integrated typecheck and full lint passed; subsequent changed files passed scoped lint. Reciprocal Sol 6.1 / High packet review resolved canonical response counts/actions, failed-send isolation, invitation identities, discovery privacy, hierarchy access, and Feed integration findings.

The full npm test rerun after the demo-store correction passed 233/233 cases in 39.1 seconds, including eight optimistic-send cases, four Hub state/privacy cases, three historical-memory permission cases, planning responses, hierarchy access, blocked profiles, and private snapshots. All nine exploration cases passed. The frozen web export built 38 routes with entry-6a99cf01a5ee6544cb8d467aea0f9a89.js.

Both focused Squads browser tests passed, covering phone resizing, community pager alignment, separate profile/message targets, opener insertion without sending, and sent-message persistence after reopening the conversation. Stale role locators were corrected to the actual shared control's button semantics before rerunning. The Upcoming shared-sheet smoke check verified six real pending responses (five Pings plus one Vote), grouped content, a fully visible/enabled pinned New Ping or Vote button, and the canonical /councils creation route. Map/detail 9/9 and Feed 2/2 also passed. Browser diagnostics recorded no runtime exceptions; CARTO tile requests were aborted during navigation.

## Supported contracts and backend limits

- Ping answers use the original thread ID and the existing Interested / Maybe / Pass API with auto_rsvp: false. Vote and Draw use supported decision flows. Successful responses acknowledge before collapse; failed actions retain the card and canonical selection.
- Stars use the existing favorite action with id, kind, and desired add state. Mute is omitted because no notification preference API exists. DM read ticks and fabricated DM unread counts are omitted.
- FlashList 2.0.2 has no inverted prop. Chronological chat data uses supported maintainVisibleContentPosition.startRenderingFromBottom positioning.
- Message APIs provide no client nonce or server idempotency guarantee. The client permits one in-flight send per conversation, retains failed text, and offers explicit retry. Receipts adopt canonical database IDs and valid creation timestamps. Without a receipt, reconciliation uses a best-effort new-ID/author/body/time heuristic; identical text sent near the same time from another device remains ambiguous. An ambiguous lost acknowledgement can still lead to a duplicate after manual retry. Automatic resend is disabled.
- No canonical Beacon-created event source supplies creation timestamps and actors; events are not fabricated from activity start times.
- Discovery receives sanitized summaries only. Parent membership never grants child membership, profile access, rosters, or messages. Exact entity membership and current permissions govern navigation and actions.

## Native observations and remaining acceptance

The Pixel 8a API 35 emulator is authorized. The rebuilt x86_64 Android debug APK installed and launched, including pager-view 8.0.2 and keyboard-controller 1.21.9 (579 build tasks). Native Communities swipes and segmented-pill synchronization, and Feed full-viewport layout, were confirmed.

**Map results-sheet and shared modal-sheet visibility remain under investigation.** A dim backdrop does not establish visible sheet contents. Compact-sheet actions and cross-surface native Ping responses are not accepted yet. Remaining native checks also include pull-to-reveal search, keyboard/composer movement, newest-message positioning, and failed-send/retry behavior.

The earlier guest-reboot USB-debugging authorization block is resolved. Historical startup issues are preserved in [MAP_REDESIGN_VALIDATION.md](MAP_REDESIGN_VALIDATION.md). Development build and browser success do not establish release-build stability or native gesture acceptance.

Windows cannot run an iOS simulator. iPhone safe areas and gestures require an iPhone or macOS simulator. Physical haptics, sustained release-build frame rate, thermal/battery behavior, GPS, and manufacturer-specific permissions require physical-device checks. Final native sheet outcomes will be appended after the ongoing investigation.