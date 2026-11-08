import type { Data, Payload } from "@/src/shared/types";
import type { SquadPremiumProjection } from "@/src/shared/premiumFeatures";
import { boostTier, tierRank } from "@/src/shared/premiumFeatures";
import {
  premiumCatalog,
  resolvePersonalEntitlements,
} from "@/src/shared/entitlements";
const WAIT = 72 * 3600000;
export const demoBoostNow = (data: Data) =>
  data.is_demo && data.demo_boost_clock
    ? Date.parse(data.demo_boost_clock)
    : Date.now();
export function boostBalance(data: Data, ownerId: string | null) {
  const allowance = resolvePersonalEntitlements(data, ownerId).squadBoosts,
    now = demoBoostNow(data);
  const own = (data.boost_allocations ?? []).filter(
    (b) => b.owner_id === ownerId,
  );
  const allocated = own.filter((b) => !b.released_at).length,
    cooling = own.filter(
      (b) => !!b.released_at && Date.parse(b.available_at ?? "") > now,
    ).length;
  return {
    allowance,
    allocated,
    cooling,
    available: Math.max(0, allowance - allocated - cooling),
  };
}
function recordLevel(data: Data, squadId: string, at: number) {
  const total = (data.boost_allocations ?? []).filter(
    (b) =>
      b.squad_id === squadId &&
      Date.parse(b.assigned_at) <= at &&
      (!b.released_at || Date.parse(b.released_at) > at),
  ).length;
  const tier = boostTier(total),
    old = data.squad_premium?.find((s) => s.squad_id === squadId);
  let retained = old?.tier ?? "free",
    until = old?.grace_until ?? null;
  if (
    tierRank(tier) < tierRank(old?.qualified_tier ?? "free") &&
    (!until || Date.parse(until) <= at)
  ) {
    retained = old?.qualified_tier ?? "free";
    until = new Date(at + WAIT).toISOString();
  }
  if (tierRank(tier) >= tierRank(retained)) {
    retained = tier;
    until = null;
  }
  const held =
    until && Date.parse(until) > at && tierRank(retained) > tierRank(tier)
      ? retained
      : tier;
  const state: SquadPremiumProjection = {
    squad_id: squadId,
    total,
    qualified_tier: tier,
    tier: held,
    source: held !== tier ? "grace" : held !== "free" ? "squad" : "free",
    grace_until: until,
    contributors: (data.boost_allocations ?? [])
      .filter((b) => b.squad_id === squadId && !b.released_at)
      .map((b) => ({
        allocation_id: b.id,
        user_id: b.hidden ? null : b.owner_id,
      })),
  };
  data.squad_premium = [
    ...(data.squad_premium ?? []).filter((s) => s.squad_id !== squadId),
    state,
  ];
}
export function reconcileDemoBoosts(data: Data): Data {
  if (!data.is_demo) return data;
  const next = structuredClone(data),
    now = demoBoostNow(data),
    events = new Set<string>();
  const owners = new Set((next.boost_allocations ?? []).map((b) => b.owner_id));
  for (const owner of owners) {
    const active = (next.boost_allocations ?? [])
      .filter((b) => b.owner_id === owner && !b.released_at)
      .sort(
        (a, b) =>
          a.assigned_at.localeCompare(b.assigned_at) ||
          a.id.localeCompare(b.id),
      );
    const allowance =
      owner === next.viewer_id
        ? premiumCatalog[next.demo_premium_tier ?? "free"].squadBoosts
        : 0;
    let kept = 0;
    for (const b of active) {
      if (
        next.squad_members.some(
          (m) => m.squad_id === b.squad_id && m.user_id === owner,
        ) &&
        kept < allowance
      ) {
        kept++;
        continue;
      }
      b.released_at = new Date(now).toISOString();
      b.available_at = new Date(now + WAIT).toISOString();
      if (b.squad_id) events.add(b.squad_id);
    }
  }
  for (const sid of events)
    if (next.demo_squad_boosts?.[sid] === undefined)
      recordLevel(next, sid, now);
  next.squad_premium = next.squad_premium?.map((s) =>
    s.grace_until && Date.parse(s.grace_until) <= now
      ? {
          ...s,
          tier: s.qualified_tier,
          source: s.qualified_tier === "free" ? "free" : "squad",
          grace_until: null,
        }
      : s,
  );
  return next;
}
export function demoBoostAction(
  data: Data,
  action: string,
  p: Payload,
  viewer: string,
  newId: () => string,
): Data | undefined {
  if (
    ![
      "assign_boost",
      "withdraw_boost",
      "set_boost_privacy",
      "demo_squad_boost_total",
      "demo_expire_boost_grace",
    ].includes(action)
  )
    return;
  if (!data.is_demo || data.viewer_id !== viewer)
    throw new Error("Demo controls cannot change real entitlements.");
  const next = reconcileDemoBoosts(data),
    sid = String(p.squad_id ?? "");
  const now = demoBoostNow(next);
  next.boost_allocations ??= [];
  if (action === "demo_expire_boost_grace") {
    next.demo_boost_clock = new Date(now + WAIT + 1000).toISOString();
    return reconcileDemoBoosts(next);
  }
  if (action === "demo_squad_boost_total") {
    if (
      !next.squad_members.some(
        (m) => m.user_id === viewer && m.squad_id === sid,
      ) ||
      !Number.isInteger(p.total) ||
      Number(p.total) < 0 ||
      Number(p.total) > 5
    )
      throw new Error("Choose a simulated total from zero to five.");
    next.demo_squad_boosts = {
      ...next.demo_squad_boosts,
      [sid]: Number(p.total),
    };
    const total = Number(p.total),
      tier = boostTier(total),
      old = next.squad_premium?.find((s) => s.squad_id === sid);
    let held = old?.tier ?? "free",
      until = old?.grace_until ?? null;
    if (
      tierRank(tier) < tierRank(old?.qualified_tier ?? "free") &&
      (!until || Date.parse(until) <= now)
    ) {
      held = old?.qualified_tier ?? "free";
      until = new Date(now + WAIT).toISOString();
    }
    if (tierRank(tier) >= tierRank(held)) {
      held = tier;
      until = null;
    }
    next.squad_premium = [
      ...(next.squad_premium ?? []).filter((s) => s.squad_id !== sid),
      {
        squad_id: sid,
        total,
        qualified_tier: tier,
        tier: until && Date.parse(until) > now ? held : tier,
        source: until ? "grace" : tier === "free" ? "free" : "squad",
        grace_until: until,
        contributors: old?.contributors ?? [],
      },
    ];
    return next;
  }
  if (action === "assign_boost") {
    if (
      !next.squad_members.some(
        (m) => m.user_id === viewer && m.squad_id === sid,
      ) ||
      next.squads.find((s) => s.id === sid)?.archived_at
    )
      throw new Error("Join this Squad before contributing a Boost.");
    if (boostBalance(next, viewer).available <= 0)
      throw new Error(
        "No Boost slots available. Released Boosts have a 72-hour transfer wait.",
      );
    if (
      next.boost_allocations.filter((b) => b.squad_id === sid && !b.released_at)
        .length >= 5
    )
      throw new Error("This Squad already has five active Boosts.");
    if (next.demo_squad_boosts?.[sid] !== undefined) {
      delete next.demo_squad_boosts[sid];
      next.squad_premium = next.squad_premium?.filter(
        (s) => s.squad_id !== sid,
      );
      recordLevel(next, sid, now);
    }
    next.boost_allocations.push({
      id: newId(),
      owner_id: viewer,
      squad_id: sid,
      assigned_at: new Date(now).toISOString(),
      released_at: null,
      available_at: null,
      hidden: p.hidden === true,
    });
    if (next.demo_squad_boosts) delete next.demo_squad_boosts[sid];
    recordLevel(next, sid, now);
  } else {
    const b = next.boost_allocations.find(
      (b) => b.id === p.id && b.owner_id === viewer,
    );
    if (!b) throw new Error("Boost allocation unavailable.");
    if (
      action === "withdraw_boost" &&
      b.squad_id &&
      next.demo_squad_boosts?.[b.squad_id] !== undefined
    ) {
      delete next.demo_squad_boosts[b.squad_id];
      next.squad_premium = next.squad_premium?.filter(
        (s) => s.squad_id !== b.squad_id,
      );
      recordLevel(next, b.squad_id, now);
    }
    if (action === "set_boost_privacy") {
      if (typeof p.hidden !== "boolean")
        throw new Error("Choose contributor visibility.");
      b.hidden = p.hidden;
    } else if (!b.released_at) {
      b.released_at = new Date(now).toISOString();
      b.available_at = new Date(now + WAIT).toISOString();
    }
    if (b.squad_id) {
      if (action === "withdraw_boost" && next.demo_squad_boosts)
        delete next.demo_squad_boosts[b.squad_id];
      if (
        action === "set_boost_privacy" &&
        next.demo_squad_boosts?.[b.squad_id] !== undefined
      ) {
        const state = next.squad_premium?.find(
          (s) => s.squad_id === b.squad_id,
        );
        if (state)
          state.contributors = next.boost_allocations
            .filter((a) => a.squad_id === b.squad_id && !a.released_at)
            .map((a) => ({
              allocation_id: a.id,
              user_id: a.hidden ? null : a.owner_id,
            }));
      } else recordLevel(next, b.squad_id, now);
    }
  }
  return next;
}
