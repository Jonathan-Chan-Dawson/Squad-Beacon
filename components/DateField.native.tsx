import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { localDateTimeField, parseLocalDateTimeField, type DateTimeFieldProps } from "@/src/shared/dateTime";

export default function DateField({
  label,
  value,
  onChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  showTimezone = true,
  onValidityChange,
}: DateTimeFieldProps) {
  const { semanticColors: colors, resolvedAppearance, styles } = useTheme();
  const [edit, setEdit] = useState<{ mode: "date" | "time"; pending: Date; wall: string } | null>(null);
  const [error, setError] = useState("");
  const valid = Number.isFinite(Date.parse(value));
  const date = valid ? new Date(value) : new Date();
  const ios = Platform.OS === "ios";
  const dateLabel = valid ? date.toLocaleDateString(undefined, { timeZone: timezone }) : "Choose date";
  const timeLabel = valid ? date.toLocaleTimeString(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "Choose time";
  function open(mode: "date" | "time") {
    const wall = localDateTimeField(date.toISOString(), timezone);
    const [day, time] = wall.split("T");
    // Expo UI's Android picker uses the device timezone. Seed just the part being edited.
    const pending = ios ? date : new Date(mode === "date" ? `${day}T12:00` : `2000-01-15T${time}`);
    setEdit({ mode, pending, wall });
  }
  function confirm(selected: Date, selection: NonNullable<typeof edit>) {
    setEdit(null);
    try {
      let next = selected.toISOString();
      if (!ios) {
        const [day, time] = selection.wall.split("T");
        const [selectedDay, selectedTime] = localDateTimeField(next, Intl.DateTimeFormat().resolvedOptions().timeZone).split("T");
        const wall = selection.mode === "date" ? `${selectedDay}T${time}` : `${day}T${selectedTime}`;
        next = valid && wall === selection.wall ? value : parseLocalDateTimeField(wall, timezone);
      }
      onChange(next);
      setError("");
      onValidityChange?.(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Choose a valid date and time.");
      onValidityChange?.(false);
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <Txt>{label}</Txt>
      {showTimezone && <Txt muted>{timezone}</Txt>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          compact
          secondary
          icon={<CalendarDays size={16} color={colors.textPrimary} />}
          title={dateLabel}
          accessibilityLabel={`${label} date, ${dateLabel}`}
          onPress={() => open("date")}
        />
        <Button
          compact
          secondary
          icon={<Clock3 size={16} color={colors.textPrimary} />}
          title={timeLabel}
          accessibilityLabel={`${label} time, ${timeLabel}`}
          onPress={() => open("time")}
        />
      </View>
      {edit && (
        <>
          <DateTimePicker
            key={edit.mode}
            value={edit.pending}
            mode={edit.mode}
            display={ios ? "spinner" : "default"}
            presentation="dialog"
            timeZoneName={timezone}
            themeVariant={resolvedAppearance}
            onDismiss={() => setEdit(null)}
            onValueChange={(_, selected) => {
              if (ios) setEdit({ ...edit, pending: selected });
              else confirm(selected, edit);
            }}
          />
          {ios && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button compact secondary title="Cancel" onPress={() => setEdit(null)} />
              <Button compact title="Done" onPress={() => confirm(edit.pending, edit)} />
            </View>
          )}
        </>
      )}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}
