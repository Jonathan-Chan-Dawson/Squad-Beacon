import React from "react";
import { Text, View } from "react-native";
import { Zap, CalendarDays, Camera } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import { MotionPressable } from "@/src/shared/MotionPressable";
export function PeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 5,
        gap: 4,
        backgroundColor: colors.line + "88",
        borderRadius: 22,
      }}
    >
      {[
        { name: "Now", Icon: Zap },
        { name: "Upcoming", Icon: CalendarDays },
        { name: "Past", Icon: Camera },
      ].map(({ name, Icon }) => (
        <MotionPressable
          key={name}
          accessibilityRole="button"
          accessibilityLabel={name}
          accessibilityState={{ selected: name === value }}
          onPress={() => onChange(name)}
          style={{
            flex: 1,
            minHeight: 48,
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 18,
            backgroundColor: name === value ? colors.ink : "transparent",
          }}
        >
          <Icon
            size={15}
            color={name === value ? colors.white : colors.muted}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: name === value ? colors.white : colors.muted,
            }}
          >
            {name}
          </Text>
        </MotionPressable>
      ))}
    </View>
  );
}
