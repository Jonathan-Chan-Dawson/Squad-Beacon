import React from "react";
import { View } from "react-native";
import { Field } from "@/src/shared/ui";
export type QuietHoursPickerProps = {
  start: number;
  end: number;
  onStart: (hour: number) => void;
  onEnd: (hour: number) => void;
};
export default function QuietHoursPicker({
  start,
  end,
  onStart,
  onEnd,
}: QuietHoursPickerProps) {
  const change = (value: string, update: (hour: number) => void) => {
    if (/^(?:[0-9]|1[0-9]|2[0-3])$/.test(value)) update(Number(value));
  };
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Quiet hours start (0–23)"
        keyboardType="numeric"
        value={String(start)}
        onChangeText={(value) => change(value, onStart)}
      />
      <Field
        label="Quiet hours end (0–23)"
        keyboardType="numeric"
        value={String(end)}
        onChangeText={(value) => change(value, onEnd)}
      />
    </View>
  );
}
