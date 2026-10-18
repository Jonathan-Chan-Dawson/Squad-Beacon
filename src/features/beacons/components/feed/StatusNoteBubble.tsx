import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/src/shared/ui";

export function NoteSpeechBubble({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const gradientId = React.useId().replace(/:/g, "");
  return (
    <View
      testID="status-note-speech-bubble"
      style={{ paddingBottom: 9, alignSelf: "stretch" }}
    >
      <View
        style={{
          padding: compact ? 10 : 16,
          borderRadius: compact ? 18 : 22,
          gap: 8,
          backgroundColor: colors.green + "18",
          overflow: "hidden",
        }}
      >
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.green} stopOpacity={0.12} />
              <Stop offset="1" stopColor={colors.green} stopOpacity={0.015} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        {children}
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          alignSelf: "center",
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: colors.green + "18",
        }}
      />
    </View>
  );
}
