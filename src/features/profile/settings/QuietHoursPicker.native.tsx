import React, { useState } from "react";
import { Platform, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import type { QuietHoursPickerProps } from "./QuietHoursPicker";
const time = (hour: number) => new Date(2000, 0, 15, hour);
export default function QuietHoursPicker({
  start,
  end,
  onStart,
  onEnd,
}: QuietHoursPickerProps) {
  const [open, setOpen] = useState<"start" | "end" | null>(null);
  const { resolvedAppearance } = useTheme();
  const ios = Platform.OS === "ios";
  const choose = (which: "start" | "end") =>
    setOpen((current) => (current === which ? null : which));
  return (
    <View style={{ gap: 10 }}>
      <Button
        secondary
        title={`Quiet hours start · ${String(start).padStart(2, "0")}:00`}
        onPress={() => choose("start")}
      />
      <Button
        secondary
        title={`Quiet hours end · ${String(end).padStart(2, "0")}:00`}
        onPress={() => choose("end")}
      />
      {open ? (
        <DateTimePicker
          key={open}
          value={time(open === "start" ? start : end)}
          mode="time"
          display={ios ? "spinner" : "default"}
          presentation="dialog"
          is24Hour
          themeVariant={resolvedAppearance}
          onDismiss={() => setOpen(null)}
          onValueChange={(_event, value) => {
            if (!ios) setOpen(null);
            (open === "start" ? onStart : onEnd)(value.getHours());
          }}
        />
      ) : null}
      <Txt muted>
        Whole hours are saved. Any chosen minutes use the start of that hour.
      </Txt>
    </View>
  );
}
