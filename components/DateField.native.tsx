import React, { useState } from "react";
import { View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Txt } from "@/src/ui";
export default function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>{label}</Txt>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          secondary
          title={new Date(value).toLocaleDateString()}
          onPress={() => setMode("date")}
        />
        <Button
          secondary
          title={new Date(value).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
          onPress={() => setMode("time")}
        />
      </View>
      {mode && (
        <DateTimePicker
          value={new Date(value)}
          mode={mode}
          onChange={(_, date) => {
            setMode(null);
            if (date) onChange(date.toISOString());
          }}
        />
      )}
    </View>
  );
}
