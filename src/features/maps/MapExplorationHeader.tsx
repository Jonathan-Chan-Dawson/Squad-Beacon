import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { GlassBar } from "@/src/shared/design-system";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useTheme } from "@/src/shared/ui";

export type MapQuickFilter = "All" | "Friends" | "Squads" | "Public" | "Now";
export type ActiveMapFilterChip = { key: string; label: string };

function QuickChip({
  label,
  selected,
  onPress,
  onLayout,
}: {
  label: MapQuickFilter;
  selected: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLayout={onLayout}
      style={{
        minHeight: 42,
        flexShrink: 0,
        justifyContent: "center",
        paddingHorizontal: 13,
        borderRadius: 20,
        zIndex: 1,
      }}
    >
      <Text
        style={{
          color: selected ? colors.white : colors.ink,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </MotionPressable>
  );
}

export function MapExplorationHeader({
  areaLabel,
  onBackNearMe,
  query,
  onQueryChange,
  onQuerySubmit,
  onQuickFilter,
  selectedQuickFilter,
  onOpenFilters,
  activeFilterCount,
  activeChips,
  onRemoveChip,
  onClearContexts,
  onSearchFocus,
  sharingIndicator,
  loading,
  calm = false,
  onHeightChange,
}: {
  areaLabel?: string;
  onBackNearMe?: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit: (value: string) => void;
  onQuickFilter: (filter: MapQuickFilter) => void;
  selectedQuickFilter: MapQuickFilter | null;
  onOpenFilters: () => void;
  activeFilterCount: number;
  activeChips: ActiveMapFilterChip[];
  onRemoveChip: (key: string) => void;
  onClearContexts?: () => void;
  onSearchFocus: () => void;
  sharingIndicator?: React.ReactNode;
  loading?: boolean;
  calm?: boolean;
  onHeightChange: (height: number) => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [railLayouts, setRailLayouts] = useState<
    Partial<Record<MapQuickFilter, { x: number; width: number }>>
  >({});
  const [indicatorX] = useState(() => new Animated.Value(0));
  const [indicatorWidth] = useState(() => new Animated.Value(0));
  const [shimmerProgress] = useState(() => new Animated.Value(0));
  const [railWidth, setRailWidth] = useState(0);
  const quickFilters: MapQuickFilter[] = [
    "All",
    "Friends",
    "Squads",
    "Public",
    "Now",
  ];

  useEffect(() => {
    if (!selectedQuickFilter) return;
    const layout = railLayouts[selectedQuickFilter];
    if (!layout) return;
    if (reducedMotion) {
      indicatorX.setValue(layout.x);
      indicatorWidth.setValue(layout.width);
      return;
    }
    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: layout.x,
        damping: 22,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: false,
      }),
      Animated.spring(indicatorWidth, {
        toValue: layout.width,
        damping: 22,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    indicatorWidth,
    indicatorX,
    railLayouts,
    reducedMotion,
    selectedQuickFilter,
  ]);

  useEffect(() => {
    if (!loading || reducedMotion || railWidth === 0) {
      shimmerProgress.stopAnimation();
      shimmerProgress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1250,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [loading, railWidth, reducedMotion, shimmerProgress]);

  return (
    <View
      testID="map-exploration-header"
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
      style={{ width: "100%", gap: 6, paddingHorizontal: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <GlassBar
          style={{
            height: 48,
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingLeft: 14,
            paddingRight: 2,
            borderRadius: 24,
          }}
        >
          <Search size={18} color={colors.green} />
          <TextInput
            accessibilityLabel="Search places, Beacons, people and communities"
            placeholder="Search Beacons, people, places..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={onQueryChange}
            onFocus={onSearchFocus}
            onSubmitEditing={({ nativeEvent }) =>
              onQuerySubmit(nativeEvent.text)
            }
            returnKeyType="search"
            style={
              {
                flex: 1,
                minWidth: 0,
                height: 46,
                color: colors.ink,
                fontSize: 14,
                paddingVertical: 8,
                outlineStyle: "none",
              } as never
            }
          />
        </GlassBar>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          opacity: calm ? 0.65 : 1,
          transform: reducedMotion ? [] : [{ scaleY: calm ? 0.92 : 1 }],
        }}
      >
        <View
          onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 48,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1, minWidth: 0, height: 48, overflow: "hidden" }}
            contentContainerStyle={{
              alignItems: "center",
              gap: 3,
              minHeight: 44,
              paddingHorizontal: 2,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 1,
                bottom: 1,
                left: 0,
                right: 0,
              }}
            >
              {selectedQuickFilter ? (
                <Animated.View
                  style={{
                    position: "absolute",
                    top: 1,
                    left: indicatorX,
                    width: indicatorWidth,
                    height: 42,
                    borderRadius: 20,
                    backgroundColor: colors.green,
                  }}
                />
              ) : null}
            </View>
            {quickFilters.map((label) => (
              <QuickChip
                key={label}
                label={label}
                selected={selectedQuickFilter === label}
                onPress={() => onQuickFilter(label)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setRailLayouts((current) => ({
                    ...current,
                    [label]: { x, width },
                  }));
                }}
              />
            ))}
          </ScrollView>
          {loading ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 5,
                bottom: 5,
                width: 54,
                borderRadius: 16,
                backgroundColor: colors.white,
                opacity: reducedMotion ? 0.1 : 0.17,
                transform: [
                  {
                    translateX: shimmerProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-64, railWidth + 16],
                    }),
                  },
                ],
              }}
            />
          ) : null}
        </View>
        <Pressable
          testID="map-filter-toggle"
          accessibilityRole="button"
          accessibilityLabel={
            activeFilterCount
              ? `Filters, ${activeFilterCount} active`
              : "Filters"
          }
          onPress={onOpenFilters}
          style={{
            minHeight: 44,
            minWidth: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingHorizontal: 10,
            borderRadius: 21,
            backgroundColor: colors.white + "ED",
            borderColor: colors.line,
            borderWidth: 1,
          }}
        >
          <SlidersHorizontal size={15} color={colors.green} />
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>
            Filters
          </Text>
          {activeFilterCount ? (
            <View
              accessibilityLabel={`${activeFilterCount} active filters`}
              style={{
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.green,
              }}
            >
              <Text
                style={{ color: colors.white, fontSize: 10, fontWeight: "800" }}
              >
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {activeChips.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 1 }}
          accessibilityLabel="Active filters"
        >
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${chip.label} filter`}
              onPress={() => onRemoveChip(chip.key)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white + "E6",
              }}
            >
              <Text
                style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}
              >
                {chip.label}
              </Text>
              <X size={13} color={colors.muted} />
            </Pressable>
          ))}
          {onClearContexts ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all context filters"
              onPress={onClearContexts}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 10,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Clear contexts
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {areaLabel && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: colors.white + "ED",
          }}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: colors.ink, fontSize: 12 }}
          >
            Exploring {areaLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back Near Me"
            onPress={onBackNearMe}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{ color: colors.green, fontWeight: "700", fontSize: 12 }}
            >
              Back Near Me
            </Text>
          </Pressable>
        </View>
      )}
      {sharingIndicator}
    </View>
  );
}
