import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import {
  beaconControlValuesFromActivity,
  DECORATION_ACCENTS,
  DECORATION_EMOJIS,
  defaultBeaconControlValues,
  validateBeaconControlValues,
  type BeaconControlValues,
} from "@/src/features/beacons/controls";
import { Action, Button, Chips, Field, Txt, useTheme } from "@/src/shared/ui";

type Props = {
  activity?: Activity;
  value?: BeaconControlValues;
  onChange?: (value: BeaconControlValues) => void;
  onSave?: (value: BeaconControlValues) => Promise<unknown>;
  description?: string;
  templateMode?: boolean;
};

type ModuleGroupId = "social" | "tools" | "media";
type ModuleToggle = {
  label: string;
  field: string;
  explanation: string;
};

const moduleGroups: {
  id: ModuleGroupId;
  title: string;
  toggles: ModuleToggle[];
}[] = [
  {
    id: "social",
    title: "Social",
    toggles: [
      {
        label: "Chat",
        field: "enable_chat",
        explanation: "One conversation for people going to this Beacon.",
      },
      {
        label: "Beacon Memories",
        field: "enable_experiences",
        explanation: "Keep photos and short videos linked to the activity.",
      },
      {
        label: "Comments",
        field: "enable_comments",
        explanation: "Keep quick questions and replies in the Overview.",
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    toggles: [
      {
        label: "Checklist",
        field: "enable_checklist",
        explanation: "Shared sections and tasks for this Beacon.",
      },
      {
        label: "Beacon Note",
        field: "enable_journal",
        explanation: "Write a private note or intentionally share it.",
      },
      {
        label: "Timer",
        field: "enable_focus",
        explanation: "Use a standard timer or a Pomodoro session.",
      },
      {
        label: "Teams / Scoreboard",
        field: "enable_scoreboard",
        explanation: "Split into teams and keep a simple score.",
      },
    ],
  },
  {
    id: "media",
    title: "Media",
    toggles: [
      {
        label: "Music link",
        field: "enable_music",
        explanation: "Share an optional link; Squad Beacon does not play audio.",
      },
    ],
  },
];

function controlRecord(value: BeaconControlValues) {
  return value as unknown as Record<string, unknown>;
}

export function BeaconSettings({
  activity,
  value,
  onChange,
  onSave,
  description,
  templateMode = false,
}: Props) {
  const { styles, colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<ModuleGroupId, boolean>>({
    social: false,
    tools: false,
    media: false,
  });
  const [localValue, setLocalValue] = useState(() =>
    value ??
    (activity
      ? beaconControlValuesFromActivity(activity)
      : defaultBeaconControlValues()),
  );
  const [capacityText, setCapacityText] = useState(() =>
    (
      value ??
      (activity
        ? beaconControlValuesFromActivity(activity)
        : defaultBeaconControlValues())
    ).capacity_limit?.toString() ?? "",
  );
  const current = value ?? localValue;
  const fields = controlRecord(current);
  const change = (patch: Partial<BeaconControlValues>) => {
    const next = { ...current, ...patch };
    if (onChange) onChange(next);
    else setLocalValue(next);
  };
  const save = async () => {
    if (!onSave) return;
    await onSave(validateBeaconControlValues({ ...current }));
  };
  const toggle = (field: string, selected: string) =>
    change({ [field]: selected === "On" } as Partial<BeaconControlValues>);
  const renderToggle = ({ label, field, explanation }: ModuleToggle) => (
    <View key={field} style={{ gap: 5, paddingVertical: 7 }}>
      <Text style={styles.body}>{label}</Text>
      <Txt muted>{explanation}</Txt>
      <Chips
        accessibilityPrefix={label}
        options={["On", "Off"]}
        value={fields[field] === false ? "Off" : "On"}
        onChange={(choice) => toggle(field, choice)}
      />
    </View>
  );
  const renderGroup = (group: (typeof moduleGroups)[number]) => {
    const open = openGroups[group.id];
    return (
      <View
        key={group.id}
        style={[
          styles.card,
          { padding: 12, borderColor: colors.line, gap: open ? 6 : 0 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${open ? "Collapse" : "Expand"} ${group.title} options`}
          accessibilityState={{ expanded: open }}
          onPress={() =>
            setOpenGroups((currentGroups) => ({
              ...currentGroups,
              [group.id]: !currentGroups[group.id],
            }))
          }
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={[styles.body, { flex: 1, fontWeight: "700" }]}>
            {group.title}
          </Text>
          <Text style={styles.muted}>{group.toggles.length} options</Text>
          {open ? (
            <ChevronUp size={19} color={colors.muted} />
          ) : (
            <ChevronDown size={19} color={colors.muted} />
          )}
        </Pressable>
        {open && group.toggles.map(renderToggle)}
        {!activity && open &&
        group.id === "tools" &&
        fields.enable_checklist === true ? (
          <View style={{ gap: 6, paddingVertical: 7 }}>
            <Text style={styles.body}>Who can edit checklist items?</Text>
            <Txt muted>
              Managers means the host, co-owners, and admins. This never changes who can view the Beacon.
            </Txt>
            <Chips
              accessibilityPrefix="Checklist editors"
              options={["Participants", "Managers"]}
              value={current.checklist_edit_policy === "managers" ? "Managers" : "Participants"}
              onChange={(choice) =>
                change({
                  checklist_edit_policy:
                    choice === "Managers" ? "managers" : "participants",
                })
              }
            />
          </View>
        ) : null}
        {open && group.id === "media" && !templateMode && (
          <Field
            label="Music or playlist URL"
            placeholder="https://open.spotify.com/..."
            value={current.music_url ?? ""}
            onChangeText={(text) =>
              change({ music_url: text.trim() ? text : null })
            }
            autoCapitalize="none"
            keyboardType="url"
          />
        )}
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <Button
        secondary
        title={
          expanded
            ? "Hide advanced options"
            : templateMode
              ? "Template module defaults"
              : "Advanced options"
        }
        onPress={() => setExpanded((open) => !open)}
      />
      {expanded && (
        <View style={[styles.card, { gap: 12, padding: 13 }]}>
          {description && <Txt muted>{description}</Txt>}
          {!templateMode && (
            <>
              <Text style={styles.h2}>Capacity & access</Text>
              <Field
                label="Capacity (optional, including you)"
                placeholder="Unlimited"
                value={capacityText}
                onChangeText={(text) => {
                  setCapacityText(text);
                  change({ capacity_limit: text.trim() ? Number(text) : null });
                }}
                keyboardType="number-pad"
              />
              <Chips
                accessibilityPrefix="Capacity policy"
                options={["Soft", "Strict"]}
                value={current.capacity_policy === "strict" ? "Strict" : "Soft"}
                onChange={(choice) =>
                  change({
                    capacity_policy: choice === "Strict" ? "strict" : "soft",
                  })
                }
              />
              <Chips
                accessibilityPrefix="Join status"
                options={["Open", "Closed"]}
                value={current.manual_closed ? "Closed" : "Open"}
                onChange={(choice) =>
                  change({ manual_closed: choice === "Closed" })
                }
              />
            </>
          )}
          <Text style={styles.h2}>Optional Beacon modules</Text>
          <Txt muted>
            Overview, People, joining, reactions, and directions stay built in.
            Off modules are hidden from this Beacon.
          </Txt>
          {moduleGroups.map(renderGroup)}
          {!templateMode && (
            <>
              <Text style={styles.h2}>Appearance</Text>
              <Chips
                accessibilityPrefix="Beacon decoration"
                options={["None", ...DECORATION_EMOJIS]}
                value={current.decoration_emoji ?? "None"}
                onChange={(choice) =>
                  change({
                    decoration_emoji:
                      choice === "None"
                        ? null
                        : (choice as BeaconControlValues["decoration_emoji"]),
                  })
                }
              />
              <Chips
                accessibilityPrefix="Beacon accent"
                options={["Default", ...DECORATION_ACCENTS]}
                value={current.decoration_accent ?? "Default"}
                onChange={(choice) =>
                  change({
                    decoration_accent:
                      choice === "Default"
                        ? null
                        : (choice as BeaconControlValues["decoration_accent"]),
                  })
                }
              />
            </>
          )}
          {onSave && <Action title="Save beacon settings" run={save} />}
        </View>
      )}
    </View>
  );
}
