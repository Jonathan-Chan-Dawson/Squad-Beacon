import React from "react";
import { View } from "react-native";
import { Button, Txt, useTheme } from "@/src/shared/ui";

export default function PlanDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { semanticColors: c, resolvedAppearance } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>{label}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          aria-label={label}
          type="date"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 16,
            fontFamily: "inherit",
            background: c.surface,
            color: c.textPrimary,
            border: `1px solid ${c.border}`,
            colorScheme: resolvedAppearance,
          }}
        />
        {value && (
          <Button
            compact
            secondary
            title="Decide later"
            onPress={() => onChange("")}
          />
        )}
      </View>
    </View>
  );
}
