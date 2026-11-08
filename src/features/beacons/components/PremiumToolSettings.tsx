import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import {
  Timer,
  Layers3,
  Play,
  Palette,
  Trophy,
  ListChecks,
} from "lucide-react-native";
import { isBeaconModuleEnabled, canManageBeacon } from "../permissions";
import React, { useState } from "react";
import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Chips, Field, Txt } from "@/src/shared/ui";
import {
  resolvePremiumFeature,
  resolveBeaconEntitlements,
} from "@/src/shared/entitlements";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import {
  toolFeature,
  validateToolSettings,
  type ToolKind,
  type ToolSettings,
} from "../premiumTools";
const defaults: Record<
  Exclude<ToolKind, "memories" | "journal">,
  ToolSettings
> = {
  focus: {
    steps: [
      { label: "Focus", minutes: 25 },
      { label: "Break", minutes: 5 },
    ],
  },
  appearance: { style: "standard", layout: "standard", module_order: [] },
  teams: {
    team_names: ["Team One", "Team Two"],
    score_steps: [{ label: "Point", points: 1 }],
  },
  council: { groups: [], explanations: false, readiness: false },
};
export function PremiumToolSettings({
  activity,
  threadId,
  kind,
  onStart,
}: {
  activity: Activity;
  threadId?: string;
  kind: Exclude<ToolKind, "memories" | "journal">;
  onStart?: (settings: ToolSettings) => void;
}) {
  const { data, userId } = useBeacon();
  const [open, setOpen] = useState(false);
  if (!userId || !(data.is_demo || data.capabilities?.advanced_beacon_tools))
    return null;
  const config = data.premium_tool_configs?.find(
    (t) =>
      t.kind === kind &&
      (threadId ? t.thread_id === threadId : t.activity_id === activity.id),
  );
  const thread = data.planning_threads.find((t) => t.id === threadId);
  const manager = thread
    ? thread.owner_id === userId || thread.coowner_ids.includes(userId)
    : canManageBeacon(data, activity, userId);
  const entitlement = resolveBeaconEntitlements(data, activity);
  const section = {
    focus: {
      title: "Focus sequences",
      detail: "Set up work and break intervals",
      icon: Timer,
    },
    appearance: {
      title: "Appearance & layout",
      detail: "Choose a style and arrange your tools",
      icon: Palette,
    },
    teams: {
      title: "Team & scoring presets",
      detail: "Set up teams and scoring rules",
      icon: Trophy,
    },
    council: {
      title: "Council setups",
      detail: "Group options and prepare a decision",
      icon: ListChecks,
    },
  }[kind];
  return (
    <View style={{ gap: 8, alignSelf: "stretch" }}>
      {kind === "focus" && config?.settings.steps && onStart && (
        <PlanChoice
          title={`Start ${config.settings.group || "saved focus sequence"}`}
          detail={`${config.settings.steps.length} intervals · ${config.settings.steps.reduce((total, step) => total + step.minutes, 0)} min`}
          icon={Play}
          onPress={() => onStart(config.settings)}
        />
      )}
      {manager && (
        <PlanChoice
          {...section}
          expanded={open}
          onPress={() => setOpen(!open)}
        />
      )}
      {open && (
        <>
          <Txt muted>
            {entitlement.source === "squad" || entitlement.source === "grace"
              ? `Unlocked by ${data.squads.find((s) => s.id === activity.audience_id)?.name ?? "your Squad"}${entitlement.grace_until ? " · grace period" : ""}`
              : "Advanced settings"}
          </Txt>
          <Editor
            key={`${activity.id}:${kind}`}
            activity={activity}
            threadId={threadId}
            kind={kind}
            initial={config?.settings ?? defaults[kind]}
            revision={config?.revision ?? -1}
            close={() => setOpen(false)}
          />
        </>
      )}
    </View>
  );
}
function Editor({
  activity,
  threadId,
  kind,
  initial,
  revision,
  close,
}: {
  activity: Activity;
  threadId?: string;
  kind: Exclude<ToolKind, "memories" | "journal">;
  initial: ToolSettings;
  revision: number;
  close: () => void;
}) {
  const { data, act, userId } = useBeacon();
  const [s, set] = useState<ToolSettings>(initial),
    [expectedRevision] = useState(revision),
    [presetName, setPresetName] = useState(""),
    [query, setQuery] = useState("");
  const [lines, setLines] = useState(
    kind === "focus"
      ? (initial.steps?.map((p) => `${p.label}: ${p.minutes}`).join("\n") ?? "")
      : kind === "teams"
        ? (initial.score_steps
            ?.map((p) => `${p.label}: ${p.points}`)
            .join("\n") ?? "")
        : "",
  );
  const [intervals, setIntervals] = useState(
    (initial.steps ?? []).map((p) => ({
      label: p.label,
      minutes: String(p.minutes),
    })),
  );
  const [intervalEdit, setIntervalEdit] = useState<number | null>(null);
  const enabledTools = (
    [
      { id: "checklist", label: "Checklist" },
      { id: "journal", label: "Sketchboard" },
      { id: "focus", label: "Focus Timer" },
      { id: "scoreboard", label: "Teams & score" },
      { id: "music", label: "Music" },
    ] as const
  ).filter((t) => isBeaconModuleEnabled(activity, t.id));
  const decision = resolvePremiumFeature(data, toolFeature(kind, s), activity);
  const pro = resolveBeaconEntitlements(data, activity).tier === "pro";
  const presets = (data.premium_presets ?? []).filter(
    (p) =>
      p.owner_id === userId &&
      p.kind === kind &&
      p.title.toLowerCase().includes(query.toLowerCase()),
  );
  const settings = () => {
    const values = lines
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        const split = l.lastIndexOf(":");
        return {
          label: l.slice(0, split).trim(),
          amount: Number(l.slice(split + 1).trim()),
        };
      });
    return validateToolSettings(
      kind,
      kind === "focus"
        ? {
            ...s,
            steps: intervals.map((v) => ({
              label: v.label.trim(),
              minutes: Number(v.minutes),
            })),
          }
        : kind === "teams"
          ? {
              ...s,
              score_steps: values.map((v) => ({
                label: v.label,
                points: v.amount,
              })),
            }
          : s,
    );
  };
  return (
    <View style={{ gap: 10 }}>
      {!decision.available && <PremiumPreview />}
      {decision.available && (
        <>
          {kind === "focus" && (
            <>
              {intervals.map((p, i) => (
                <View key={i} style={{ gap: 6 }}>
                  <PlanChoice
                    title={`${i + 1}. ${p.label || "New interval"}`}
                    detail={`${p.minutes || "—"} minutes`}
                    icon={Timer}
                    onPress={() =>
                      setIntervalEdit(intervalEdit === i ? null : i)
                    }
                  />
                  {intervalEdit === i && (
                    <>
                      <Field
                        label="Interval name"
                        value={p.label}
                        maxLength={36}
                        onChangeText={(label) =>
                          setIntervals((rows) =>
                            rows.map((r, n) => (n === i ? { ...r, label } : r)),
                          )
                        }
                      />
                      <Field
                        label="Interval minutes"
                        value={p.minutes}
                        keyboardType="number-pad"
                        onChangeText={(minutes) =>
                          setIntervals((rows) =>
                            rows.map((r, n) =>
                              n === i ? { ...r, minutes } : r,
                            ),
                          )
                        }
                      />
                      <Button
                        compact
                        secondary
                        title="Remove interval"
                        onPress={() => {
                          setIntervals((rows) =>
                            rows.filter((_, n) => n !== i),
                          );
                          setIntervalEdit(null);
                        }}
                      />
                    </>
                  )}
                </View>
              ))}
              {intervals.length < 12 && (
                <Button
                  compact
                  secondary
                  title="Add interval"
                  onPress={() => {
                    setIntervals((rows) => [
                      ...rows,
                      { label: "", minutes: "5" },
                    ]);
                    setIntervalEdit(intervals.length);
                  }}
                />
              )}
              {pro && (
                <>
                  <Field
                    label="Session group · optional"
                    value={s.group ?? ""}
                    onChangeText={(group) => set({ ...s, group })}
                  />
                  <Chips
                    options={["No summary", "Keep private summary"]}
                    value={s.summary ? "Keep private summary" : "No summary"}
                    onChange={(v) =>
                      set({ ...s, summary: v === "Keep private summary" })
                    }
                  />
                </>
              )}
            </>
          )}
          {kind === "appearance" && (
            <>
              <Chips
                options={["standard", "sunrise", "ocean"]}
                value={s.style ?? "standard"}
                onChange={(style) =>
                  set({ ...s, style: style as ToolSettings["style"] })
                }
              />
              {pro && (
                <>
                  <Chips
                    options={["standard", "preparation", "session"]}
                    value={s.layout ?? "standard"}
                    onChange={(layout) =>
                      set({ ...s, layout: layout as ToolSettings["layout"] })
                    }
                  />
                  <Txt muted>
                    Tool order ·{" "}
                    {(s.module_order?.length
                      ? s.module_order
                      : enabledTools.map((t) => t.id)
                    )
                      .map((id) => enabledTools.find((t) => t.id === id)?.label)
                      .filter(Boolean)
                      .join(" → ")}
                  </Txt>
                  <Chips
                    accessibilityPrefix="Lead with"
                    options={enabledTools.map((t) => t.label)}
                    value={
                      enabledTools.find((t) => t.id === s.module_order?.[0])
                        ?.label ?? ""
                    }
                    onChange={(label) => {
                      const id = enabledTools.find(
                        (t) => t.label === label,
                      )?.id;
                      if (id)
                        set({
                          ...s,
                          module_order: [
                            id,
                            ...(s.module_order?.length
                              ? s.module_order
                              : enabledTools.map((t) => t.id)
                            ).filter((k) => k !== id),
                          ],
                        });
                    }}
                  />
                </>
              )}
            </>
          )}
          {kind === "teams" && (
            <>
              <Field
                label="Team names · one per line"
                multiline
                value={s.team_names?.join("\n") ?? ""}
                onChangeText={(v) =>
                  set({
                    ...s,
                    team_names: v
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Field
                label="Scoring · one Label: points per line"
                multiline
                value={lines}
                onChangeText={setLines}
              />
              {pro && (
                <Chips
                  options={["Single session", "Plan rotation"]}
                  value={s.rotation ? "Plan rotation" : "Single session"}
                  onChange={(v) =>
                    set({ ...s, rotation: v === "Plan rotation" })
                  }
                />
              )}
            </>
          )}
          {kind === "council" && (
            <>
              <Field
                label="Option groups · one per line"
                multiline
                value={s.groups?.join("\n") ?? ""}
                onChangeText={(v) =>
                  set({
                    ...s,
                    groups: v
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Chips
                options={["Standard responses", "Optional explanations"]}
                value={
                  s.explanations
                    ? "Optional explanations"
                    : "Standard responses"
                }
                onChange={(v) =>
                  set({ ...s, explanations: v === "Optional explanations" })
                }
              />
              {pro && (
                <Chips
                  options={["Standard preparation", "Readiness checks"]}
                  value={
                    s.readiness ? "Readiness checks" : "Standard preparation"
                  }
                  onChange={(v) =>
                    set({ ...s, readiness: v === "Readiness checks" })
                  }
                />
              )}
            </>
          )}
          <Action
            title="Save settings"
            run={async () => {
              await act("save_tool_config", {
                activity_id: threadId ? undefined : activity.id,
                thread_id: threadId,
                kind,
                settings: settings(),
                revision: expectedRevision,
              });
              close();
            }}
          />
          <Field
            label="Preset name · optional"
            value={presetName}
            onChangeText={setPresetName}
          />
          {presetName.trim() && (
            <Action
              secondary
              title="Save personal preset"
              run={async () => {
                await act("save_tool_preset", {
                  id: randomUUID(),
                  kind,
                  title: presetName.trim(),
                  settings: settings(),
                });
                setPresetName("");
              }}
            />
          )}
          {presets.length > 0 && (
            <>
              <Field
                label="Find a saved preset"
                value={query}
                onChangeText={setQuery}
              />
              {presets.slice(0, 8).map((p) => (
                <PlanChoice
                  key={p.id}
                  icon={Layers3}
                  detail={
                    p.settings.group
                      ? `${p.settings.group} · saved ${kind} setup`
                      : `Saved ${kind} setup`
                  }
                  title={p.title}
                  onPress={() => {
                    set(p.settings);
                    if (kind === "focus")
                      setIntervals(
                        (p.settings.steps ?? []).map((v) => ({
                          label: v.label,
                          minutes: String(v.minutes),
                        })),
                      );
                    if (kind === "focus")
                      setLines(
                        p.settings.steps
                          ?.map((v) => `${v.label}: ${v.minutes}`)
                          .join("\n") ?? "",
                      );
                    if (kind === "teams")
                      setLines(
                        p.settings.score_steps
                          ?.map((v) => `${v.label}: ${v.points}`)
                          .join("\n") ?? "",
                      );
                  }}
                />
              ))}
            </>
          )}
        </>
      )}
      {revision >= 0 && (
        <Action
          secondary
          title="Reset to standard"
          run={async () => {
            await act("clear_tool_config", {
              activity_id: threadId ? undefined : activity.id,
              thread_id: threadId,
              kind,
              revision: expectedRevision,
            });
            close();
          }}
        />
      )}
    </View>
  );
}
