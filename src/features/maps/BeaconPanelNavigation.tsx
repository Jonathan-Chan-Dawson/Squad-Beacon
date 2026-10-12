import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  ListChecks,
  Timer,
  Trophy,
  Users,
  StickyNote,
  Images,
  Music,
  Vote,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import { useReducedMotion } from "@/src/shared/design-system";
import {
  beaconFeatureLabels,
  type BeaconSheetTab,
  type BeaconActivityModule,
} from "./mapBeaconFeatures";

export type SheetTool = BeaconActivityModule | "teams" | "decision";
const icons = {
  checklist: ListChecks,
  focus: Timer,
  scoreboard: Trophy,
  teams: Users,
  journal: StickyNote,
  experiences: Images,
  music: Music,
  decision: Vote,
};
const labels: Record<SheetTool, string> = {
  checklist: "Checklist",
  focus: "Focus Timer",
  scoreboard: "Game",
  teams: "Teams",
  journal: "Sketchboard",
  experiences: "Memories",
  music: "Music",
  decision: "Decision",
};

export function BeaconToolContent({
  enabled,
  onSwipe,
  children,
}: {
  enabled: boolean;
  onSwipe(direction: number): void;
  children: React.ReactNode;
}) {
  const responder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (event, gesture) =>
      enabled &&
      !(
        Platform.OS === "web" &&
        (event.target as unknown as HTMLElement)?.closest?.(
          "input, textarea, button, [role=checkbox], [role=button]",
        )
      ) &&
      Math.abs(gesture.dx) > 28 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
    onPanResponderRelease: (_, gesture) => {
      if (
        Math.abs(gesture.dx) >= 55 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2
      )
        onSwipe(gesture.dx < 0 ? 1 : -1);
    },
  });
  return (
    <View
      {...responder.panHandlers}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        ...(Platform.OS === "web" && enabled
          ? ({
              touchAction: "pan-y",
              overscrollBehaviorX: "contain",
            } as unknown as ViewStyle)
          : {}),
      }}
    >
      {children}
    </View>
  );
}

export function BeaconPanelTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: BeaconSheetTab[];
  selected: BeaconSheetTab;
  onSelect(tab: BeaconSheetTab): void;
}) {
  const { styles, colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const segment = width / tabs.length;
  const index = Math.max(0, tabs.indexOf(selected));
  useEffect(() => {
    if (reduced) {
      offset.setValue(index * segment);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
    } else
      Animated.timing(offset, {
        toValue: index * segment,
        duration: 220,
        useNativeDriver: true,
      }).start();
  }, [index, segment, reduced, offset, opacity]);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Beacon features"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", position: "relative" }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          accessibilityRole="tab"
          accessibilityLabel={beaconFeatureLabels[tab]}
          accessibilityState={{ selected: selected === tab }}
          aria-selected={selected === tab}
          onPress={() => onSelect(tab)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                fontSize: 13,
                color: selected === tab ? colors.green : colors.muted,
              },
            ]}
          >
            {beaconFeatureLabels[tab]}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 10,
          width: Math.max(0, segment - 20),
          height: 2,
          borderRadius: 2,
          backgroundColor: colors.green,
          opacity,
          transform: [{ translateX: offset }],
        }}
      />
    </View>
  );
}

export function BeaconToolSwitcher({
  tools,
  selected,
  onSelect,
  checklistLabel = "Checklist",
}: {
  tools: SheetTool[];
  selected: SheetTool;
  onSelect(tool: SheetTool): void;
  checklistLabel?: string;
}) {
  const { styles, colors } = useTheme();
  const reduced = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const order = tools.join(",");
  useEffect(() => {
    // The active tool leads this row. Reset after reordering so it remains visible.
    const frame = requestAnimationFrame(() =>
      ref.current?.scrollTo({ x: 0, animated: !reduced }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selected, order, reduced]);
  return (
    <View
      testID="beacon-activity-subtabs"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ position: "relative" }}
    >
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel="Beacon tools"
        onContentSizeChange={(value) => setContentWidth(value)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 4,
          alignItems: "center",
        }}
      >
        {tools.map((tool) => {
          const Icon = icons[tool];
          const active = tool === selected;
          const label = tool === "checklist" ? checklistLabel : labels[tool];
          return (
            <Pressable
              key={tool}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => onSelect(tool)}
              style={{
                minHeight: 44,
                paddingHorizontal: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: active ? colors.green + "70" : "transparent",
                backgroundColor: active
                  ? colors.green + "12"
                  : colors.muted + "08",
              }}
            >
              <Icon size={14} color={active ? colors.green : colors.muted} />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { fontSize: 11, color: active ? colors.green : colors.muted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {([offset > 2, offset + width < contentWidth - 2] as const).map(
        (visible, index) =>
          visible && (
            <View
              key={index}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 18,
                ...(index ? { right: 0 } : { left: 0 }),
              }}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient
                    id={`edge${index}`}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <Stop
                      offset="0"
                      stopColor={colors.white}
                      stopOpacity={index ? 0 : 1}
                    />
                    <Stop
                      offset="1"
                      stopColor={colors.white}
                      stopOpacity={index ? 1 : 0}
                    />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#edge${index})`} />
              </Svg>
            </View>
          ),
      )}
    </View>
  );
}
