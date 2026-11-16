import { useConfirmation } from "@/src/shared/Dialogs";
import { BeaconSection, BeaconActionRow } from "./BeaconSection";
import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Chips, Field, Txt, useTheme } from "@/src/shared/ui";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import { PlanningDisclosure } from "@/src/features/planning/PlanningControls";
import { canUseBeaconModules } from "../beaconModules";
import {
  canManageBeacon,
  isApprovedGoing,
  beaconRoleFor,
} from "../permissions";
import { canViewProfile } from "@/src/features/profile/privacy";
import { validateHosting, type HostingSettings } from "../hosting";

export function BeaconHosting({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const [edit, setEdit] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    hosting: HostingSettings;
    revision: number;
  } | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { styles, colors } = useTheme();
  if (
    !userId ||
    !canUseBeaconModules(data, activity, userId) ||
    !(data.is_demo || data.capabilities?.beacon_hosting)
  )
    return null;
  const config = data.premium_tool_configs?.find(
    (c) => c.activity_id === activity.id && c.kind === "hosting",
  );
  const h = config?.settings.hosting;
  const own = data.attendee_details?.find(
    (r) => r.activity_id === activity.id && r.user_id === userId,
  );
  const manager = canManageBeacon(data, activity, userId);
  const canCheckIn = manager || !!h?.coordinators.includes(userId);
  const ids = [
    ...new Set([
      activity.owner_id,
      ...data.rsvps
        .filter(
          (r) => r.activity_id === activity.id && isApprovedGoing(activity, r),
        )
        .map((r) => r.user_id),
    ]),
  ];
  const name = (id: string) => {
    const p = data.profiles.find((p) => p.id === id);
    return id === userId
      ? "You"
      : p && canViewProfile(data, p, userId)
        ? p.name
        : "Beacon participant";
  };
  const rows = (data.attendee_details ?? []).filter(
    (r) => r.activity_id === activity.id && ids.includes(r.user_id),
  );
  const toggleReminders = async (value: boolean) => {
    setBusy(true);
    setError("");
    try {
      await act("set_agenda_reminders", {
        activity_id: activity.id,
        reminders: value,
        revision: own?.revision ?? -1,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save reminder preference.",
      );
    } finally {
      setBusy(false);
    }
  };
  const shown = ids.filter((id) =>
    name(id).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <BeaconSection
      title="Your activity details"
      description="Your answers and reminder preferences"
      testID="beacon-hosting-workspace"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Txt>Activity schedule reminders</Txt>
          <Txt muted>Choose whether to receive stage reminders.</Txt>
        </View>
        <ThemedSwitch
          accessibilityLabel="Activity schedule reminders"
          value={own?.reminders !== false}
          disabled={busy}
          onValueChange={(value) => void toggleReminders(value)}
        />
      </View>
      {confirmationDialog}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {h?.enabled && h.questions.length > 0 && (
        <PlanningDisclosure
          title="Your RSVP details"
          summary={`${h.questions.filter((q) => own?.answers?.[q.id]?.trim()).length} of ${h.questions.length} optional answers completed`}
        >
          <AnswerEditor
            key={`${activity.id}.${userId}.${data.demo_session_id ?? "live"}.${own?.revision ?? -1}`}
            activity={activity}
            questions={h.questions}
          />
        </PlanningDisclosure>
      )}
      {h?.enabled && (manager || canCheckIn) && (
        <BeaconSection
          title="Participant coordination"
          description="Check-in and participant groups"
          surface
        >
          <BeaconActionRow>
            <Txt>{ids.length} participants</Txt>
            {h.check_in && (
              <Txt muted>
                {rows.filter((r) => r.checked_in_at).length} checked in
              </Txt>
            )}
            <Txt muted>{h.groups.length} groups</Txt>
          </BeaconActionRow>
          <Field
            label="Find a participant"
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setLimit(10);
            }}
          />
          {shown.slice(0, limit).map((id) => {
            const row = rows.find((r) => r.user_id === id);
            return (
              <View
                key={`${userId}.${id}.${row?.revision ?? -1}`}
                style={{
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                  paddingTop: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
                    <Text style={[styles.body, { fontWeight: "600" }]}>
                      {name(id)}
                    </Text>
                    <Txt muted>
                      {row?.group_label ?? "No group"}
                      {h.check_in
                        ? ` · ${row?.checked_in_at ? "Checked in" : "Not checked in"}`
                        : ""}
                    </Txt>
                  </View>
                  {canCheckIn && h.check_in && (
                    <Action
                      compact
                      secondary
                      title={`${row?.checked_in_at ? "Undo check-in for" : "Check in"} ${name(id)}`}
                      run={() =>
                        act("save_host_record", {
                          activity_id: activity.id,
                          user_id: id,
                          checked_in: !row?.checked_in_at,
                          revision: row?.revision ?? -1,
                        })
                      }
                    />
                  )}
                </View>
                {manager && (
                  <ParticipantRecord
                    activity={activity}
                    userId={id}
                    name={name(id)}
                    hosting={h}
                    manager={manager}
                    canCheckIn={false}
                  />
                )}
              </View>
            );
          })}
          {!shown.length && <Txt muted>No matching participants.</Txt>}
          {shown.length > limit && (
            <Button
              compact
              secondary
              title="Show more participants"
              onPress={() => setLimit((n) => n + 10)}
            />
          )}
        </BeaconSection>
      )}
      {manager && (
        <PlanningDisclosure
          title="Hosting settings"
          summary="Questions, groups and check-in responsibilities"
        >
          <Button
            compact
            secondary
            title={edit ? "Close hosting settings" : "Configure hosting"}
            onPress={() => {
              if (edit && dirty)
                requestConfirmation({
                  title: "Discard hosting changes?",
                  message: "Your saved hosting settings will stay unchanged.",
                  confirmLabel: "Discard changes",
                  destructive: true,
                  onConfirm: () => {
                    setEdit(false);
                    setDirty(false);
                  },
                });
              else if (edit) setEdit(false);
              else {
                setEditSnapshot({
                  hosting: structuredClone(
                    h ?? {
                      enabled: true,
                      questions: [],
                      groups: [],
                      check_in: false,
                      coordinators: [],
                    },
                  ),
                  revision: config?.revision ?? -1,
                });
                setEdit(true);
              }
            }}
          />
          {edit && (
            <HostingEditor
              onDirty={() => setDirty(true)}
              onDone={() => {
                setEdit(false);
                setDirty(false);
              }}
              key={`${activity.id}.${userId}`}
              activity={activity}
              initial={
                editSnapshot?.hosting ??
                h ?? {
                  enabled: true,
                  questions: [],
                  groups: [],
                  check_in: false,
                  coordinators: [],
                }
              }
              revision={editSnapshot?.revision ?? config?.revision ?? -1}
            />
          )}
        </PlanningDisclosure>
      )}
    </BeaconSection>
  );
}

function AnswerEditor({
  activity,
  questions,
}: {
  activity: Activity;
  questions: HostingSettings["questions"];
}) {
  const { data, userId, act } = useBeacon();
  const own = data.attendee_details?.find(
    (r) => r.activity_id === activity.id && r.user_id === userId,
  );
  const [answers, setAnswers] = useState(own?.answers ?? {});
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>
        Optional answers are visible to you and authorized organizers.
      </Txt>
      {questions.map((q) => (
        <Field
          key={q.id}
          label={q.label}
          value={answers[q.id] ?? ""}
          maxLength={500}
          onChangeText={(v) => setAnswers({ ...answers, [q.id]: v })}
        />
      ))}
      <Action
        title="Save RSVP details"
        feedback="success"
        run={() =>
          act("save_rsvp_answers", {
            activity_id: activity.id,
            answers: Object.fromEntries(
              questions.map((q) => [q.id, answers[q.id] ?? ""]),
            ),
            revision: own?.revision ?? -1,
          })
        }
      />
    </View>
  );
}
function ParticipantRecord({
  activity,
  userId,
  name,
  hosting,
  manager,
  canCheckIn,
}: {
  activity: Activity;
  userId: string;
  name: string;
  hosting: HostingSettings;
  manager: boolean;
  canCheckIn: boolean;
}) {
  const { data, act } = useBeacon();
  const row = data.attendee_details?.find(
    (r) => r.activity_id === activity.id && r.user_id === userId,
  );
  const [note, setNote] = useState(row?.organizer_note ?? "");
  const [group, setGroup] = useState(row?.group_label ?? "No group");
  return (
    <PlanningDisclosure
      title={`Details for ${name}`}
      summary={`${row?.checked_in_at ? "Checked in" : "Not checked in"}${row?.group_label ? ` · ${row.group_label}` : ""}`}
    >
      {manager && (
        <>
          <Txt muted>
            Answers and notes are visible only to authorized organizers.
          </Txt>
          {hosting.questions.map((q) => (
            <Txt key={q.id}>
              {q.label}: {row?.answers?.[q.id] || "No answer"}
            </Txt>
          ))}
          <Field
            label={`Organizer note for ${name}`}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
          />
          <Chips
            options={["No group", ...hosting.groups]}
            value={group}
            onChange={setGroup}
            accessibilityPrefix={`Group for ${name}`}
          />
          <Action
            title={`Save organizer details for ${name}`}
            run={() =>
              act("save_host_record", {
                activity_id: activity.id,
                user_id: userId,
                organizer_note: note,
                group_label: group === "No group" ? null : group,
                revision: row?.revision ?? -1,
              })
            }
          />
        </>
      )}
      {canCheckIn && hosting.check_in && (
        <Action
          secondary
          title={`${row?.checked_in_at ? "Undo check-in for" : "Check in"} ${name}`}
          run={() =>
            act("save_host_record", {
              activity_id: activity.id,
              user_id: userId,
              checked_in: !row?.checked_in_at,
              revision: row?.revision ?? -1,
            })
          }
        />
      )}
    </PlanningDisclosure>
  );
}
function HostingEditor({
  activity,
  initial,
  revision,
  onDone,
  onDirty,
}: {
  onDone(): void;
  onDirty(): void;
  activity: Activity;
  initial: HostingSettings;
  revision: number;
}) {
  const { data, userId, act } = useBeacon();
  const [draft, rawSetDraft] = useState(initial);
  const setDraft: React.Dispatch<React.SetStateAction<HostingSettings>> = (
    next,
  ) => {
    onDirty();
    rawSetDraft(next);
  };
  const [groups, setGroups] = useState(initial.groups.join(", "));
  const plus = resolvePremiumFeature(data, "hosting", activity).available;
  const pro = resolvePremiumFeature(
    data,
    "hosting_coordination",
    activity,
  ).available;
  const delegate = ["owner", "coowner"].includes(
    beaconRoleFor(data, activity, userId!),
  );
  const participants = data.profiles.filter(
    (p) =>
      data.rsvps.some(
        (r) =>
          r.activity_id === activity.id &&
          r.user_id === p.id &&
          isApprovedGoing(activity, r),
      ) && canViewProfile(data, p, userId!),
  );
  return (
    <View style={{ gap: 10 }}>
      {!plus && <PremiumPreview />}
      {!plus && (
        <Txt muted>
          BEACON+ enables custom hosting. Saved details are retained.
        </Txt>
      )}
      <Chips
        options={["Enabled", "Paused"]}
        value={draft.enabled ? "Enabled" : "Paused"}
        onChange={(v) => setDraft({ ...draft, enabled: v === "Enabled" })}
        accessibilityPrefix="Hosting module"
      />
      {draft.questions.map((q) => (
        <View key={q.id} style={{ gap: 4 }}>
          <Field
            label="RSVP question"
            maxLength={160}
            value={q.label}
            onChangeText={(label) =>
              setDraft({
                ...draft,
                questions: draft.questions.map((row) =>
                  row.id === q.id ? { ...row, label } : row,
                ),
              })
            }
          />
          <Button
            secondary
            title={`Remove question ${q.label}`}
            onPress={() =>
              setDraft({
                ...draft,
                questions: draft.questions.filter((row) => row.id !== q.id),
              })
            }
          />
        </View>
      ))}
      {plus && (
        <Button
          secondary
          title="Add RSVP question"
          disabled={draft.questions.length >= 8}
          onPress={() =>
            setDraft({
              ...draft,
              questions: [
                ...draft.questions,
                { id: randomUUID(), label: "What should organizers know?" },
              ],
            })
          }
        />
      )}
      <Field
        label="Participant groups · comma separated"
        value={groups}
        onChangeText={(value) => {
          onDirty();
          setGroups(value);
        }}
        maxLength={740}
      />
      {pro && (
        <Chips
          options={["Check-in off", "Check-in on"]}
          value={draft.check_in ? "Check-in on" : "Check-in off"}
          onChange={(v) =>
            setDraft({ ...draft, check_in: v === "Check-in on" })
          }
        />
      )}
      {pro && delegate && (
        <PlanningDisclosure
          title="Delegate check-in"
          summary="Coordinators can check people in; private notes stay with organizers"
        >
          {participants.map((p) => (
            <Button
              key={p.id}
              secondary
              title={`${draft.coordinators.includes(p.id) ? "Remove coordinator" : "Make coordinator"} ${p.name}`}
              onPress={() =>
                setDraft({
                  ...draft,
                  coordinators: draft.coordinators.includes(p.id)
                    ? draft.coordinators.filter((id) => id !== p.id)
                    : [...draft.coordinators, p.id],
                })
              }
            />
          ))}
        </PlanningDisclosure>
      )}
      {plus && (
        <Action
          title="Save hosting settings"
          run={async () => {
            await act("save_tool_config", {
              activity_id: activity.id,
              kind: "hosting",
              settings: {
                hosting: validateHosting({
                  ...draft,
                  groups: groups
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }),
              },
              revision,
            });
            onDone();
          }}
        />
      )}
      {revision >= 0 && (
        <Action
          secondary
          title="Remove hosting configuration"
          run={() =>
            act("clear_tool_config", {
              activity_id: activity.id,
              kind: "hosting",
              revision,
            })
          }
        />
      )}
    </View>
  );
}
