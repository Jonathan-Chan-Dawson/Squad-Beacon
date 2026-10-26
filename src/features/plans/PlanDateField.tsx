import React, { useState } from "react";
import { View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  const [open, setOpen] = useState(false);
  const { semanticColors: c } = useTheme();
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
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
          onPress={() => setOpen(true)}
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
      {open && (
        <DateTimePicker
          value={Number.isFinite(date.getTime()) ? date : new Date()}
          mode="date"
          onChange={(_, selected) => {
            setOpen(false);
            if (selected)
              onChange(
                `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`,
              );
          }}
        />
      )}
    </View>
  );
}
