import React, { createContext, useEffect, useState } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useReducedMotion,
} from "react-native-reanimated";
import { BackHandler, Platform } from "react-native";
import { mapTooltip } from "./tooltipConstants";
import Svg, { Path } from "react-native-svg";
import { mapCalloutLayout } from "./mapCalloutLayout";
import { useTheme } from "@/src/shared/ui";

/** Natural card size avoids measuring only the already-clipped scroll viewport. */
export const MapCalloutNaturalHeight = createContext<
  ((height: number) => void) | null
>(null);

/** A map-owned callout follows the projected marker and stays inside map bounds. */
export function MapCallout({
  anchor,
  bounds,
  children,
  height,
  testID,
  maxWidth,
  onDismiss,
  compact = false,
}: {
  anchor: { x: number; y: number } | null;
  bounds: {
    width: number;
    height: number;
    top: number;
    bottom: number;
    right?: number;
    exclusionRight?: number;
    exclusionBottom?: number;
  };
  children: React.ReactNode;
  height?: number;
  testID?: string;
  maxWidth?: number;
  compact?: boolean;
  onDismiss?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { colors, tokens } = useTheme();
  const [measuredHeight, setMeasuredHeight] = useState(height ?? 280);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const {
    width,
    maxHeight,
    left,
    top,
    above,
    attached,
    pointerLeft,
    pointerTip,
  } = mapCalloutLayout(
    anchor,
    bounds,
    compact
      ? Math.min(naturalHeight ?? measuredHeight, mapTooltip.maxHeight)
      : measuredHeight,
    height,
    tokens.layout.screenGutter,
    maxWidth,
  );
  useEffect(() => {
    if (!onDismiss) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      onDismiss();
      return true;
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onDismiss();
      }
    };
    if (Platform.OS === "web") document.addEventListener("keydown", escape);
    return () => {
      back.remove();
      if (Platform.OS === "web")
        document.removeEventListener("keydown", escape);
    };
  }, [onDismiss]);
  return (
    <Animated.View
      entering={
        reducedMotion
          ? FadeIn.duration(mapTooltip.duration)
          : ZoomIn.duration(mapTooltip.duration).delay(50)
      }
      exiting={
        reducedMotion
          ? FadeOut.duration(mapTooltip.duration)
          : ZoomOut.duration(mapTooltip.duration)
      }
      pointerEvents="box-none"
      testID={testID}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        transformOrigin: [pointerTip, above ? "100%" : 0, 0],
        left,
        top,
        width,
        maxHeight: compact
          ? Math.min(maxHeight, mapTooltip.maxHeight)
          : maxHeight,
        ...(height ? { height: maxHeight } : {}),
        zIndex: 20,
        elevation: 20,
      }}
    >
      {attached && (
        <Svg
          pointerEvents="none"
          width={width}
          height={mapTooltip.pointerSize + 2}
          style={{
            position: "absolute",
            left: 0,
            ...(above ? { bottom: -13 } : { top: -13 }),
            overflow: "visible",
          }}
        >
          <Path
            d={
              above
                ? `M${pointerLeft - mapTooltip.pointerSize / 2} 0 L${pointerTip} 13 L${pointerLeft + mapTooltip.pointerSize / 2} 0`
                : `M${pointerLeft - mapTooltip.pointerSize / 2} 14 L${pointerTip} 1 L${pointerLeft + mapTooltip.pointerSize / 2} 14`
            }
            fill={colors.white}
            stroke={colors.line}
            strokeWidth={1}
          />
        </Svg>
      )}
      <MapCalloutNaturalHeight.Provider value={setNaturalHeight}>
        {children}
      </MapCalloutNaturalHeight.Provider>
    </Animated.View>
  );
}
