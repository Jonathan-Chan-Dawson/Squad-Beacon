import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Compass, Search, SlidersHorizontal, X } from "lucide-react-native";
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
        minHeight: 44,
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
  query,
  onQueryChange,
  onQuerySubmit,
  onCompass,
  onQuickFilter,
  selectedQuickFilter,
  onOpenFilters,
  activeFilterCount,
  activeChips,
  onRemoveChip,
  searchAreaState,
  searchAreaCount,
  onSearchThisArea,
  searchAreaVisible,
  onSearchFocus,
  sharingIndicator,
  loading,
  onHeightChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit: (value: string) => void;
  onCompass: () => void;
  onQuickFilter: (filter: MapQuickFilter) => void;
  selectedQuickFilter: MapQuickFilter | null;
  onOpenFilters: () => void;
  activeFilterCount: number;
  activeChips: ActiveMapFilterChip[];
  onRemoveChip: (key: string) => void;
  searchAreaState: "idle" | "loading" | "count";
  searchAreaCount: number;
  searchAreaVisible: boolean;
  onSearchThisArea: () => void;
  onSearchFocus: () => void;
  sharingIndicator?: React.ReactNode;
  loading?: boolean;
  onHeightChange: (height: number) => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [railLayouts, setRailLayouts] = useState<
    Partial<Record<MapQuickFilter, { x: number; width: number }>>
  >({});
  const [indicatorX] = useState(() => new Animated.Value(0));
  const [indicatorWidth] = useState(() => new Animated.Value(0));
  const [areaAnimation] = useState(() => new Animated.Value(0));
  const [shimmerProgress] = useState(() => new Animated.Value(0));
  const [railWidth, setRailWidth] = useState(0);
  const quickFilters: MapQuickFilter[] = ["All", "Friends", "Squads", "Public", "Now"];

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
  }, [indicatorWidth, indicatorX, railLayouts, reducedMotion, selectedQuickFilter]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    areaAnimation.stopAnimation();
    if (!searchAreaVisible) {
      areaAnimation.setValue(0);
      return;
    }
    if (reducedMotion) {
      areaAnimation.setValue(1);
      return;
    }
    areaAnimation.setValue(0);
    const entrance = Animated.spring(areaAnimation, {
      toValue: 1,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [areaAnimation, reducedMotion, searchAreaVisible]);

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
      style={{ width: "100%", gap: 6, paddingHorizontal: 12 }}
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
            accessibilityLabel="Search Beacons, People, and places"
            placeholder="Search Beacons, people, places"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={onQueryChange}
            onFocus={onSearchFocus}
            onSubmitEditing={({ nativeEvent }) => onQuerySubmit(nativeEvent.text)}
            returnKeyType="search"
            style={{
              flex: 1,
              minWidth: 0,
              height: 46,
              color: colors.ink,
              fontSize: 14,
              paddingVertical: 8,
              outlineStyle: "none",
            } as never}
          />
        </GlassBar>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compass"
          onPress={onCompass}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white + "E8",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Compass size={19} color={colors.green} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View
          onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
          style={{ flex: 1, minWidth: 0, height: 44, position: "relative", overflow: "hidden" }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1, minWidth: 0, height: 44, overflow: "hidden" }}
            contentContainerStyle={{ alignItems: "center", gap: 3, minHeight: 42 }}
          >
          <View pointerEvents="none" style={{ position: "absolute", top: 1, bottom: 1, left: 0, right: 0 }}>
            {selectedQuickFilter ? (
              <Animated.View
                style={{
                  position: "absolute",
                  top: 1,
                  left: indicatorX,
                  width: indicatorWidth,
                  height: 44,
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
                setRailLayouts((current) => ({ ...current, [label]: { x, width } }));
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
                transform: [{ translateX: shimmerProgress.interpolate({ inputRange: [0, 1], outputRange: [-64, railWidth + 16] }) }],
              }}
            />
          ) : null}
        </View>
        <Pressable
          testID="map-filter-toggle"
          accessibilityRole="button"
          accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
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
              <Text style={{ color: colors.white, fontSize: 10, fontWeight: "800" }}>
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
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>
                {chip.label}
              </Text>
              <X size={13} color={colors.muted} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {sharingIndicator}

      {searchAreaVisible ? (() => {
        const action = (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search this area"
            accessibilityState={{ busy: searchAreaState === "loading" }}
            onPress={onSearchThisArea}
            disabled={searchAreaState === "loading"}
            hitSlop={10}
            style={{
              minHeight: 44,
              zIndex: 31,
              elevation: 31,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 14,
              borderRadius: 19,
              backgroundColor: colors.ink,
              opacity: searchAreaState === "loading" ? 0.9 : 1,
            }}
          >
            {searchAreaState === "loading" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : null}
            <Text style={{ color: colors.white, fontSize: 13, fontWeight: "700" }}>
              {searchAreaState === "loading"
                ? "Searching this area"
                : searchAreaState === "count"
                  ? `${searchAreaCount} Beacons here`
                  : "Search this area"}
            </Text>
          </Pressable>
        );
        const wrapperStyle = {
          position: "relative" as const,
          zIndex: 30,
          elevation: 30,
          minHeight: 44,
          alignItems: "center" as const,
        };
        return Platform.OS === "web" ? (
          <View style={wrapperStyle}>{action}</View>
        ) : (
          <Animated.View
            style={[
              wrapperStyle,
              {
                opacity: areaAnimation,
                transform: [{
                  translateY: areaAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-7, 0],
                  }),
                }],
              },
            ]}
          >
            {action}
          </Animated.View>
        );
      })() : null}
    </View>
  );
}
