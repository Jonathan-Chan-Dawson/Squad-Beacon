Plans feature

- LivingPlansScreen.tsx and PlanPresentation.tsx: capability-gated lightweight creation, compact icon timeline, suggestions, inline review, independent ordering, and canonical editor handoffs. Existing route exports retain the legacy experience for older backends.
- livingPlans.ts: stable stop contracts, viewer-scoped selectors and shared Plan permissions. PlanChatPreview.tsx adds authorized compact chat links and existing decision responses.
- RepeatBeaconAction.tsx and RoutineScheduleSheet.tsx: shared Plan/Beacon repetition and explicit occurrence/future-repeat editing. Reviewed source content stays private on the server; no responses or attendance are copied.
- demoLivingPlans.ts and demoRepeatablePlans.ts: demo action parity; the repeat adapter reuses the existing Routine generator rather than implementing recurrence separately.
- Additive living_plans, collaborative_plans and repeatable_plans_calendar migrations backfill stops, associate canonical decision results, freeze reviewed sources, and retain the scheduler/occurrence ledger. See supabase/_inventory.md and docs/PLANS_OVERHAUL_VALIDATION.md for rollout and validation boundaries.

- PlansScreen.tsx and PlanDetailScreen.tsx: multi-Beacon itinerary builder/detail, independent Plan membership, physical directions and Routine entry point.
- RoutinesScreen.tsx and RoutineScheduleSheet.tsx: recurring Plan schedule and lifecycle tools.
- routines.ts: PlanMember/PlanRoutine contract, ISO weekday/date helpers, and demo fixture/action helpers.
- domain.ts: shared Plan schedule, occurrence, and conflict helpers.
- Migration `202610040003_plan_routines.sql` persists membership and Routine settings/occurrence history. Every generated occurrence reuses `private.apply_plan_action('create_plan', ...)`.
- `202610100001_create_flow.sql` extends the existing writers with Plan step timing metadata, manual start/end actions, transactional Beacon insertion, template usage history, and manual Routine reuse. Apply this additive migration before using the new actions against a connected account.
- Scheduled Routine occurrences retain source local times. Run Now creates a fresh Plan starting within two minutes and preserves spacing, audience, places, and start/end choices without consuming the next scheduled repeat.
- Create opens a Beacon / Plan / Routine chooser. It reuses the unchanged Beacon template catalog and existing personal template storage. Routines never have an app template catalog.
- Plan steps retain their reusable local schedule in `activities.plan_step`. A pending manual step uses a deferred timestamp to stay out of live discovery; a manual end uses an extended deadline until the owner explicitly ends it. `plan_started_at` distinguishes pending steps. Completed steps advance dependent Beacons, including duration chains, using the actual end.
- Browser coverage: `tests/browser/createFlow.spec.ts`. Domain/demo coverage: `tests/createFlow.test.ts`. Server permissions, idempotency and persistence coverage extends `tests/plansRoutine.database.test.ts`.

Automatic generation and reminder notices require the trusted server runner. If `pg_cron` is available when the migration runs, it registers the 15-minute job automatically. Otherwise enable `pg_cron` in Supabase, then run this once in the SQL Editor:

```sql
select cron.schedule(
  'beacon-plan-routines',
  '*/15 * * * *',
  $$do $job$ begin perform set_config('request.jwt.claim.role','service_role',true); perform public.run_due_plan_routines(); end $job$;$$
);
```

The runner function is executable only by `service_role`; do not call it from a client app or expose a service key. Reminder notices enter the normal server notice/push queue when due; delivery still depends on device permission/settings.
