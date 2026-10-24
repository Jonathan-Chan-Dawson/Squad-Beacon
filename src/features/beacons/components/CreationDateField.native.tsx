import React, { useState } from "react";
import { View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Txt } from "@/src/shared/ui";

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
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>
        {label} · {timezone}
      </Txt>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          secondary
          title={new Date(value).toLocaleDateString([], { timeZone: timezone })}
          onPress={() => setMode("date")}
        />
        <Button
          secondary
          title={new Date(value).toLocaleTimeString([], {
            timeZone: timezone,
            hour: "numeric",
            minute: "2-digit",
          })}
          onPress={() => setMode("time")}
        />
      </View>
      {mode ? (
        <DateTimePicker
          value={new Date(value)}
          mode={mode}
          timeZoneName={timezone}
          onChange={(_, date) => {
            setMode(null);
            if (date) onChange(date.toISOString());
          }}
        />
      ) : null}
    </View>
  );
}
