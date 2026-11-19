import type { Activity, Data } from "@/src/shared/types";
import {
  resolvePersonalEntitlements,
  resolvePremiumFeature,
  resolveSquadEntitlements,
} from "@/src/shared/entitlements";
import {
  premiumFeatures,
  tierRank,
  type PremiumFeature,
} from "@/src/shared/premiumFeatures";

export const premiumBenefitGroups = [
  {
    title: "Coordinate the details",
    description:
      "Give tasks an owner and due date, arrange activity stages, and keep hosting details together.",
    features: ["checklist_details", "agendas", "hosting"],
  },
  {
    title: "Make good setups reusable",
    description:
      "Reuse Lists and Journal templates, or build a focus sequence for your next session.",
    features: ["checklist_presets", "journal_templates", "focus_sequences"],
  },
  {
    title: "Make shared moments yours",
    description:
      "Organize memories into albums and highlights, add Journal formatting, and choose additional Beacon styles.",
    features: ["memory_collections", "journal_formatting", "appearance"],
  },
] as const satisfies readonly {
  title: string;
  description: string;
  features: readonly PremiumFeature[];
}[];

export function premiumAccessPresentation(
  data: Data,
  feature: PremiumFeature,
  activity?: Pick<Activity, "id" | "owner_id">,
) {
  const access = resolvePremiumFeature(data, feature, activity);
  const tier = access.requiredTier === "pro" ? "Pro" : "Plus";
  const beacon = activity && data.activities.find((a) => a.id === activity.id);
  const demoSquad =
    data.is_demo &&
    premiumFeatures[feature].scope === "shared" &&
    beacon?.audience === "squad" &&
    beacon.audience_id &&
    !data.public_beacons.some((b) => b.activity_id === beacon.id) &&
    data.squad_members.some(
      (m) => m.squad_id === beacon.audience_id && m.user_id === beacon.owner_id,
    )
      ? resolveSquadEntitlements(data, beacon.audience_id)
      : undefined;
  const shared =
    access.source === "squad" ||
    access.source === "grace" ||
    !!(
      demoSquad &&
      tierRank(demoSquad.tier) >= tierRank(access.requiredTier) &&
      tierRank(
        resolvePersonalEntitlements(data, activity?.owner_id ?? null).tier,
      ) < tierRank(access.requiredTier)
    );
  const label =
    access.status !== "available"
      ? "Coming soon"
      : access.available
        ? shared
          ? "Included through your Squad"
          : "Included"
        : `Requires ${tier}`;
  return {
    ...access,
    label,
    tierLabel: tier,
    simulated: data.is_demo === true,
    detail:
      access.status !== "available"
        ? "This feature is not available in this version yet."
        : access.available
          ? shared
            ? "Your Squad’s shared benefits include this feature."
            : activity
              ? "Available with this Beacon’s eligible personal membership."
              : "Available with your personal membership."
          : premiumFeatures[feature].scope === "personal"
            ? "This personal feature requires your own eligible membership."
            : "Access comes from an eligible personal membership or shared Squad benefits where supported.",
  };
}

export function squadBenefitProgress(data: Data, squadId: string) {
  const entitlement = resolveSquadEntitlements(data, squadId);
  const target = entitlement.total < 2 ? 2 : 4;
  return {
    ...entitlement,
    target,
    fraction: Math.min(1, entitlement.total / target),
    progressLabel:
      entitlement.total >= 4
        ? "Pro unlocked"
        : `${entitlement.total}/${target} Boosts toward ${target === 2 ? "Plus" : "Pro"}`,
    supported:
      data.is_demo === true || data.capabilities?.squad_boosts === true,
  };
}
