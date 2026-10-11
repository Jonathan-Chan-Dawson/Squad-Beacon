import React, { useState } from "react";
import { View } from "react-native";
import { mapCalloutLayout } from "./mapCalloutLayout";
import { useTheme } from "@/src/shared/ui";

/** A map-owned callout follows the projected marker and stays inside map bounds. */
export function MapCallout({
  anchor,
  bounds,
  children,
  height,
  testID,
}: {
  anchor: { x: number; y: number } | null;
  bounds: { width: number; height: number; top: number; bottom: number };
  children: React.ReactNode;
  height?: number;
  testID?: string;
}) {
  const { colors, tokens } = useTheme();
  const [measuredHeight, setMeasuredHeight] = useState(height ?? 280);
  const { width, maxHeight, left, top, above, attached, pointerLeft } =
    mapCalloutLayout(
      anchor,
      bounds,
      measuredHeight,
      height,
      tokens.layout.screenGutter,
    );
  return (
    <View
      testID={testID}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        left,
        top,
        width,
        maxHeight,
        ...(height ? { height: maxHeight } : {}),
        zIndex: 20,
        elevation: 20,
      }}
    >
      {attached && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: pointerLeft,
            ...(above ? { bottom: -8 } : { top: -8 }),
            width: 16,
            height: 16,
            backgroundColor: colors.white,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.line,
            transform: [{ rotate: above ? "45deg" : "225deg" }],
          }}
        />
      )}
      {children}
    </View>
  );
}
