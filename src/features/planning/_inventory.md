Planning feature

- Plan-context composers retain the canonical decisions and responses, scope their audience to the originating Plan, and dismiss back to its existing timeline. ConnectedPlanningActions accepts returnPlanId for reviewed publication; no separate Plan decision engine exists.

- PlanningListScreen.tsx: organizer management, contributed proposals, and history; everyday participation lives in Responses & Invitations.
- PlanningComposer.tsx and composerSession.ts: focused Ping/Vote/Draw creation, unique account-scoped in-memory sessions, stable option editor handoffs, and frozen publication recovery.
- inbox.ts and DecisionRow.tsx: canonical decision grouping, flat action-first rows, inline context, and authoritative Draw results.
- PlanningResponseControls.tsx, PingPreferences.tsx, and submission.ts: reusable response controls, explicit Ping preferences, and shared per-thread submission exclusion.
- PlanningDetailScreen.tsx: retained advanced Council management and embedded decision details.
- PlanningDetailScreen supports an embedded decision view in the Beacon sheet; PlanningEditor and ProposalEditor reuse the same actions with inline editors in that context.
- Embedded Suggested Beacon focus delegates to the map's existing contextual filter callback; standalone detail keeps its existing map route.
- PlanningInbox.tsx: reusable actionable decision previews and canonical inline Ping responses; Chats home now uses the compact Responses & Invitations entry.
- PingAvailabilityEditor.tsx and availability.ts: optional Interested availability; existing platform date picker, UTC storage and approval-aware Auto-RSVP constraint.
- domain.ts and types.ts: pure audience/deadline/draft logic and planning contracts.

- creationSession.ts and PlanningTimeField(.web).tsx: account-scoped session drafts, resumable Council publication steps, and platform-native local date/time entry.

- TimeFinder.tsx and ZonedTimeField(.web).tsx: scheduling composer, inline availability, explicit final-time selection, and time-zone-safe amendments.
- CouncilChoices.tsx: compact Pick One/approval choices and authorized inline proposal review.
- ConnectedPlanningActions.tsx and PlanningControls.tsx: canonical result doorway, continuation/backup-host actions, private replies, and compact native controls.
- connected.ts, handoff.ts, and demoConnected.ts: scheduling rules, reviewed Beacon editor handoffs, and demo action parity. Hosted authority remains in the additive connected_planning migration.
