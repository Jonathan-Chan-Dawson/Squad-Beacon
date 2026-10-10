import React, { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Button, Txt } from "@/src/shared/ui";
import type { QuietHoursPickerProps } from "./QuietHoursPicker";
const time = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
};
export default function QuietHoursPicker({
  start,
  end,
  onStart,
  onEnd,
}: QuietHoursPickerProps) {
  const [open, setOpen] = useState<"start" | "end" | null>(null);
  const choose = (which: "start" | "end") => {
    if (Platform.OS === "android")
      DateTimePickerAndroid.open({
        value: time(which === "start" ? start : end),
        mode: "time",
        is24Hour: true,
        onChange: (event, value) => {
          if (event.type === "set" && value)
            (which === "start" ? onStart : onEnd)(value.getHours());
        },
      });
    else setOpen((current) => (current === which ? null : which));
  };
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
      {open && Platform.OS === "ios" ? (
        <DateTimePicker
          value={time(open === "start" ? start : end)}
          mode="time"
          display="spinner"
          onChange={(_event, value) => {
            if (value) (open === "start" ? onStart : onEnd)(value.getHours());
          }}
        />
      ) : null}
      <Txt muted>
        Whole hours are saved. Any chosen minutes use the start of that hour.
      </Txt>
    </View>
  );
}
