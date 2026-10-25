import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/src/shared/ui";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
export default function ZonedTimeField({
  label,
  value,
  timezone,
  onChange,
}: {
  label: string;
  value: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  const { colors, styles } = useTheme();
  const [error, setError] = useState("");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(value))
    .find((p) => p.type === "timeZoneName")?.value;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.muted}>
        {label} · {timezone} · {offset}
      </Text>
      <input
        aria-label={label}
        type="datetime-local"
        value={`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`}
        onChange={(e) => {
          try {
            const [date, time] = e.target.value.split("T");
            onChange(planLocalDateTimeToISO(date, time, timezone));
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        style={{
          minHeight: 44,
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${colors.line}`,
          borderRadius: 10,
          padding: 10,
          background: colors.surfaceRaised,
          color: colors.ink,
          font: "inherit",
        }}
      />
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
