import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { Field, useTheme } from "./ui";

export function durationSummary(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return "Choose duration";
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return [
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    rest || !hours ? `${rest} min` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function DurationControl({
  value,
  onChange,
  minimum = 1,
  maximum,
  presets = [30, 60, 120],
}: {
  value: number;
  onChange(minutes: number): void;
  minimum?: number;
  maximum?: number;
  presets?: number[];
}) {
  const { styles, semanticColors: colors } = useTheme();
  const [custom, setCustom] = useState(!presets.includes(value));
  const [hours, setHours] = useState(String(Math.floor(value / 60)));
  const [minutes, setMinutes] = useState(String(value % 60));
  const update = (h: string, m: string) => {
    setHours(h);
    setMinutes(m);
    onChange(
      /^\d+$/.test(h) && /^\d+$/.test(m) && Number(m) < 60
        ? Number(h) * 60 + Number(m)
        : NaN,
    );
  };
  const invalid =
    !Number.isInteger(value) ||
    value < minimum ||
    (maximum != null && value > maximum);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Clock3 size={16} color={colors.textSecondary} />
        <Text style={styles.label}>Duration</Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Duration"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
      >
        {[...presets, -1].map((amount) => {
          const checked = amount === -1 ? custom : !custom && value === amount;
          return (
            <Pressable
              key={amount}
              accessibilityRole="radio"
              accessibilityLabel={
                amount === -1 ? "Custom duration" : durationSummary(amount)
              }
              accessibilityState={{ checked }}
              aria-checked={checked}
              onPress={() => {
                setCustom(amount === -1);
                if (amount !== -1) onChange(amount);
                else {
                  setHours(String(Math.floor(value / 60)));
                  setMinutes(String(value % 60));
                }
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 10,
                justifyContent: "center",
                borderBottomWidth: 2,
                borderColor: checked ? colors.accent : colors.border,
              }}
            >
              <Text
                style={[styles.body, { fontWeight: checked ? "700" : "400" }]}
              >
                {amount === -1 ? "Custom" : durationSummary(amount)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {custom && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Hours"
              keyboardType="number-pad"
              value={hours}
              onChangeText={(next) => update(next, minutes)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Minutes"
              keyboardType="number-pad"
              value={minutes}
              onChangeText={(next) => update(hours, next)}
            />
          </View>
        </View>
      )}
      {invalid && (
        <Text accessibilityRole="alert" style={styles.error}>
          Choose {minimum}
          {maximum != null ? `–${maximum}` : " or more"} minutes; minutes must
          be 0–59.
        </Text>
      )}
    </View>
  );
}
