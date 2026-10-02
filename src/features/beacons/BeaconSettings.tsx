import React, { useState } from "react";
import { View } from "react-native";
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
};

const moduleOptions = [
  ["Chat", "enable_chat", "Group conversation."],
  ["Checklist", "enable_checklist", "Shared tasks for this beacon."],
  ["Journal", "enable_journal", "Short notes shared with approved attendees."],
  ["Memory comments", "enable_experiences", "Text comments only; media uploads aren't available yet."],
  ["Focus timer", "enable_focus", "A local timer on each person's device."],
  ["Reactions", "enable_reactions", "Quick responses to the group."],
] as const;

export function BeaconSettings({ activity, value, onChange, onSave, description }: Props) {
  const { styles } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(() =>
    value ?? (activity ? beaconControlValuesFromActivity(activity) : defaultBeaconControlValues()),
  );
  const [capacityText, setCapacityText] = useState(() =>
    (value ?? (activity ? beaconControlValuesFromActivity(activity) : defaultBeaconControlValues()))
      .capacity_limit?.toString() ?? "",
  );
  const current = value ?? localValue;
  const change = (patch: Partial<BeaconControlValues>) => {
    const next = { ...current, ...patch };
    if (onChange) onChange(next);
    else setLocalValue(next);
  };
  const save = async () => {
    if (!onSave) return;
    await onSave(validateBeaconControlValues({ ...current }));
  };
  const toggle = (field: (typeof moduleOptions)[number][1], selected: string) =>
    change({ [field]: selected === "On" } as Partial<BeaconControlValues>);

  return (
    <View style={{ gap: 8 }}>
      <Button
        secondary
        title={expanded ? "Hide capacity & tools" : "Capacity & tools"}
        onPress={() => setExpanded((open) => !open)}
      />
      {expanded && (
        <View style={[styles.card, { gap: 12, padding: 13 }]}>
          <Txt muted>
            Soft capacity is a target; strict capacity closes new requests at the limit.
            Turning off a tool pauses new changes but keeps authorized history readable.
          </Txt>
          {description && <Txt muted>{description}</Txt>}
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
              change({ capacity_policy: choice === "Strict" ? "strict" : "soft" })
            }
          />
          <Chips
            accessibilityPrefix="Join status"
            options={["Open", "Closed"]}
            value={current.manual_closed ? "Closed" : "Open"}
            onChange={(choice) => change({ manual_closed: choice === "Closed" })}
          />
          <Txt muted>Tool switches</Txt>
          {moduleOptions.map(([label, field, explanation]) => (
            <View key={field} style={{ gap: 4 }}>
              <Txt>{label}</Txt>
              <Txt muted>{explanation}</Txt>
              <Chips
                accessibilityPrefix={label}
                options={["On", "Paused"]}
                value={current[field] ? "On" : "Paused"}
                onChange={(choice) => toggle(field, choice === "On" ? "On" : "Off")}
              />
            </View>
          ))}
          <Field
            label="Music link (optional)"
            placeholder="https://open.spotify.com/..."
            value={current.music_url ?? ""}
            onChangeText={(text) => change({ music_url: text.trim() ? text : null })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Txt muted>Opens the music service; this app does not play the audio.</Txt>
          <Txt muted>Decoration</Txt>
          <Chips
            accessibilityPrefix="Beacon decoration"
            options={["None", ...DECORATION_EMOJIS]}
            value={current.decoration_emoji ?? "None"}
            onChange={(choice) =>
              change({ decoration_emoji: choice === "None" ? null : choice as BeaconControlValues["decoration_emoji"] })
            }
          />
          <Chips
            accessibilityPrefix="Beacon accent"
            options={["Default", ...DECORATION_ACCENTS]}
            value={current.decoration_accent ?? "Default"}
            onChange={(choice) =>
              change({ decoration_accent: choice === "Default" ? null : choice as BeaconControlValues["decoration_accent"] })
            }
          />
          {onSave && (
            <Action title="Save beacon settings" run={save} />
          )}
        </View>
      )}
    </View>
  );
}
