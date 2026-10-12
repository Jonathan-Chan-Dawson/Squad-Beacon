import React, { useState } from "react";
import { Text, View } from "react-native";
import DateField from "@/components/DateField";
import { Action, Button, Txt, useTheme } from "@/src/shared/ui";
import { PlanningEditor } from "./PlanningEditor";
import {
  relativePingAvailability,
  validatePingAvailability,
} from "./availability";

export function PingAvailabilityEditor({
  availableAfter,
  autoRsvp,
  startsAt,
  onSave,
  onClose,
  inline,
}: {
  availableAfter?: string | null;
  autoRsvp: boolean;
  startsAt: string;
  onSave: (value: string | null) => Promise<unknown>;
  onClose: () => void;
  inline: boolean;
}) {
  const { styles } = useTheme();
  const [value, setValue] = useState<string | null>(availableAfter ?? null);
  const [custom, setCustom] = useState(false);
  return (
    <PlanningEditor
      title="Interested After…"
      visible
      inline={inline}
      onClose={onClose}
    >
      <View style={{ gap: 8 }}>
        {(
          [
            ["now", "Interested now"],
            ["hour", "In one hour"],
            ["tomorrow", "Tomorrow at this time"],
          ] as const
        ).map(([choice, label]) => (
          <Button
            key={choice}
            title={label}
            secondary
            onPress={() => {
              setValue(relativePingAvailability(choice));
              setCustom(false);
            }}
          />
        ))}
        <Button
          title="Choose date/time"
          secondary
          onPress={() => {
            setValue(value ?? new Date().toISOString());
            setCustom(true);
          }}
        />
        {custom ? (
          <DateField
            label="Available after"
            value={value ?? new Date().toISOString()}
            onChange={setValue}
          />
        ) : null}
        <Text style={styles.muted}>
          {value && Number.isFinite(Date.parse(value))
            ? `Available after ${new Date(value).toLocaleString()}`
            : "No availability restriction"}
        </Text>
        <Txt muted>
          Times use your local timezone (
          {Intl.DateTimeFormat().resolvedOptions().timeZone}).
        </Txt>
        {autoRsvp ? (
          <Txt muted>
            Auto-RSVP stays enabled. You will only join or request attendance if
            the Beacon starts at or after your availability, using its approval
            rules.
          </Txt>
        ) : null}
        {autoRsvp && value && Date.parse(value) > Date.parse(startsAt) ? (
          <Txt muted>
            This suggested Beacon starts before your availability. Conversion
            will skip your Auto-RSVP.
          </Txt>
        ) : null}
        <Action
          title="Save Interested"
          run={async () => {
            await onSave(validatePingAvailability(value, "interested"));
            onClose();
          }}
        />
      </View>
    </PlanningEditor>
  );
}
