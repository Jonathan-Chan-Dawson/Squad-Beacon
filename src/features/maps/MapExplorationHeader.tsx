import React, { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  BookOpen,
  Coffee,
  Compass,
  Dumbbell,
  Gamepad2,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import type { Category } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";
import { explorationFilterCount } from "@/src/features/maps/filtering";
import type { LayoutChangeEvent } from "react-native";

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
const quickTimes = ["Any", "Today", "Tonight", "Tomorrow", "Weekend"] as const;
const quickJoins = ["Any", "Open", "Needs People", "I'm In"] as const;
const categoryIcons = {
  Fitness: Dumbbell,
  Study: BookOpen,
  Gaming: Gamepad2,
  Creative: Palette,
  Social: Coffee,
  Other: Sparkles,
};

function Pill({
  label,
  selected,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 13,
        borderRadius: 22,
        justifyContent: "center",
        backgroundColor: selected ? colors.ink : colors.white + "F2",
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.line,
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
    </Pressable>
  );
}

export function MapExplorationHeader({
  query,
  onQueryChange,
  areaLabel,
  resultCount,
  planCount,
  filters,
  onFiltersChange,
  squadAudienceId,
  onCompass,
  onViewBeacons,
  onOpenSquads,
  onMoreFilters,
  trayOpen,
  onTrayOpenChange,
  onSearchFocus,
  searchThisArea,
  onSearchThisArea,
  onHeightChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  areaLabel: string;
  squadAudienceId?: string;
  resultCount: number;
  planCount: number;
  filters: ExplorationFilters;
  onFiltersChange: (filters: ExplorationFilters) => void;
  onCompass: () => void;
  onViewBeacons: () => void;
  onOpenSquads: () => void;
  onMoreFilters: () => void;
  trayOpen: boolean;
  onTrayOpenChange: (open: boolean) => void;
  onSearchFocus: () => void;
  searchThisArea: boolean;
  onSearchThisArea: () => void;
  onHeightChange: (height: number) => void;
}) {
  const { colors, styles } = useTheme();
  const reducedMotion = useReducedMotion();
  const [animation] = useState(() => new Animated.Value(0));
  const count = explorationFilterCount(filters);
  useEffect(() => {
    Animated.timing(animation, {
      toValue: trayOpen ? 1 : 0,
      duration: reducedMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [animation, reducedMotion, trayOpen]);
  function patch(values: Partial<ExplorationFilters>) {
    onFiltersChange({ ...filters, ...values });
  }
  const selectedWhen = filters.when ?? "Any";
  const selectedJoin = filters.join ?? "Any";
  const nowSelected = filters.time === "Now";
  const anyExtra =
    filters.category !== "All categories" ||
    filters.audience !== "Everyone" ||
    !!filters.planId ||
    (!!filters.when && filters.when !== "Any") ||
    (!!filters.join && filters.join !== "Any") ||
    (!!filters.format && filters.format !== "Any") ||
    filters.starredOnly === true;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) =>
        onHeightChange(event.nativeEvent.layout.height)
      }
      testID="map-exploration-header"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 12,
        gap: 7,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingHorizontal: 13,
            borderRadius: 17,
            backgroundColor: colors.white + "F5",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Search size={18} color={colors.green} />
          <TextInput
            accessibilityLabel="Search Beacons, People, and places"
            placeholder="Search Beacons, People, and places"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={onQueryChange}
            onFocus={onSearchFocus}
            returnKeyType="search"
            style={
              {
                flex: 1,
                minWidth: 0,
                color: colors.ink,
                fontSize: 14,
                paddingVertical: 8,
                outlineStyle: "none",
              } as never
            }
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compass"
          onPress={onCompass}
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white + "F5",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Compass size={20} color={colors.green} />
        </Pressable>
      </View>
      <View
        testID="map-area-context"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          minHeight: 36,
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 13,
          backgroundColor: colors.white + "E8",
          borderWidth: 1,
          borderColor: colors.line + "B8",
        }}
      >
        <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
          {areaLabel} · {resultCount} Beacons
          {planCount ? ` · ${planCount} Plans` : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View beacons"
          onPress={onViewBeacons}
          style={{
            minWidth: 39,
            height: 36,
            paddingHorizontal: 8,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white + "F5",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text
            style={{ color: colors.green, fontSize: 12, fontWeight: "700" }}
          >
            List
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ScrollView
          style={{ flex: 1, minWidth: 0 }}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 1 }}
        >
          <Pill
            label="All"
            selected={
              filters.audience === "Everyone" && !nowSelected && !anyExtra
            }
            onPress={() =>
              patch({
                audience: "Everyone",
                time: "All",
                category: "All categories",
                planId: null,
                when: "Any",
                join: "Any",
                format: "Any",
                starredOnly: false,
              })
            }
          />
          <Pill
            label="Friends"
            selected={filters.audience === "Friends"}
            onPress={() =>
              patch({
                audience:
                  filters.audience === "Friends" ? "Everyone" : "Friends",
              })
            }
          />
          <Pill
            label="Squads"
            selected={filters.audience === squadAudienceId && !!squadAudienceId}
            onPress={onOpenSquads}
          />
          <Pill
            label="Public"
            selected={filters.audience === "Public"}
            onPress={() =>
              patch({
                audience: filters.audience === "Public" ? "Everyone" : "Public",
              })
            }
          />
          <Pill
            label="Now"
            selected={nowSelected}
            onPress={() =>
              patch({ time: nowSelected ? "All" : "Now", when: "Any" })
            }
          />
        </ScrollView>
        <Pill
          testID="map-filter-toggle"
          label={count ? `Filters ${count}` : "Filters"}
          accessibilityLabel="Filters"
          selected={trayOpen}
          onPress={() => onTrayOpenChange(!trayOpen)}
        />
      </View>
      {trayOpen ? (
        <Animated.View
          testID="map-filter-tray"
          style={{
            opacity: animation,
            transform: [
              {
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-5, 0],
                }),
              },
            ],
            padding: 10,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white + "F8",
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.label}>WHEN</Text>
            <ScrollView
              style={{ flex: 1, minWidth: 0 }}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 5 }}
            >
              {quickTimes.map((value) => (
                <Pill
                  key={value}
                  label={value}
                  selected={selectedWhen === value}
                  onPress={() =>
                    patch({
                      when: value,
                      time:
                        value === "Any" || filters.time === "Now"
                          ? "All"
                          : filters.time,
                    })
                  }
                />
              ))}
            </ScrollView>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 5 }}
          >
            {categories.map((value) => {
              const Icon = categoryIcons[value];
              const selected = filters.category === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={value}
                  accessibilityState={{ selected }}
                  onPress={() =>
                    patch({ category: selected ? "All categories" : value })
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    minHeight: 44,
                    paddingHorizontal: 11,
                    borderRadius: 22,
                    backgroundColor: selected ? colors.ink : colors.white,
                    borderColor: selected ? colors.ink : colors.line,
                    borderWidth: 1,
                  }}
                >
                  <Icon
                    size={14}
                    color={selected ? colors.white : colors.green}
                  />
                  <Text
                    style={{
                      color: selected ? colors.white : colors.ink,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.label}>JOIN</Text>
            <ScrollView
              style={{ flex: 1, minWidth: 0 }}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 5 }}
            >
              {quickJoins.map((value) => (
                <Pill
                  key={value}
                  label={value}
                  selected={selectedJoin === value}
                  onPress={() => patch({ join: value })}
                />
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More Filters"
              onPress={onMoreFilters}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                borderRadius: 15,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <SlidersHorizontal size={15} color={colors.green} />
              <Text
                style={{ color: colors.green, fontSize: 10, fontWeight: "700" }}
              >
                More
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 7,
            }}
          >
            <Text style={[styles.muted, { flex: 1 }]}>
              {count
                ? `${count} filters active`
                : "Showing all readable Beacons"}
            </Text>
            {searchThisArea ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search this area"
                onPress={onSearchThisArea}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 15,
                  backgroundColor: colors.ink,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Search this area
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : searchThisArea ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search this area"
          onPress={onSearchThisArea}
          style={{
            alignSelf: "center",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 16,
            backgroundColor: colors.ink,
          }}
        >
          <Text
            style={{ color: colors.white, fontWeight: "700", fontSize: 12 }}
          >
            Search this area
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
