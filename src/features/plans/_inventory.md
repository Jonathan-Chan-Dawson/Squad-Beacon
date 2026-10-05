Plans feature

- PlansScreen.tsx and PlanDetailScreen.tsx: multi-Beacon itinerary builder/detail, independent Plan membership, physical directions and Routine entry point.
- RoutinesScreen.tsx and RoutineScheduleSheet.tsx: recurring Plan schedule and lifecycle tools.
- routines.ts: PlanMember/PlanRoutine contract, ISO weekday/date helpers, and demo fixture/action helpers.
- domain.ts: shared Plan schedule, occurrence, and conflict helpers.
- Migration `202610040003_plan_routines.sql` persists membership and Routine settings/occurrence history. Every generated occurrence reuses `private.apply_plan_action('create_plan', ...)`.
- A standalone Routine-level start-time shift is not implemented in this pass; each occurrence keeps the local times configured on its source Beacons.

Automatic generation and reminder notices require the trusted server runner. If `pg_cron` is available when the migration runs, it registers the 15-minute job automatically. Otherwise enable `pg_cron` in Supabase, then run this once in the SQL Editor:

```sql
select cron.schedule(
  'beacon-plan-routines',
  '*/15 * * * *',
  $$do $job$ begin perform set_config('request.jwt.claim.role','service_role',true); perform public.run_due_plan_routines(); end $job$;$$
);
```

The runner function is executable only by `service_role`; do not call it from a client app or expose a service key. Reminder notices enter the normal server notice/push queue when due; delivery still depends on device permission/settings.
