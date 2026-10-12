import React, { useState } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useReducedMotion,
} from "react-native-reanimated";
import { mapTooltip } from "./tooltipConstants";
import Svg, { Path } from "react-native-svg";
import { mapCalloutLayout } from "./mapCalloutLayout";
import { useTheme } from "@/src/shared/ui";

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
  const [swipeStart, setSwipeStart] = useState(0);
  const { colors, tokens } = useTheme();
  const [measuredHeight, setMeasuredHeight] = useState(height ?? 280);
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
    compact ? Math.min(measuredHeight, mapTooltip.maxHeight) : measuredHeight,
    height,
    tokens.layout.screenGutter,
    maxWidth,
  );
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
      onStartShouldSetResponder={() => false}
      onMoveShouldSetResponder={(event) =>
        !!onDismiss && event.nativeEvent.pageY - swipeStart > 24
      }
      onTouchStart={(event) => setSwipeStart(event.nativeEvent.pageY)}
      onResponderRelease={(event) => {
        if (event.nativeEvent.pageY - swipeStart > 40) onDismiss?.();
      }}
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
      {children}
    </Animated.View>
  );
}
