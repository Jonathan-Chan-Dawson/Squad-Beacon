import type { Activity, Data, Payload } from "./types";
import {
  boostTier,
  higherTier,
  premiumFeatures,
  tierRank,
  type PremiumFeature,
} from "./premiumFeatures";

export type PremiumTier = "free" | "plus" | "pro";
export type Quota = number | null;
export const premiumCatalog = {
  free: {
    name: "Free",
    price: "$0",
    beaconTemplates: 10,
    planTemplates: 2,
    multiBeaconRecurrence: false,
    advancedCoordination: false,
    squadBoosts: 0,
  },
  plus: {
    name: "BEACON+",
    price: "$4.99/month",
    beaconTemplates: 50,
    planTemplates: 10,
    multiBeaconRecurrence: true,
    advancedCoordination: false,
    squadBoosts: 2,
  },
  pro: {
    name: "BEACON+ Pro",
    price: "$9.99/month · proposed",
    beaconTemplates: null,
    planTemplates: null,
    multiBeaconRecurrence: true,
    advancedCoordination: false,
    squadBoosts: 5,
  },
} as const;
export type EntitlementSnapshot = {
  owner_id: string;
  tier: PremiumTier;
  source: "verified" | "free";
  valid_until: string | null;
  usage: { beacon_templates: number; plan_templates: number };
};
export function isPremiumTier(value: unknown): value is PremiumTier {
  return value === "free" || value === "plus" || value === "pro";
}
export function resolvePersonalEntitlements(
  data: Data,
  ownerId: string | null,
  now = Date.now(),
) {
  const own = !!ownerId && data.viewer_id === ownerId;
  const grant = own ? data.premium : undefined;
  const verified =
    own &&
    data.is_demo !== true &&
    data.capabilities?.premium === true &&
    grant?.owner_id === ownerId &&
    grant.source === "verified" &&
    isPremiumTier(grant.tier) &&
    (grant.valid_until === null || Date.parse(grant.valid_until) > now);
  const simulated = own && data.is_demo === true;
  const tier: PremiumTier =
    simulated && isPremiumTier(data.demo_premium_tier)
      ? data.demo_premium_tier
      : verified
        ? grant!.tier
        : "free";
  return {
    scope: "personal" as const,
    ownerId,
    tier,
    source: simulated
      ? ("simulated" as const)
      : verified
        ? ("verified" as const)
        : ("free" as const),
    ...premiumCatalog[tier],
    standardPlans: true,
    singleBeaconRecurrence: true,
    checklistItems: null as Quota,
    bringItems: true,
    advancedCoordination:
      tier === "pro" &&
      (data.is_demo === true || data.capabilities?.premium_tools === true),
    advancedCoordinationStatus:
      data.is_demo || data.capabilities?.premium_tools
        ? ("available" as const)
        : ("coming_soon" as const),
    squadBoostStatus:
      data.is_demo || data.capabilities?.squad_boosts
        ? ("available" as const)
        : ("coming_soon" as const),
  };
}
export function resolveSquadEntitlements(data: Data, squadId: string) {
  const member = data.squad_members.some(
    (m) => m.squad_id === squadId && m.user_id === data.viewer_id,
  );
  const projection =
    member && (data.is_demo || data.capabilities?.squad_boosts)
      ? data.squad_premium?.find((s) => s.squad_id === squadId)
      : undefined;
  const total =
    data.is_demo && member && data.demo_squad_boosts?.[squadId] !== undefined
      ? data.demo_squad_boosts[squadId]
      : (projection?.total ?? 0);
  const projectedTier =
    data.is_demo && member && data.demo_squad_boosts?.[squadId] !== undefined
      ? projection?.total === total
        ? projection.tier
        : boostTier(total)
      : (projection?.tier ?? "free");
  const now =
    data.is_demo && data.demo_boost_clock
      ? Date.parse(data.demo_boost_clock)
      : Date.now();
  const expiredGrace =
    !!projection?.grace_until && Date.parse(projection.grace_until) <= now;
  const tier = expiredGrace
    ? (projection?.qualified_tier ?? "free")
    : projectedTier;
  return {
    scope: "squad" as const,
    squadId,
    tier,
    total,
    grace_until: expiredGrace ? null : (projection?.grace_until ?? null),
    source:
      (expiredGrace
        ? tier === "free"
          ? ("free" as const)
          : ("squad" as const)
        : projection?.source) ??
      (data.is_demo ? ("simulated" as const) : ("free" as const)),
    simulated: data.is_demo === true,
    multiBeaconRecurrence: tier !== "free",
    advancedCoordination: tier === "pro",
    bringItems: true,
    checklistItems: null as Quota,
  };
}
export function resolveBeaconEntitlements(
  data: Data,
  beacon: Pick<Activity, "owner_id" | "id">,
) {
  const personal = resolvePersonalEntitlements(data, beacon.owner_id);
  const full =
    data.activities.find((a) => a.id === beacon.id) ??
    (beacon as Partial<Activity>);
  const squad =
    full?.audience === "squad" &&
    full.audience_id &&
    !data.public_beacons.some((b) => b.activity_id === beacon.id) &&
    data.squad_members.some(
      (m) => m.squad_id === full.audience_id && m.user_id === full.owner_id,
    )
      ? resolveSquadEntitlements(data, full.audience_id)
      : undefined;
  const projection =
    data.capabilities?.premium_tools && !data.is_demo
      ? data.beacon_premium?.[beacon.id]
      : undefined;
  const projectionExpired =
    !!projection?.grace_until &&
    Date.parse(projection.grace_until) <=
      (data.is_demo && data.demo_boost_clock
        ? Date.parse(data.demo_boost_clock)
        : Date.now());
  const tier =
    (!projectionExpired ? projection?.tier : undefined) ??
    higherTier(personal.tier, squad?.tier ?? "free");
  // Contextual tool access never transfers the organizer's personal save quotas.
  return {
    scope: "beacon" as const,
    beaconId: beacon.id,
    ownerId: beacon.owner_id,
    tier,
    source:
      (!projectionExpired ? projection?.source : undefined) ??
      (squad && tierRank(squad.tier) > tierRank(personal.tier)
        ? squad.source
        : personal.source),
    grace_until:
      (!projectionExpired ? projection?.grace_until : undefined) ??
      squad?.grace_until ??
      null,
    singleBeaconRecurrence: true,
    multiBeaconRecurrence: tier !== "free",
    advancedCoordination: tier === "pro",
    bringItems: personal.bringItems,
    checklistItems: personal.checklistItems,
  };
}
export function resolvePremiumFeature(
  data: Data,
  feature: PremiumFeature,
  activity?: Pick<Activity, "id" | "owner_id">,
  personalOnly = false,
) {
  const definition = premiumFeatures[feature];
  const supported =
    data.is_demo === true ||
    ([
      "checklist_details",
      "checklist_presets",
      "library_organization",
      "preparation",
    ].includes(feature)
      ? data.capabilities?.premium_tools === true
      : data.capabilities?.advanced_beacon_tools === true);
  const entitlement =
    definition.scope === "personal" || personalOnly || !activity
      ? resolvePersonalEntitlements(data, data.viewer_id ?? null)
      : resolveBeaconEntitlements(data, activity);
  return {
    feature,
    scope: entitlement.scope,
    source: entitlement.source,
    tier: entitlement.tier,
    requiredTier: definition.tier,
    available:
      supported && tierRank(entitlement.tier) >= tierRank(definition.tier),
    grace_until: "grace_until" in entitlement ? entitlement.grace_until : null,
    status: supported
      ? ("available" as const)
      : ("backend_unavailable" as const),
  };
}
export function requirePremiumFeature(
  data: Data,
  feature: PremiumFeature,
  activity?: Activity,
  personalOnly = false,
) {
  if (!data.is_demo && !data.capabilities?.premium_tools) return; // Preserve older-backend supported actions.
  if (!resolvePremiumFeature(data, feature, activity, personalOnly).available)
    throw new Error(
      `PREMIUM_REQUIRED: ${premiumFeatures[feature].label} requires ${premiumFeatures[feature].tier === "pro" ? "BEACON+ Pro" : "BEACON+"}. Existing content stays available.`,
    );
}
export function personalTemplateUsage(data: Data, ownerId: string | null) {
  if (!ownerId || data.viewer_id !== ownerId)
    return { beacon_templates: 0, plan_templates: 0 };
  return {
    beacon_templates: data.templates.filter((t) => t.owner_id === ownerId)
      .length,
    plan_templates: data.plan_templates.filter(
      (t) => t.owner_id === ownerId && !t.squad_id,
    ).length,
  };
}
export function routineSourceCount(data: Data, planId: string) {
  return (
    data.demo_repeat_sources?.[planId]?.steps.length ??
    data.plan_routines.find((r) => r.plan_id === planId)?.source_stop_count ??
    data.activities.filter(
      (a) => a.plan_id === planId && a.status !== "cancelled",
    ).length
  );
}
export function quotaMessage(
  kind: "Beacon" | "Plan",
  used: number,
  limit: number,
) {
  return `PREMIUM_QUOTA: ${used}/${limit} personal ${kind} templates saved. ${limit === 50 || (kind === "Plan" && limit === 10) ? "BEACON+ Pro offers unlimited templates." : "BEACON+ offers more saved templates."} Existing templates stay available.`;
}
export function assertTemplateQuota(
  data: Data,
  ownerId: string,
  action: string,
  payload: Payload,
) {
  const usage = personalTemplateUsage(data, ownerId),
    e = resolvePersonalEntitlements(data, ownerId);
  if (
    action === "save_template" &&
    !data.templates.some(
      (t) => t.id === payload.id && t.owner_id === ownerId,
    ) &&
    e.beaconTemplates !== null &&
    usage.beacon_templates >= e.beaconTemplates
  )
    throw new Error(
      quotaMessage("Beacon", usage.beacon_templates, e.beaconTemplates),
    );
  if (
    (action === "save_living_plan_template" ||
      (action === "save_plan_template" &&
        !payload.squad_id &&
        !data.plan_templates.some((t) => t.id === payload.id))) &&
    e.planTemplates !== null &&
    usage.plan_templates >= e.planTemplates
  )
    throw new Error(
      quotaMessage("Plan", usage.plan_templates, e.planTemplates),
    );
}
export function pauseDemoPremiumRoutines(data: Data): Data {
  if (!data.is_demo) return data;
  const next = structuredClone(data);
  for (const r of next.plan_routines) {
    if (
      r.status === "active" &&
      r.run_mode !== "manual" &&
      routineSourceCount(next, r.plan_id) > 1 &&
      !resolvePersonalEntitlements(next, r.owner_id).multiBeaconRecurrence &&
      !(() => {
        const p = next.plans.find((p) => p.id === r.plan_id);
        if (
          !p?.squad_id ||
          !next.squad_members.some(
            (m) => m.squad_id === p.squad_id && m.user_id === r.owner_id,
          ) ||
          !resolveSquadEntitlements(next, p.squad_id).multiBeaconRecurrence
        )
          return false;
        const ids =
          next.demo_repeat_sources?.[p.id]?.activity_ids ??
          next.activities.filter((a) => a.plan_id === p.id).map((a) => a.id);
        return (
          ids.length > 0 &&
          ids.every((id) =>
            next.activities.some(
              (a) =>
                a.id === id &&
                a.audience === "squad" &&
                a.audience_id === p.squad_id &&
                !next.public_beacons.some((b) => b.activity_id === id),
            ),
          )
        );
      })()
    ) {
      r.status = "paused";
      r.premium_pause_reason = "plus_required";
    }
  }
  return next;
}

export function hasPlanRecurrenceEntitlement(
  data: Data,
  planId: string,
  ownerId: string,
) {
  if (resolvePersonalEntitlements(data, ownerId).multiBeaconRecurrence)
    return true;
  const p = data.plans.find((p) => p.id === planId);
  if (
    !p?.squad_id ||
    !data.squad_members.some(
      (m) => m.squad_id === p.squad_id && m.user_id === ownerId,
    ) ||
    !resolveSquadEntitlements(data, p.squad_id).multiBeaconRecurrence
  )
    return false;
  const ids =
    data.demo_repeat_sources?.[planId]?.activity_ids ??
    (data.plan_stops ?? [])
      .filter(
        (s) =>
          s.plan_id === planId &&
          s.activity_id &&
          s.approval === "approved" &&
          s.state === "active",
      )
      .map((s) => s.activity_id!);
  return (
    ids.length > 0 &&
    ids.every((id) =>
      data.activities.some(
        (a) =>
          a.id === id &&
          a.audience === "squad" &&
          a.audience_id === p.squad_id &&
          !data.public_beacons.some((b) => b.activity_id === id),
      ),
    )
  );
}
