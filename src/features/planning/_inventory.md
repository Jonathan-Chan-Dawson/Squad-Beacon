Planning feature

- PlanningListScreen.tsx and PlanningDetailScreen.tsx: Pings & Decisions creation and voting/draw flows.
- PlanningDetailScreen supports an embedded decision view in the Beacon sheet; PlanningEditor and ProposalEditor reuse the same actions with inline editors in that context.
- Embedded Suggested Beacon focus delegates to the map's existing contextual filter callback; standalone detail keeps its existing map route.
- PlanningInbox.tsx: reusable actionable decision previews and canonical inline Ping responses; Chats home now uses the compact Responses & Invitations entry.
- PingAvailabilityEditor.tsx and availability.ts: optional Interested availability; existing platform date picker, UTC storage and approval-aware Auto-RSVP constraint.
- domain.ts and types.ts: pure audience/deadline/draft logic and planning contracts.
