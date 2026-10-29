import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/src/shared/ui";
import {
  localDateTimeField,
  parseLocalDateTimeField,
  type DateTimeFieldProps,
} from "@/src/shared/dateTime";

export default function DateField({
  label,
  value,
  onChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onValidityChange,
}: DateTimeFieldProps) {
  const { semanticColors: colors, styles } = useTheme();
  const source = value + ":" + timezone;
  const [edit, setEdit] = useState(() => ({
    source,
    local: localDateTimeField(value, timezone),
    error: "",
  }));
  if (edit.source !== source)
    setEdit({ source, local: localDateTimeField(value, timezone), error: "" });
  const { local, error } = edit;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.muted}>{timezone}</Text>
      <input
        aria-label={label}
        aria-invalid={!!error}
        type="datetime-local"
        value={local}
        onChange={(event) => {
          setEdit({ source, local: event.target.value, error: "" });
          try {
            const instant = parseLocalDateTimeField(
              event.target.value,
              timezone,
            );
            onChange(instant);
            onValidityChange?.(true);
          } catch (failure) {
            setEdit({
              source,
              local: event.target.value,
              error:
                failure instanceof Error
                  ? failure.message
                  : "Choose a valid date and time.",
            });
            onValidityChange?.(false);
          }
        }}
        style={{
          minHeight: 44,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 10,
          border: "1px solid " + (error ? colors.danger : colors.border),
          background: colors.surface,
          color: colors.textPrimary,
          padding: "10px 12px",
          font: "inherit",
          colorScheme: "light dark",
        }}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
