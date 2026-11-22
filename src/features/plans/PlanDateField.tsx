import React, { useState } from "react";
import { Platform, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarDays } from "lucide-react-native";
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
  const [pending, setPending] = useState<Date | null>(null);
  const { semanticColors: c, resolvedAppearance } = useTheme();
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  const ios = Platform.OS === "ios";
  function confirm(selected: Date) {
    setPending(null);
    onChange(
      `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`,
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>{label}</Txt>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button
          secondary
          accessibilityLabel={label}
          title={
            value
              ? date.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "Choose a day"
          }
          icon={<CalendarDays size={17} color={c.accent} />}
          onPress={() => setPending(Number.isFinite(date.getTime()) ? date : new Date())}
        />
        {value && (
          <Button
            compact
            secondary
            title="Decide later"
            onPress={() => { setPending(null); onChange(""); }}
          />
        )}
      </View>
      {pending && (
        <>
          <DateTimePicker
            value={pending}
            mode="date"
            display={ios ? "spinner" : "default"}
            presentation="dialog"
            themeVariant={resolvedAppearance}
            onDismiss={() => setPending(null)}
            onValueChange={(_, selected) => {
              if (ios) setPending(selected);
              else confirm(selected);
            }}
          />
          {ios && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button compact secondary title="Cancel" onPress={() => setPending(null)} />
              <Button compact title="Done" onPress={() => confirm(pending)} />
            </View>
          )}
        </>
      )}
    </View>
  );
}
