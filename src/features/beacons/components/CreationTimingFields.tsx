import React, { useState } from "react";
import { Text, View } from "react-native";
import DateField from "@/components/DateField";
import { Chip } from "@/src/shared/design-system";
import { DurationControl } from "@/src/shared/DurationControl";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import {
  creationPresetStart,
  creationScheduleSummary,
  creationStartChoices,
  type CreationStartChoice,
} from "../createTiming";

export function CreationTimingFields({
  now,
  starts,
  ends,
  timezone,
  when,
  minutes,
  expanded,
  dateError,
  durationError,
  onExpand,
  onPreset,
  onStart,
  onEnd,
  onDuration,
  onDateValidity,
}: {
  now: number;
  starts: number;
  ends: string;
  timezone: string;
  when: string;
  minutes: number;
  expanded: boolean;
  dateError: string;
  durationError: string;
  onExpand(open: boolean): void;
  onPreset(
    choice: Exclude<CreationStartChoice, "Choose date">,
    value: number,
  ): void;
  onStart(value: string): void;
  onEnd(value: string): boolean;
  onDuration(value: number): void;
  onDateValidity(field: "start" | "end", valid: boolean): void;
}) {
  const { styles, tokens } = useTheme();
  const [durationRevision, setDurationRevision] = useState(0);
  const schedule = creationScheduleSummary(starts, ends, timezone, now);
  const dayEnd = schedule.indexOf(" · ");
  const zoneName =
    new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(starts)
      .find((part) => part.type === "timeZoneName")?.value ?? timezone;
  return (
    <View style={{ gap: 8 }} testID="inline-beacon-timing">
      <Text style={styles.label}>When?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {creationStartChoices.map((choice) => (
          <Chip
            key={choice}
            label={choice}
            accessibilityLabel={`Start time: ${choice}`}
            selected={
              choice === when ||
              (choice === "Choose date" && when === "Pick time")
            }
            aria-selected={
              choice === when ||
              (choice === "Choose date" && when === "Pick time")
            }
            disabled={
              choice === "Later today" &&
              creationPresetStart(choice, now, timezone) == null
            }
            onPress={() => {
              if (choice === "Choose date") {
                onExpand(true);
                return;
              }
              const value = creationPresetStart(choice, Date.now(), timezone);
              if (value != null) {
                onPreset(choice, value);
                onExpand(false);
              }
            }}
          />
        ))}
      </View>
      {expanded && (
        <View style={{ gap: 8 }}>
          <DateField
            label="Starts"
            value={new Date(starts).toISOString()}
            timezone={timezone}
            showTimezone={false}
            onChange={onStart}
            onValidityChange={(valid) => onDateValidity("start", valid)}
          />
          <DateField
            label="Ends"
            value={ends}
            timezone={timezone}
            showTimezone={false}
            onChange={(value) => {
              if (onEnd(value)) setDurationRevision((revision) => revision + 1);
            }}
            onValidityChange={(valid) => onDateValidity("end", valid)}
          />
          {!!dateError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {dateError}
            </Text>
          )}
          <Button
            compact
            secondary
            title={dateError ? "Discard invalid time edit" : "Hide exact time"}
            onPress={() => onExpand(false)}
          />
        </View>
      )}
      <DurationControl
        key={durationRevision}
        label="How long?"
        value={minutes}
        onChange={onDuration}
      />
      {!!durationError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {durationError}
        </Text>
      )}
      <View style={{ gap: 4 }}>
        <Text
          style={[
            styles.body,
            tokens.type.title,
            { fontWeight: "500", fontVariant: ["tabular-nums"] },
          ]}
        >
          {dayEnd < 0 ? (
            schedule
          ) : (
            <>
              <Text style={{ fontWeight: "700" }}>
                {schedule.slice(0, dayEnd)}
              </Text>
              {schedule.slice(dayEnd)}
            </>
          )}
        </Text>
        <Txt muted>
          {zoneName}
          {when === "Now" ? " · Starts when you create it" : ""}
        </Txt>
      </View>
    </View>
  );
}
