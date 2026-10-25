import React from "react";
import { I18nManager, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/src/shared/ui";

export function NoteSpeechBubble({
  children,
  compact = false,
  tailTowardIdentity = false,
  dense = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
  tailTowardIdentity?: boolean;
  dense?: boolean;
}) {
  const { colors } = useTheme();
  const gradientId = React.useId().replace(/:/g, "");
  return (
    <View
      testID="status-note-speech-bubble"
      style={{
        paddingTop: dense ? 0 : tailTowardIdentity ? 9 : 0,
        paddingBottom: dense ? 0 : tailTowardIdentity ? 0 : 9,
        alignSelf: "stretch",
      }}
    >
      <View
        style={{
          padding: compact ? 10 : 16,
          ...(dense ? { paddingVertical: 6, paddingHorizontal: 10 } : {}),
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
      {!dense && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            ...(tailTowardIdentity ? { top: 0 } : { bottom: 0 }),
            ...(I18nManager.isRTL ? { right: 24 } : { left: 24 }),
            borderLeftWidth: 9,
            borderRightWidth: 9,
            ...(tailTowardIdentity
              ? {
                  borderBottomWidth: 10,
                  borderBottomColor: colors.green + "18",
                }
              : { borderTopWidth: 10, borderTopColor: colors.green + "18" }),
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
          }}
        />
      )}
    </View>
  );
}
