import React, { useState } from "react";
import { View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Chips, Field, Txt } from "@/src/shared/ui";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import { PlanningDisclosure } from "@/src/features/planning/PlanningControls";
import { canManageBeacon } from "../permissions";

export function RoundScoring({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const config = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "teams",
  );
  const [edit, setEdit] = useState(false);
  const [round, setRound] = useState("");
  if (!(data.is_demo || data.capabilities?.beacon_specialized)) return null;
  const pro = resolvePremiumFeature(data, "score_rounds", activity).available;
  const manager = !!userId && canManageBeacon(data, activity, userId);
  const names = config?.settings.round_names ?? [];
  const history =
    data.round_scores?.filter((r) => r.activity_id === activity.id) ?? [];
  if (!names.length && !history.length && !(pro && manager)) return null;
  const selected = names.includes(round) ? round : names[0];
  return (
    <PlanningDisclosure
      title="Live Activity · Scoring rounds"
      summary={`${names.length} configured rounds`}
    >
      <Txt muted>
        Round scores contribute to the team totals. Totals also include regular
        score adjustments.
      </Txt>
      {!!names.length && (
        <Chips
          options={names}
          value={selected}
          onChange={setRound}
          accessibilityPrefix="Scoring round"
        />
      )}
      {data.beacon_teams
        .filter((t) => t.activity_id === activity.id)
        .map((team) => {
          const r = history.find(
            (r) => r.team_id === team.id && r.round_name === selected,
          );
          return (
            <View key={team.id} style={{ gap: 6 }}>
              <Txt>
                {team.name} · {r?.score ?? 0} this round · {team.score} total
              </Txt>
              {pro && manager && selected && (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {[
                    -1,
                    1,
                    ...(config?.settings.score_steps ?? [])
                      .map((s) => s.points)
                      .filter((n) => n !== 1),
                  ].map((delta) => (
                    <Action
                      key={delta}
                      compact
                      secondary
                      title={`${delta > 0 ? "+" : ""}${delta}`}
                      accessibilityLabel={`${delta > 0 ? "+" : ""}${delta} round points for ${team.name}`}
                      disabled={delta < 0 && !r?.score}
                      run={() =>
                        act("record_round_score", {
                          team_id: team.id,
                          round_name: selected,
                          delta,
                          revision: r?.revision ?? -1,
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      <PlanningDisclosure
        title="Round results"
        summary="Saved breakdown across rounds"
      >
        {history.map((r) => (
          <Txt key={`${r.team_id}.${r.round_name}`}>
            {r.round_name} ·{" "}
            {data.beacon_teams.find((t) => t.id === r.team_id)?.name ?? "Team"}{" "}
            · {r.score}
          </Txt>
        ))}
      </PlanningDisclosure>
      {pro && manager && (
        <Button
          secondary
          title={edit ? "Close round setup" : "Configure scoring rounds"}
          onPress={() => setEdit(!edit)}
        />
      )}
      {pro && manager && edit && (
        <RoundSetup
          onDone={() => setEdit(false)}
          key={`${activity.id}.${config?.revision ?? -1}`}
          activity={activity}
        />
      )}
    </PlanningDisclosure>
  );
}
function RoundSetup({
  activity,
  onDone,
}: {
  activity: Activity;
  onDone(): void;
}) {
  const { data, act } = useBeacon();
  const c = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "teams",
  );
  const [names, setNames] = useState(
    c?.settings.round_names?.join("\n") ?? "Warm-up\nRound one\nFinal",
  );
  return (
    <View style={{ gap: 8 }}>
      <Field
        label="Scoring rounds · one per line"
        multiline
        value={names}
        onChangeText={setNames}
        maxLength={740}
      />
      <Action
        title="Save scoring rounds"
        run={async () => {
          await act("save_tool_config", {
            activity_id: activity.id,
            kind: "teams",
            settings: {
              ...(c?.settings ?? {
                team_names: [],
                score_steps: [{ label: "Point", points: 1 }],
              }),
              round_names: names
                .split("\n")
                .map((n) => n.trim())
                .filter(Boolean),
            },
            revision: c?.revision ?? -1,
          });
          onDone();
        }}
      />
    </View>
  );
}
