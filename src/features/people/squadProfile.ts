import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  canReadOrganization,
  canReadOrganizationMembers,
} from "@/src/features/organizations/domain";
import {
  normalizePlanningData,
  pendingPlanningThreads,
} from "@/src/features/planning/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import type { Data, ID, Plan, SquadMember } from "@/src/shared/types";
import type { PlanningThread } from "@/src/features/planning/types";

function isBlocked(data: Data, left: ID, right: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

export type SquadSizeLabel = "Small Squad" | "Medium Squad" | "Large Squad" | "Huge Squad";

/** Friendly size labels; the number remains the primary, exact measure. */
export function squadSizeLabel(memberCount: number): SquadSizeLabel {
  if (memberCount <= 5) return "Small Squad";
  if (memberCount <= 15) return "Medium Squad";
  if (memberCount <= 30) return "Large Squad";
  return "Huge Squad";
}

/** A Squad profile is only available from the current, authorized snapshot. */
export function activeSquadMembership(
  data: Data,
  squadId: ID,
  userId: ID | null,
): SquadMember | undefined {
  if (!userId || data.viewer_id !== userId) return undefined;
  const squad = data.squads.find((item) => item.id === squadId);
  if (!squad || squad.archived_at || isBlocked(data, squad.owner_id, userId) ||
      data.squad_bans.some((ban) => ban.squad_id === squadId && ban.user_id === userId)) return undefined;
  return data.squad_members.find(
    (member) => member.squad_id === squadId && member.user_id === userId,
  );
}

export function canOpenSquadProfile(
  data: Data,
  squadId: ID,
  userId: ID | null,
) {
  return !!activeSquadMembership(data, squadId, userId);
}

export function visibleSquadMembers(data: Data, squadId: ID, userId: ID) {
  if (!canOpenSquadProfile(data, squadId, userId)) return [];
  return data.squad_members
    .filter((member) => member.squad_id === squadId)
    .map((member) => {
      const profile = data.profiles.find((item) => item.id === member.user_id);
      return {
        member,
        profile:
          profile && canViewProfile(data, profile, userId) ? profile : undefined,
      };
    });
}

export function squadActivities(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
) {
  if (!canOpenSquadProfile(data, squadId, userId)) return [];
  return data.activities
    .filter(
      (activity) =>
        activity.audience === "squad" &&
        activity.audience_id === squadId &&
        canReadBeaconActivity(data, activity, userId),
    )
    .sort(
      (first, second) =>
        Number(Date.parse(first.starts_at) < now) -
          Number(Date.parse(second.starts_at) < now) ||
        first.starts_at.localeCompare(second.starts_at),
    );
}

export function squadCurrentAndNextActivities(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
) {
  const activities = squadActivities(data, squadId, userId, now).filter(
    (activity) => activity.status === "scheduled",
  );
  const current = activities.find(
    (activity) =>
      Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now,
  );
  const next = activities.find((activity) => Date.parse(activity.starts_at) > now);
  return { current, next };
}

export function squadHistory(data: Data, squadId: ID, userId: ID) {
  return squadActivities(data, squadId, userId).sort(
    (first, second) => second.starts_at.localeCompare(first.starts_at),
  );
}

export function squadPlans(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
): { plan: Plan; routine?: Data["plan_routines"][number] }[] {
  if (!canOpenSquadProfile(data, squadId, userId)) return [];
  return data.plans
    .filter(
      (plan) =>
        canReadSquadPlan(data, plan, squadId, userId) &&
        plan.status === "scheduled" &&
        (Date.parse(`${plan.start_date}T23:59:59Z`) >= now ||
          data.activities.some(
            (activity) =>
              activity.plan_id === plan.id &&
              activity.status === "scheduled" &&
              Date.parse(activity.ends_at) > now &&
              canReadBeaconActivity(data, activity, userId),
          ) ||
          data.plan_routines.some(
            (routine) =>
              routine.plan_id === plan.id &&
              routine.status === "active" &&
              !!routine.next_occurrence_on &&
              routine.next_occurrence_on >= new Date(now).toISOString().slice(0, 10),
          )),
    )
    .sort((first, second) => first.start_date.localeCompare(second.start_date))
    .map((plan) => ({
      plan,
      routine: data.plan_routines.find(
        (routine) =>
          routine.plan_id === plan.id && routine.status === "active",
      ),
    }));
}

/** Mirrors the snapshot/RLS rule: the plan must be the current readable plan row, and its Squad is an audience, not a plan_members grant. */
export function canReadSquadPlan(
  data: Data,
  plan: Plan,
  squadId: ID,
  userId: ID,
) {
  return (
    plan.squad_id === squadId &&
    data.plans.some(
      (current) =>
        current.id === plan.id &&
        current.owner_id === plan.owner_id &&
        current.squad_id === squadId,
    ) &&
    canOpenSquadProfile(data, squadId, userId) &&
    !isBlocked(data, plan.owner_id, userId)
  );
}

export function activeSquadDecision(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
): PlanningThread | undefined {
  if (!canOpenSquadProfile(data, squadId, userId)) return undefined;
  const planning = normalizePlanningData(data);
  return pendingPlanningThreads(data, planning, userId, now)
    .filter(
      (thread) =>
        (thread.kind === "ping" || thread.kind === "vote") &&
        thread.audience === "squad" &&
        thread.audience_id === squadId,
    )
    .sort((first, second) => first.deadline_at.localeCompare(second.deadline_at))[0];
}

export function visibleSquadOrganization(
  data: Data,
  squadId: ID,
  userId: ID | null,
) {
  if (!userId || !canOpenSquadProfile(data, squadId, userId)) return undefined;
  return data.organization_squads
    .filter((link) => link.squad_id === squadId)
    .map((link) => data.organizations.find((item) => item.id === link.organization_id))
    .find((organization) => {
      return !!organization && canReadOrganization(data, organization.id, userId) &&
        canReadOrganizationMembers(data, organization.id, userId);
    });
}
