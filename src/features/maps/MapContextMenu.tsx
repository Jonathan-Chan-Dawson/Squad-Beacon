import React, { useEffect, useState } from "react";
import { BackHandler, Platform, Text, View } from "react-native";
import {
  CalendarPlus,
  ChevronRight,
  ExternalLink,
  MapPin,
  Navigation,
  RadioTower,
  X,
} from "lucide-react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useReducedMotion } from "@/src/shared/design-system";
import { useTheme } from "@/src/shared/ui";

const actions = [
  {
    title: "Share a Pulse",
    subtitle: "What's happening here?",
    Icon: RadioTower,
    tone: "mint",
    accessibilityLabel: "Share a Pulse. What's happening here?",
  },
  {
    title: "Create a Beacon",
    subtitle: "Plan an activity here",
    Icon: CalendarPlus,
    tone: "blue",
    accessibilityLabel: "Create a Beacon. Plan an activity here",
  },
  {
    title: "Get Directions",
    subtitle: "Open in your maps app",
    Icon: Navigation,
    tone: "violet",
    accessibilityLabel: "Get Directions. Open in your maps app",
  },
] as const;

export function MapContextMenu({
  point,
  bounds,
  onUpdate,
  onCreate,
  onDirections,
  onClose,
}: {
  point: { x: number; y: number };
  bounds: { width: number; height: number; top: number; bottom: number };
  onUpdate(): void;
  onCreate(): void;
  onDirections(): void;
  onClose(): void;
}) {
  const { colors, tokens } = useTheme();
  const [menuHeight, setMenuHeight] = useState(244);
  const gutter = tokens.layout.screenGutter;
  const menuWidth = Math.min(304, bounds.width - gutter * 2);
  const reduced = useReducedMotion();
  const maxHeight = Math.max(0, bounds.height - bounds.top - bounds.bottom);
  const left = Math.max(
    gutter,
    Math.min(bounds.width - menuWidth - gutter, point.x - menuWidth / 2),
  );
  const preferredTop = bounds.height - bounds.bottom - point.y >= menuHeight + 12
    ? point.y + 12
    : point.y - menuHeight - 40;
  const top = Math.max(
    bounds.top,
    Math.min(bounds.height - bounds.bottom - menuHeight, preferredTop),
  );
  const handlers = [onUpdate, onCreate, onDirections];
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    if (Platform.OS === "web") document.addEventListener("keydown", escape);
    return () => {
      back.remove();
      if (Platform.OS === "web") document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return (
    <Animated.View
      accessibilityRole="menu"
      accessibilityLabel="Actions for this map location"
      onStartShouldSetResponder={() => true}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
      entering={
        reduced
          ? FadeIn.duration(120)
          : ZoomIn.springify().damping(18).stiffness(220)
      }
      style={{
        position: "absolute",
        left,
        top,
        width: menuWidth,
        maxHeight,
        overflow: "hidden",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        zIndex: 30,
        elevation: 30,
        shadowColor: "#000000",
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <View
        style={{
          minHeight: 48,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <MapPin size={15} color={colors.green} />
        <Text
          style={{
            flex: 1,
            marginLeft: 10,
            color: colors.ink,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          At this location
        </Text>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Close location actions"
          onPress={(event) => {
            event.stopPropagation();
            onClose();
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            marginRight: -8,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: pressed ? colors.lime : "transparent",
          })}
        >
          <X size={17} color={colors.muted} />
        </MotionPressable>
      </View>

      {actions.map(({ title, subtitle, Icon, tone, accessibilityLabel }, i) => (
        <React.Fragment key={title}>
          {i > 0 ? (
            <View
              style={{ height: 1, backgroundColor: colors.line, opacity: 0.8 }}
            />
          ) : null}
          <MotionPressable
            accessibilityRole="menuitem"
            accessibilityLabel={accessibilityLabel}
            onPress={(event) => {
              event.stopPropagation();
              handlers[i]();
            }}
            style={({ pressed }) => ({
              minHeight: 64,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: pressed ? colors.lime : "transparent",
            })}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  tone === "mint"
                    ? "rgba(73, 207, 174, 0.18)"
                    : tone === "blue"
                      ? "rgba(102, 158, 226, 0.19)"
                      : "rgba(154, 142, 218, 0.19)",
              }}
            >
              <Icon
                size={18}
                color={
                  tone === "mint"
                    ? colors.green
                    : tone === "blue"
                      ? "#8FB9F2"
                      : "#B2A8E7"
                }
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.ink,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {title}
                </Text>
                {i === 2 ? (
                  <ExternalLink
                    size={12}
                    color={colors.muted}
                    style={{ marginLeft: 5 }}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  color: colors.muted,
                  fontSize: 12,
                }}
              >
                {subtitle}
              </Text>
            </View>
            <ChevronRight size={17} color={colors.muted} />
          </MotionPressable>
        </React.Fragment>
      ))}
    </Animated.View>
  );
}
