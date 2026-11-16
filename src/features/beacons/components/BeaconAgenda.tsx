import {
  BeaconSection,
  BeaconActionRow,
  BeaconDisclosure,
} from "./BeaconSection";
import { useConfirmation } from "@/src/shared/Dialogs";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import {
  activityPremiumPresets,
  activityAgendaPreset,
} from "../activityPremiumPresets";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import type { Activity, BeaconChecklistItem } from "@/src/shared/types";
import { Action, Button, Chips, Field, Txt, useTheme } from "@/src/shared/ui";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import { PlanningDisclosure } from "@/src/features/planning/PlanningControls";
import { useNow } from "@/src/shared/useNow";
import { canManageBeacon, isApprovedGoing } from "../permissions";
import { canUseBeaconModules } from "../beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";
import { useChecklistPages } from "../useChecklistPages";
import {
  agendaTime,
  preparationSummary,
  validateAgenda,
  type AgendaSettings,
  type AgendaStep,
} from "../agenda";

export function BeaconPreparation({
  activity,
  onOpen,
}: {
  activity: Activity;
  onOpen(): void;
}) {
  const { data, userId } = useBeacon();
  const now = useNow();
  const allowed = !!userId && canUseBeaconModules(data, activity, userId);
  const pages = useChecklistPages(
    activity.id,
    allowed && activity.enable_checklist !== false,
  );
  if (!allowed || !(data.is_demo || data.capabilities?.beacon_expansion))
    return null;
  const agenda = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "agenda",
  )?.settings.agenda;
  const summary = preparationSummary(pages.items, now);
  const next = agenda?.enabled
    ? [...agenda.steps]
        .sort((a, b) => a.offset - b.offset)
        .find(
          (s) =>
            s.state !== "done" &&
            (s.state === "active" ||
              agendaTime(activity, s) + s.minutes * 60000 > now),
        )
    : undefined;
  if (
    !agenda?.steps.length &&
    !pages.items.some((i) => i.due_at || i.due_on || i.priority === "high")
  )
    return null;
  return (
    <View style={{ gap: 6 }} testID="beacon-preparation-summary">
      {activity.enable_checklist !== false && (
        <Txt>
          {pages.completed ?? summary.completed}/{pages.total ?? summary.total}{" "}
          preparation tasks done
          {summary.overdue ? ` · ${summary.overdue} overdue shown` : ""}
        </Txt>
      )}
      {next && (
        <Txt muted>
          Next: {next.label} ·{" "}
          {new Date(agendaTime(activity, next)).toLocaleString([], {
            timeZone: activity.timezone,
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Txt>
      )}
      <Button secondary title="Open activity planning" onPress={onOpen} />
    </View>
  );
}
export function BeaconAgenda({ activity }: { activity: Activity }) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    agenda: AgendaSettings;
    revision: number;
  } | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const config = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "agenda",
  );
  if (
    !userId ||
    !canUseBeaconModules(data, activity, userId) ||
    !(data.is_demo || data.capabilities?.beacon_expansion)
  )
    return null;
  const manager = canManageBeacon(data, activity, userId);
  const agenda = config?.settings.agenda;
  const pro = resolvePremiumFeature(
    data,
    "agenda_coordination",
    activity,
  ).available;
  if (!config && !manager) return null;
  const close = () => {
    if (dirty)
      requestConfirmation({
        title: "Discard schedule changes?",
        message: "Your saved activity schedule will stay unchanged.",
        confirmLabel: "Discard changes",
        destructive: true,
        onConfirm: () => {
          setEditing(false);
          setDirty(false);
        },
      });
    else setEditing(false);
  };
  const name = (id: string) => {
    const p = data.profiles.find((p) => p.id === id);
    return p && canViewProfile(data, p, userId) ? p.name : "Organizer";
  };
  return (
    <BeaconSection
      title="Activity schedule"
      description={
        editing
          ? "Edit timing, responsibilities and preparation"
          : "What happens within this Beacon"
      }
      action={
        manager ? (
          <Button
            compact
            secondary
            title={editing ? "Cancel editing" : "Edit schedule"}
            onPress={() => {
              if (editing) close();
              else {
                setEditSnapshot({
                  agenda: structuredClone(
                    agenda ?? { enabled: true, steps: [] },
                  ),
                  revision: config?.revision ?? -1,
                });
                setEditing(true);
              }
            }}
          />
        ) : undefined
      }
      testID="beacon-activity-schedule"
    >
      {confirmationDialog}
      {editing ? (
        <AgendaEditor
          key={`${activity.id}.${userId}`}
          activity={activity}
          initial={
            editSnapshot?.agenda ?? agenda ?? { enabled: true, steps: [] }
          }
          revision={editSnapshot?.revision ?? config?.revision ?? -1}
          onDirty={() => setDirty(true)}
          onDone={() => {
            setDirty(false);
            setEditing(false);
          }}
        />
      ) : (
        <>
          {agenda?.enabled &&
            manager &&
            pro &&
            agenda.steps.some((s) => s.state !== "done") && (
              <View
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: colors.white,
                  gap: 12,
                }}
              >
                <Txt muted>
                  {agenda.steps.some((s) => s.state === "active")
                    ? "In progress"
                    : "Up next"}
                </Txt>
                <AgendaLiveAction activity={activity} />
              </View>
            )}
          {agenda?.enabled && (
            <View>
              {[...agenda.steps]
                .sort((a, b) => a.offset - b.offset)
                .map((s) => (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: "row",
                      gap: 16,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.line,
                      opacity: s.state === "done" ? 0.65 : 1,
                    }}
                  >
                    <View style={{ width: 72, gap: 4 }}>
                      <Text
                        style={[
                          styles.body,
                          {
                            fontWeight: s.state === "active" ? "600" : "400",
                            fontVariant: ["tabular-nums"],
                          },
                        ]}
                      >
                        {new Date(agendaTime(activity, s)).toLocaleTimeString(
                          [],
                          {
                            timeZone: activity.timezone,
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </Text>
                      <Txt muted>{s.minutes} min</Txt>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={[styles.body, { fontWeight: "600" }]}>
                        {s.label}
                      </Text>
                      <BeaconActionRow>
                        {s.organizer && <Txt muted>{name(s.organizer)}</Txt>}
                        {s.tasks.length > 0 && (
                          <Txt muted>
                            {s.tasks.length} linked preparation tasks
                          </Txt>
                        )}
                      </BeaconActionRow>
                      <Txt muted>
                        {s.state === "done"
                          ? "✓ Done"
                          : s.state === "active"
                            ? "● In progress"
                            : "Upcoming"}
                      </Txt>
                    </View>
                  </View>
                ))}
            </View>
          )}
          {!agenda?.steps.length && (
            <View style={{ paddingVertical: 16, gap: 8 }}>
              <Txt>No activity schedule yet</Txt>
              <Txt muted>
                Add a few stages or start with a preset. Plans connect multiple
                Beacons; this schedule organizes one.
              </Txt>
            </View>
          )}
          {agenda && !agenda.enabled && (
            <Txt muted>Schedule paused. Saved stages are retained.</Txt>
          )}
          {manager && pro && <PreparationDashboard activity={activity} />}
        </>
      )}
    </BeaconSection>
  );
}
function AgendaEditor({
  activity,
  initial,
  revision,
  onDone,
  onDirty,
}: {
  onDone(): void;
  onDirty(): void;
  activity: Activity;
  initial: AgendaSettings;
  revision: number;
}) {
  const { data, userId, act } = useBeacon();
  const [draft, rawSetDraft] = useState(initial);
  const setDraft: React.Dispatch<React.SetStateAction<AgendaSettings>> = (
    next,
  ) => {
    onDirty();
    rawSetDraft(next);
  };
  const [focusedStep, setFocusedStep] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [timing, setTiming] = useState<
    Record<string, { offset: string; minutes: string; reminder: string }>
  >({});
  const timingFor = (s: AgendaStep) =>
    timing[s.id] ?? {
      offset: String(s.offset),
      minutes: String(s.minutes),
      reminder: s.reminder === null ? "" : String(s.reminder),
    };
  const changeTiming = (
    s: AgendaStep,
    field: "offset" | "minutes" | "reminder",
    value: string,
  ) => {
    onDirty();
    setTiming((t) => ({ ...t, [s.id]: { ...timingFor(s), [field]: value } }));
  };
  const [directions, setDirections] = useState<
    Record<string, "Before start" | "At start" | "After start">
  >({});
  const directionFor = (s: AgendaStep) =>
    directions[s.id] ??
    (s.offset < 0 ? "Before start" : s.offset > 0 ? "After start" : "At start");
  const readDraft = () =>
    validateAgenda({
      ...draft,
      steps: draft.steps
        .map((s) => ({
          ...s,
          offset: Number(timingFor(s).offset),
          minutes: Number(timingFor(s).minutes),
          reminder:
            timingFor(s).reminder === "" ? null : Number(timingFor(s).reminder),
        }))
        .sort((a, b) => a.offset - b.offset),
    });
  const [presetName, setPresetName] = useState("");
  const pages = useChecklistPages(
    activity.id,
    activity.enable_checklist !== false,
  );
  const plus = resolvePremiumFeature(data, "agendas", activity).available;
  const pro = resolvePremiumFeature(
    data,
    "agenda_coordination",
    activity,
  ).available;
  const personal = resolvePremiumFeature(
    data,
    "agendas",
    undefined,
    true,
  ).available;
  const update = (id: string, patch: Partial<AgendaStep>) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  const organizers = data.profiles.filter(
    (p) =>
      (p.id === activity.owner_id ||
        (data.beacon_roles.some(
          (r) =>
            r.activity_id === activity.id &&
            r.user_id === p.id &&
            ["coowner", "admin"].includes(r.role),
        ) &&
          data.rsvps.some(
            (r) =>
              r.activity_id === activity.id &&
              r.user_id === p.id &&
              isApprovedGoing(activity, r),
          ))) &&
      (p.id === userId || canViewProfile(data, p, userId!)),
  );
  const presets =
    data.premium_presets?.filter(
      (p) => p.kind === "agenda" && p.owner_id === userId,
    ) ?? [];
  return (
    <View style={{ gap: 10 }}>
      {confirmationDialog}
      {!plus && <PremiumPreview />}
      {!plus && (
        <Txt muted>
          BEACON+ enables new agendas. Saved items remain readable; you can
          remove the configuration.
        </Txt>
      )}
      <PlanningDisclosure
        title="Schedule presets"
        summary="Study, Sports, Party, Outdoor and Errands"
      >
        {activityPremiumPresets.map((p) => (
          <Button
            key={p.title}
            secondary
            title={`Use ${p.title} schedule`}
            onPress={() => {
              const apply = () => {
                setTiming({});
                setDirections({});
                setDraft(activityAgendaPreset(p.title));
              };
              if (draft.steps.length)
                requestConfirmation({
                  title: "Replace schedule draft?",
                  message:
                    "The preset will replace the stages in this draft. Your saved schedule stays unchanged until you save.",
                  confirmLabel: "Use preset",
                  onConfirm: apply,
                });
              else apply();
            }}
          />
        ))}
      </PlanningDisclosure>
      <Chips
        options={["Enabled", "Paused"]}
        value={draft.enabled ? "Enabled" : "Paused"}
        onChange={(v) => setDraft({ ...draft, enabled: v === "Enabled" })}
        accessibilityPrefix="Agenda module"
      />
      {draft.steps.map((s, index) => (
        <BeaconDisclosure
          key={s.id}
          open={focusedStep === s.id}
          onToggle={() => setFocusedStep(focusedStep === s.id ? null : s.id)}
          title={`${index + 1}. ${s.label}`}
          description={`${s.offset === 0 ? "At start" : `${Math.abs(s.offset)} min ${s.offset < 0 ? "before" : "after"} start`} · ${s.minutes} min`}
        >
          <Field
            label="Stage title"
            value={s.label}
            onChangeText={(label) => update(s.id, { label })}
            maxLength={100}
          />
          <Txt muted>When should this happen?</Txt>
          <Chips
            accessibilityPrefix="Agenda timing"
            options={["Before start", "At start", "After start"] as const}
            value={directionFor(s)}
            onChange={(v) => {
              setDirections((d) => ({ ...d, [s.id]: v }));
              changeTiming(
                s,
                "offset",
                v === "At start"
                  ? "0"
                  : String(
                      (v === "Before start" ? -1 : 1) *
                        (Math.abs(Number(timingFor(s).offset)) || 15),
                    ),
              );
            }}
          />
          {directionFor(s) !== "At start" && (
            <Field
              label="Minutes before or after start"
              value={timingFor(s).offset.replace(/^-/, "")}
              onChangeText={(v) =>
                changeTiming(
                  s,
                  "offset",
                  (directionFor(s) === "Before start" ? "-" : "") +
                    v.replace(/[^0-9]/g, ""),
                )
              }
              keyboardType="number-pad"
            />
          )}
          <Field
            label="Agenda duration in minutes"
            value={timingFor(s).minutes}
            onChangeText={(v) => changeTiming(s, "minutes", v)}
            keyboardType="number-pad"
          />
          <Field
            label="Reminder minutes before item · optional"
            value={timingFor(s).reminder}
            onChangeText={(v) => changeTiming(s, "reminder", v)}
            keyboardType="number-pad"
          />
          {pro && (
            <>
              <Txt muted>Segment organizer</Txt>
              <Button
                secondary
                title="No segment organizer"
                onPress={() => update(s.id, { organizer: null })}
              />
              {organizers.map((p) => (
                <Button
                  key={p.id}
                  secondary
                  title={`${p.id === s.organizer ? "Assigned: " : "Assign "}${p.name}`}
                  onPress={() => update(s.id, { organizer: p.id })}
                />
              ))}
              <Chips
                options={["Upcoming", "In progress", "Done"] as const}
                value={
                  s.state === "active"
                    ? "In progress"
                    : s.state === "done"
                      ? "Done"
                      : "Upcoming"
                }
                accessibilityPrefix="Agenda progress"
                onChange={(label) => {
                  const state =
                    label === "In progress"
                      ? "active"
                      : label === "Done"
                        ? "done"
                        : "planned";
                  setDraft((d) => ({
                    ...d,
                    steps: d.steps.map((row) =>
                      row.id === s.id
                        ? { ...row, state }
                        : state === "active" && row.state === "active"
                          ? { ...row, state: "planned" }
                          : row,
                    ),
                  }));
                }}
              />
              <PlanningDisclosure
                title="Linked preparation tasks"
                summary={`${s.tasks.length} selected`}
              >
                <ChecklistLinks
                  items={pages.items}
                  selected={s.tasks}
                  onChange={(tasks) => update(s.id, { tasks })}
                />
                {pages.more && (
                  <Button
                    secondary
                    title="Load more agenda tasks"
                    onPress={pages.loadMore}
                  />
                )}
                {!!pages.error && <Txt muted>{pages.error}</Txt>}
              </PlanningDisclosure>
            </>
          )}
          <Button
            secondary
            title="Remove agenda item"
            onPress={() =>
              setDraft({
                ...draft,
                steps: draft.steps.filter((row) => row.id !== s.id),
              })
            }
          />
        </BeaconDisclosure>
      ))}
      {plus && (
        <PlanningDisclosure
          title="Activity start & end reminders"
          summary="Add optional reminders at the Beacon timing boundaries"
        >
          {[
            { label: "Activity begins", offset: 0 },
            {
              label: "Activity ends",
              offset: Math.round(
                (Date.parse(activity.ends_at) -
                  Date.parse(activity.starts_at)) /
                  60000,
              ),
            },
          ].map((p) => (
            <Button
              key={p.label}
              secondary
              title={`Add ${p.label.toLowerCase()} reminder`}
              disabled={draft.steps.length >= 40}
              onPress={() =>
                setDraft({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    {
                      id: randomUUID(),
                      label: p.label,
                      offset: p.offset,
                      minutes: 1,
                      reminder: 15,
                      organizer: null,
                      tasks: [],
                      state: "planned",
                    },
                  ],
                })
              }
            />
          ))}
        </PlanningDisclosure>
      )}
      {plus && (
        <Button
          secondary
          title="Add stage"
          onPress={() =>
            setDraft({
              ...draft,
              steps: [
                ...draft.steps,
                {
                  id: randomUUID(),
                  label: "New agenda item",
                  offset: 0,
                  minutes: 30,
                  reminder: null,
                  organizer: null,
                  tasks: [],
                  state: "planned",
                },
              ],
            })
          }
          disabled={draft.steps.length >= 40}
        />
      )}
      {plus && (
        <Action
          title="Save schedule"
          feedback="success"
          run={async () => {
            await act("save_tool_config", {
              activity_id: activity.id,
              kind: "agenda",
              settings: { agenda: readDraft() },
              revision,
            });
            onDone();
          }}
        />
      )}
      {personal && (
        <PlanningDisclosure
          title="Reusable agenda presets"
          summary="Save timing without people, tasks or live progress"
        >
          <Field
            label="Agenda preset name"
            value={presetName}
            onChangeText={setPresetName}
            maxLength={100}
          />
          <Action
            title="Save agenda preset"
            disabled={!presetName.trim()}
            run={() =>
              act("save_tool_preset", {
                id: randomUUID(),
                kind: "agenda",
                title: presetName,
                settings: {
                  agenda: {
                    ...readDraft(),
                    steps: readDraft().steps.map((s) => ({
                      ...s,
                      organizer: null,
                      tasks: [],
                      state: "planned",
                    })),
                  },
                },
              })
            }
          />
          {presets.map((p) => (
            <View key={p.id} style={{ gap: 4 }}>
              <Button
                secondary
                title={`Use ${p.title}`}
                onPress={() => {
                  setTiming({});
                  setDirections({});
                  setDraft(structuredClone(p.settings.agenda!));
                }}
              />
              <Action
                secondary
                title={`Delete preset ${p.title}`}
                run={() => act("delete_tool_preset", { id: p.id })}
              />
            </View>
          ))}
        </PlanningDisclosure>
      )}
      {revision >= 0 && (
        <Action
          secondary
          title="Remove agenda configuration"
          run={() =>
            act("clear_tool_config", {
              activity_id: activity.id,
              kind: "agenda",
              revision,
            })
          }
        />
      )}
    </View>
  );
}

function AgendaLiveAction({ activity }: { activity: Activity }) {
  const { data, act } = useBeacon();
  const c = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "agenda",
  );
  const agenda = c!.settings.agenda!;
  const active = agenda.steps.find((s) => s.state === "active");
  const target = active ?? agenda.steps.find((s) => s.state === "planned");
  if (!target) return null;
  return (
    <Action
      title={`${active ? "Complete" : "Start"} stage: ${target.label}`}
      run={() =>
        act("save_tool_config", {
          activity_id: activity.id,
          kind: "agenda",
          settings: {
            agenda: {
              ...agenda,
              steps: agenda.steps.map((s) =>
                s.id === target.id
                  ? { ...s, state: active ? "done" : "active" }
                  : s,
              ),
            },
          },
          revision: c!.revision,
        })
      }
    />
  );
}
function PreparationDashboard({ activity }: { activity: Activity }) {
  const { data, userId } = useBeacon();
  const pages = useChecklistPages(
    activity.id,
    activity.enable_checklist !== false,
  );
  const names = [
    ...new Set(
      pages.items
        .filter((t) => !t.completed && t.assignee_id)
        .map((t) => t.assignee_id!),
    ),
  ];
  return (
    <PlanningDisclosure
      title="Organizer preparation dashboard"
      summary={`${pages.items.filter((t) => !t.completed).length} open tasks shown`}
    >
      <Txt muted>
        {pages.items.filter((t) => !t.completed && !t.assignee_id).length}{" "}
        unassigned ·{" "}
        {
          pages.items.filter((t) => !t.completed && t.priority === "high")
            .length
        }{" "}
        high priority
      </Txt>
      {names.map((id) => {
        const p = data.profiles.find((p) => p.id === id);
        return (
          <Txt key={id}>
            {p && canViewProfile(data, p, userId!) ? p.name : "Participant"} ·{" "}
            {
              pages.items.filter((t) => t.assignee_id === id && !t.completed)
                .length
            }{" "}
            open tasks
          </Txt>
        );
      })}
      {pages.more && (
        <Button
          secondary
          title="Show more preparation tasks"
          onPress={pages.loadMore}
        />
      )}
      {!!pages.error && <Txt muted>{pages.error}</Txt>}
    </PlanningDisclosure>
  );
}

function ChecklistLinks({
  items,
  selected,
  onChange,
}: {
  items: BeaconChecklistItem[];
  selected: string[];
  onChange(ids: string[]): void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const choices = items.filter((t) =>
    t.text.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <View style={{ gap: 6 }}>
      <Field
        label="Find a preparation task"
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setLimit(8);
        }}
      />
      {choices.slice(0, limit).map((t) => (
        <Button
          key={t.id}
          secondary
          title={`${selected.includes(t.id) ? "Selected: " : "Link "}${t.text}`}
          disabled={!selected.includes(t.id) && selected.length >= 20}
          onPress={() =>
            onChange(
              selected.includes(t.id)
                ? selected.filter((id) => id !== t.id)
                : [...selected, t.id],
            )
          }
        />
      ))}
      {choices.length > limit && (
        <Button
          secondary
          title="Show more matching tasks"
          onPress={() => setLimit((n) => n + 8)}
        />
      )}
      {!choices.length && (
        <Txt muted>No matching tasks. Add preparation items in Checklist.</Txt>
      )}
    </View>
  );
}
