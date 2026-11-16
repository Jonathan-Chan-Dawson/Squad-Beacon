import type { Data, Payload } from "@/src/shared/types";
import { requirePremiumFeature } from "@/src/shared/entitlements";
import { canManageBeacon } from "./permissions";

export function demoRoundScore(
  data: Data,
  action: string,
  p: Payload,
  viewer: string,
) {
  if (action !== "record_round_score") return false;
  const team = data.beacon_teams.find((t) => t.id === p.team_id);
  const a = data.activities.find((a) => a.id === team?.activity_id);
  if (!team || !a || !a.enable_scoreboard || !canManageBeacon(data, a, viewer))
    throw new Error("Only current organizers can score rounds.");
  requirePremiumFeature(data, "score_rounds", a);
  const settings = data.premium_tool_configs?.find(
    (c) => c.activity_id === a.id && c.kind === "teams",
  )?.settings;
  if (!settings?.round_names?.includes(String(p.round_name)))
    throw new Error("Choose a configured round.");
  const delta = Number(p.delta);
  if (
    typeof p.delta !== "number" ||
    !Number.isInteger(delta) ||
    ![-1, 1, ...(settings.score_steps ?? []).map((s) => s.points)].includes(
      delta,
    )
  )
    throw new Error("Choose a configured score increment.");
  const old = data.round_scores?.find(
    (r) => r.team_id === team.id && r.round_name === p.round_name,
  );
  if ((old?.revision ?? -1) !== p.revision)
    throw new Error("This round score changed. Refresh it.");
  if (
    team.score + delta < 0 ||
    team.score + delta > 9999 ||
    (old?.score ?? 0) + delta < 0
  )
    throw new Error("Score would be outside its limits.");
  team.score += delta;
  data.round_scores = [
    ...(data.round_scores ?? []).filter(
      (r) => r.team_id !== team.id || r.round_name !== p.round_name,
    ),
    {
      activity_id: a.id,
      team_id: team.id,
      round_name: String(p.round_name),
      score: (old?.score ?? 0) + delta,
      revision: (old?.revision ?? -1) + 1,
    },
  ];
  return true;
}
