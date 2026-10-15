import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  canReadOrganization,
  canReadOrganizationMembers,
} from "@/src/features/organizations/domain";
import { canReadSpace } from "@/src/features/spaces/domain";
import {
  normalizePlanningData,
  pendingPlanningThreads,
} from "@/src/features/planning/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import type { Data, ID, Plan, SquadMember } from "@/src/shared/types";
import type { PlanningThread } from "@/src/features/planning/types";
import type { SocialDirectorySummary } from "@/src/features/social/types";

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
  return activeSquadDecisions(data, squadId, userId, now)[0];
}

/** All open decisions that are directly addressed to this Squad and readable by the viewer. */
export function activeSquadDecisions(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
): PlanningThread[] {
  if (!canOpenSquadProfile(data, squadId, userId)) return [];
  const planning = normalizePlanningData(data);
  return pendingPlanningThreads(data, planning, userId, now)
    .filter(
      (thread) =>
        (thread.kind === "ping" || thread.kind === "vote") &&
        thread.audience === "squad" &&
        thread.audience_id === squadId,
    )
    .sort(
      (first, second) =>
        first.deadline_at.localeCompare(second.deadline_at) ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id),
    );
}

export type SquadOverviewPreview =
  | { kind: "decision"; decision: PlanningThread }
  | { kind: "beacon"; activity: Data["activities"][number]; timing: "current" | "upcoming" }
  | { kind: "plan"; plan: Plan; routine?: Data["plan_routines"][number] };

/**
 * Keeps the compact overview to three total current/upcoming previews. Pending
 * decisions take priority, followed by a current Beacon and then the nearest
 * Beacon or Plan. Ties are stable by type and id.
 */
export function squadProfilePreviews(
  data: Data,
  squadId: ID,
  userId: ID,
  now = Date.now(),
  limit = 3,
): SquadOverviewPreview[] {
  if (!canOpenSquadProfile(data, squadId, userId) || limit <= 0) return [];
  const previews: SquadOverviewPreview[] = activeSquadDecisions(
    data,
    squadId,
    userId,
    now,
  )
    .slice(0, limit)
    .map((decision) => ({ kind: "decision", decision }));
  if (previews.length >= limit) return previews;

  const activities = squadActivities(data, squadId, userId, now).filter(
    (activity) =>
      activity.status === "scheduled" && Date.parse(activity.ends_at) > now,
  );
  const current = activities.find(
    (activity) => Date.parse(activity.starts_at) <= now,
  );
  const beaconCandidates: SquadOverviewPreview[] = activities
    .filter((activity) => activity.id !== current?.id)
    .map((activity) => ({
      kind: "beacon",
      activity,
      timing: Date.parse(activity.starts_at) <= now ? "current" : "upcoming",
    }));
  if (current) {
    previews.push({ kind: "beacon", activity: current, timing: "current" });
  }

  const readablePlans = squadPlans(data, squadId, userId, now).filter(
    ({ plan }) =>
      !activities.some((activity) => activity.plan_id === plan.id),
  );
  const planCandidates: SquadOverviewPreview[] = readablePlans.map(
    ({ plan, routine }) => ({ kind: "plan", plan, routine }),
  );
  const startsAt = (preview: SquadOverviewPreview) => {
    if (preview.kind === "beacon") return Date.parse(preview.activity.starts_at);
    if (preview.kind === "plan") {
      const startDate = preview.routine?.next_occurrence_on ?? preview.plan.start_date;
      return Date.parse(`${startDate}T00:00:00.000Z`);
    }
    return Date.parse(preview.decision.deadline_at);
  };
  const priority = (preview: SquadOverviewPreview) =>
    preview.kind === "beacon" ? 0 : preview.kind === "plan" ? 1 : 2;
  const upcoming = [...beaconCandidates, ...planCandidates].sort(
    (first, second) =>
      startsAt(first) - startsAt(second) ||
      priority(first) - priority(second) ||
      (first.kind === "decision"
        ? first.decision.id
        : first.kind === "beacon"
          ? first.activity.id
          : first.plan.id
      ).localeCompare(
        second.kind === "decision"
          ? second.decision.id
          : second.kind === "beacon"
            ? second.activity.id
            : second.plan.id,
      ),
  );
  previews.push(...upcoming.slice(0, Math.max(0, limit - previews.length)));
  return previews;
}

/**
 * Readable Beacons associated with a publicly accessible Squad can be shown
 * without treating the viewer as a Squad member. The exact summary is the
 * route authorization proof; each Beacon still passes its own access check.
 */
export function publicSquadBeaconPreviews(
  data: Data,
  squadId: ID,
  userId: ID,
  exactSummary: Pick<SocialDirectorySummary, "entity_type" | "entity_id"> | null,
  now = Date.now(),
  limit = 3,
): Extract<SquadOverviewPreview, { kind: "beacon" }>[] {
  const boundedLimit = Math.min(3, Math.max(0, Math.trunc(limit)));
  if (
    !boundedLimit ||
    !exactSummary ||
    exactSummary.entity_type !== "squad" ||
    exactSummary.entity_id !== squadId ||
    data.viewer_id !== userId
  ) return [];

  return data.activities
    .filter((activity) =>
      activity.status === "scheduled" &&
      Date.parse(activity.ends_at) > now &&
      data.activity_social_links.some((link) =>
        link.activity_id === activity.id &&
        link.entity_type === "squad" &&
        link.entity_id === squadId,
      ) &&
      canReadBeaconActivity(data, activity, userId),
    )
    .sort((first, second) => {
      const firstCurrent = Date.parse(first.starts_at) <= now;
      const secondCurrent = Date.parse(second.starts_at) <= now;
      return Number(!firstCurrent) - Number(!secondCurrent) ||
        (firstCurrent && secondCurrent
          ? Date.parse(first.ends_at) - Date.parse(second.ends_at) ||
            Date.parse(second.starts_at) - Date.parse(first.starts_at)
          : Date.parse(first.starts_at) - Date.parse(second.starts_at)) ||
        first.id.localeCompare(second.id);
    })
    .slice(0, boundedLimit)
    .map((activity) => ({
      kind: "beacon",
      activity,
      timing: Date.parse(activity.starts_at) <= now ? "current" : "upcoming",
    }));
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

export type SquadRelationshipPreview = {
  id: ID;
  name: string;
  type: "organization" | "network";
};

/** Returns every directly associated user-facing Organization (Space) the viewer can read. */
export function visibleSquadOrganizations(
  data: Data,
  squadId: ID,
  userId: ID | null,
): SquadRelationshipPreview[] {
  if (!userId || !canOpenSquadProfile(data, squadId, userId)) return [];
  return data.space_squads
    .filter((link) => link.squad_id === squadId)
    .flatMap((link) => {
      const organization = data.spaces.find(
        (item) => item.id === link.space_id,
      );
      if (!organization || !canReadSpace(data, organization.id, userId))
        return [];
      return [{
        id: organization.id,
        name: organization.name,
        type: "organization" as const,
      }];
    })
    .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
}

/** Returns every directly associated user-facing Network (Organization) the viewer can read. */
export function visibleSquadNetworks(
  data: Data,
  squadId: ID,
  userId: ID | null,
): SquadRelationshipPreview[] {
  if (!userId || !canOpenSquadProfile(data, squadId, userId)) return [];
  return data.organization_squads
    .filter((link) => link.squad_id === squadId)
    .flatMap((link) => {
      const network = data.organizations.find((item) => item.id === link.organization_id);
      if (!network || !canReadOrganization(data, network.id, userId)) return [];
      return [{
        id: network.id,
        name: network.name,
        type: "network" as const,
      }];
    })
    .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
}
