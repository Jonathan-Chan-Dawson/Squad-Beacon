import React, { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import type { DateTimeFieldProps } from "@/src/shared/dateTime";

export default function DateField({
  label,
  value,
  onChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onValidityChange,
}: DateTimeFieldProps) {
  const { semanticColors: colors } = useTheme();
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const valid = Number.isFinite(Date.parse(value));
  const date = valid ? new Date(value) : new Date();
  return (
    <View style={{ gap: 6 }}>
      <Txt>{label}</Txt>
      <Txt muted>{timezone}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          compact
          secondary
          icon={<CalendarDays size={16} color={colors.textPrimary} />}
          title={
            valid
              ? date.toLocaleDateString(undefined, { timeZone: timezone })
              : "Choose date"
          }
          onPress={() => setMode("date")}
        />
        <Button
          compact
          secondary
          icon={<Clock3 size={16} color={colors.textPrimary} />}
          title={
            valid
              ? date.toLocaleTimeString(undefined, {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Choose time"
          }
          onPress={() => setMode("time")}
        />
      </View>
      {mode && (
        <DateTimePicker
          value={date}
          mode={mode}
          display={Platform.OS === "ios" ? "compact" : "default"}
          timeZoneName={timezone}
          onChange={(event, next) => {
            setMode(null);
            if (event.type !== "dismissed" && next && Number.isFinite(+next)) {
              onChange(next.toISOString());
              onValidityChange?.(true);
            }
          }}
        />
      )}
    </View>
  );
}
