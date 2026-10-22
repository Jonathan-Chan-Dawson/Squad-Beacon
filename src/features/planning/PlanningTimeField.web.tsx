import React from "react";
import { View } from "react-native";
import { Txt, useTheme } from "@/src/shared/ui";

export default function PlanningTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const { colors } = useTheme();
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  const local = Number.isFinite(+date)
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    : "";
  return (
    <View style={{ gap: 6 }}>
      <Txt muted>{label}</Txt>
      <input
        aria-label={label}
        type="datetime-local"
        value={local}
        onChange={(event) => {
          const next = new Date(event.target.value);
          if (Number.isFinite(+next)) onChange(next.toISOString());
        }}
        style={{
          minHeight: 44,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 12,
          border: `1px solid ${colors.line}`,
          background: colors.surfaceRaised,
          color: colors.ink,
          padding: "10px 12px",
          font: "inherit",
          colorScheme: "light dark",
        }}
      />
    </View>
  );
}
