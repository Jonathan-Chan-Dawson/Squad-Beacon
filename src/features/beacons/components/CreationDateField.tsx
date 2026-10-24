import React from "react";
import { Platform, Text, View } from "react-native";
import DateField from "@/components/DateField";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import { useTheme } from "@/src/shared/ui";

export function CreationDateField({
  label,
  value,
  onChange,
  timezone,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  timezone: string;
}) {
  const { styles, colors } = useTheme();
  if (Platform.OS !== "web")
    return <DateField label={label} value={value} onChange={onChange} />;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((row) => row.type === type)?.value ?? "";
  const local = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>
        {label} · {timezone}
      </Text>
      {React.createElement("input", {
        type: "datetime-local",
        "aria-label": label,
        value: local,
        style: {
          minHeight: 48,
          width: "100%",
          boxSizing: "border-box",
          fontSize: 16,
          padding: 10,
          borderRadius: 12,
          border: `1px solid ${colors.line}`,
          backgroundColor: colors.surface,
          color: colors.ink,
        },
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const [date, time] = event.target.value.split("T");
          if (date && time)
            try {
              onChange(planLocalDateTimeToISO(date, time, timezone));
            } catch {
              /* The browser retains the last valid time across DST gaps. */
            }
        },
      })}
    </View>
  );
}
