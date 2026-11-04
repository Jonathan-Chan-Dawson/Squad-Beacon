import { focusOverlay } from "@/src/shared/overlayFocus";
import React, { useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BookOpen,
  Dumbbell,
  Gamepad2,
  Palette,
  Coffee,
  Sparkles,
  Users,
  Star,
  List,
  Check,
  ChevronDown,
  Dices,
  MapPinned,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react-native";
import { useDesignTheme } from "@/src/theme";
import { GlassBar } from "@/src/shared/design-system";
import { useTheme } from "@/src/shared/ui";
import type { Category } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";
import {
  BEACON_CATEGORIES,
  selectedBeaconCategories,
  wantsHappeningNow,
} from "@/src/shared/explorationFilters";
import { MapControlPopover } from "./MapControlPopover";

export type MapQuickFilter = "All" | "Friends" | "Now";
export type ActiveMapFilterChip = { key: string; label: string };
export type DiscoveryMenu = "friends" | "interests" | null;
export type FriendScopeChoice = {
  id: NonNullable<ExplorationFilters["friendScope"]>;
  label: string;
};

export function MapExplorationHeader({
  areaLabel,
  onBackNearMe,
  query,
  onQueryChange,
  onQuerySubmit,
  onQuickFilter,
  filters,
  friendLabel,
  friendChoices,
  onFriendScopeChange,
  onCategoriesChange,
  onPersonalizedChange,
  hasProfileInterests,
  menu,
  onMenuChange,
  onSurprise,
  surpriseDisabled,
  surpriseBusy,
  onOpenFilters,
  activeFilterCount,
  activeChips,
  onRemoveChip,
  onClearContexts,
  onSearchFocus,
  onExploreArea,
  sharingIndicator,
  loading,
  calm = false,
  onHeightChange,
}: {
  areaLabel?: string;
  onBackNearMe?: () => void;
  query: string;
  onQueryChange(value: string): void;
  onQuerySubmit(value: string): void;
  onQuickFilter(filter: MapQuickFilter): void;
  filters: ExplorationFilters;
  friendLabel: string;
  friendChoices: FriendScopeChoice[];
  onFriendScopeChange(scope: ExplorationFilters["friendScope"]): void;
  onCategoriesChange(categories: Category[]): void;
  onPersonalizedChange(value: boolean): void;
  hasProfileInterests: boolean;
  menu: DiscoveryMenu;
  onMenuChange(value: DiscoveryMenu): void;
  onSurprise(eventTime: number): void;
  surpriseDisabled?: string;
  surpriseBusy?: boolean;
  onOpenFilters(): void;
  activeFilterCount: number;
  activeChips: ActiveMapFilterChip[];
  onRemoveChip(key: string): void;
  onClearContexts?: () => void;
  onSearchFocus(): void;
  onExploreArea(): void;
  sharingIndicator?: React.ReactNode;
  loading?: boolean;
  calm?: boolean;
  onHeightChange(height: number): void;
}) {
  const { colors } = useTheme();
  const categoryTokens = useDesignTheme().categories;
  const categoryIcons = {
    Study: BookOpen,
    Fitness: Dumbbell,
    Gaming: Gamepad2,
    Creative: Palette,
    Social: Coffee,
    Other: Sparkles,
  };
  const size = useWindowDimensions();
  const friendsAnchor = useRef<View>(null),
    interestsAnchor = useRef<View>(null);
  const menuContent = useRef<View>(null);
  const [anchor, setAnchor] = useState({ x: 16, y: 100 });
  const categories = selectedBeaconCategories(filters);
  const nowSelected = wantsHappeningNow(filters);
  const forMe = hasProfileInterests && filters.personalizedRanking !== false;
  function closeMenu() {
    const ref = menu === "friends" ? friendsAnchor : interestsAnchor;
    onMenuChange(null);
    requestAnimationFrame(() => {
      if (Platform.OS === "web") {
        const trigger = ref.current as unknown as HTMLElement | null;
        trigger?.focus({ preventScroll: true });
        trigger?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
      }
    });
  }
  function openMenu(next: Exclude<DiscoveryMenu, null>) {
    if (next === menu) {
      closeMenu();
      return;
    }
    const ref = next === "friends" ? friendsAnchor : interestsAnchor;
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x: x + width, y: y + height + 6 });
      onMenuChange(next);
    });
  }
  const chipStyle = (_selected: boolean) => ({
    minHeight: 44,
    flexShrink: 0 as const,
    paddingHorizontal: 8,
    justifyContent: "center" as const,
  });
  const iconStyle = (selected: boolean) => ({
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: selected ? colors.primary : colors.outline,
    backgroundColor: selected
      ? colors.primaryContainer + "EB"
      : colors.surface + "DF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0 as const,
  });
  const tooltip = (title: string) =>
    Platform.OS === "web"
      ? {
          ref: (node: View | null) =>
            (node as unknown as HTMLElement | null)?.setAttribute(
              "title",
              title,
            ),
        }
      : {};
  const menuWidth = Math.min(288, size.width - 32);
  const menuHeight = Math.min(430, Math.max(180, size.height - anchor.y - 20));
  return (
    <View
      testID="map-exploration-header"
      pointerEvents="box-none"
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
      style={{
        width: "100%",
        gap: 2,
        paddingHorizontal: size.width < 360 ? 8 : 16,
      }}
    >
      <GlassBar
        style={{
          height: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingLeft: 14,
          paddingRight: 2,
          borderRadius: 24,
        }}
      >
        <Search size={18} color={colors.primary} />
        <TextInput
          accessibilityLabel="Search places, Beacons, people and communities"
          placeholder="Search Beacons, people, places..."
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
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore area"
          onPress={onExploreArea}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 1,
            borderLeftColor: colors.outline,
          }}
        >
          <MapPinned size={18} color={colors.primary} />
        </Pressable>
      </GlassBar>
      <View
        testID="map-discovery-controls"
        accessibilityState={{ busy: loading }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          opacity: calm ? 0.65 : 1,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, minWidth: 0 }}
          contentContainerStyle={{
            gap: 4,
            alignItems: "center",
            minHeight: 44,
          }}
          onScrollBeginDrag={() => onMenuChange(null)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="All"
            accessibilityHint="Clear Friends and category restrictions; retain time and advanced filters"
            accessibilityState={{
              selected: !filters.friendScope && !categories.length,
            }}
            aria-pressed={!filters.friendScope && !categories.length}
            onPress={() => onQuickFilter("All")}
            style={chipStyle(!filters.friendScope && !categories.length)}
          >
            <Text
              style={{
                color:
                  !filters.friendScope && !categories.length
                    ? colors.primary
                    : colors.ink,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              All
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: "row",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                friendLabel ? `Friends, ${friendLabel}` : "Friends"
              }
              accessibilityState={{ selected: !!filters.friendScope }}
              aria-pressed={!!filters.friendScope}
              onPress={() => onQuickFilter("Friends")}
              style={{
                minHeight: 44,
                paddingLeft: 12,
                paddingRight: 3,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: filters.friendScope ? colors.primary : colors.ink,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Friends
              </Text>
            </Pressable>
            <Pressable
              ref={friendsAnchor}
              accessibilityRole="button"
              accessibilityLabel="Choose Friends filter"
              accessibilityState={{ expanded: menu === "friends" }}
              onPress={() => openMenu("friends")}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronDown
                size={15}
                color={filters.friendScope ? colors.primary : colors.ink}
              />
            </Pressable>
          </View>
          <Pressable
            ref={interestsAnchor}
            accessibilityRole="button"
            accessibilityLabel={`Interests${categories.length ? `, ${categories.length} categories` : ""}, For Me ranking ${forMe ? "on" : "off"}`}
            accessibilityState={{
              expanded: menu === "interests",
              selected: !!categories.length,
            }}
            aria-expanded={menu === "interests"}
            onPress={() => openMenu("interests")}
            style={{
              ...chipStyle(!!categories.length),
              paddingHorizontal: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Text
              style={{
                color: categories.length ? colors.primary : colors.ink,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              Interests
            </Text>
            {!!categories.length && (
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {categories.length}
              </Text>
            )}
            <ChevronDown
              size={12}
              color={categories.length ? colors.primary : colors.ink}
            />
          </Pressable>
        </ScrollView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingRight: 5,
            flexShrink: 0,
          }}
        >
          <Pressable
            {...tooltip(surpriseDisabled ?? "Surprise Me")}
            testID="map-surprise"
            accessibilityRole="button"
            accessibilityLabel="Surprise Me"
            accessibilityHint={
              surpriseDisabled ?? "Discover a matching Beacon in this area"
            }
            accessibilityState={{
              disabled: !!surpriseDisabled || !!surpriseBusy,
              busy: !!surpriseBusy,
            }}
            disabled={!!surpriseDisabled || !!surpriseBusy}
            onPress={() => onSurprise(Date.now())}
            style={{
              ...iconStyle(false),
              opacity: surpriseDisabled || surpriseBusy ? 0.5 : 1,
            }}
          >
            <Dices size={19} color={colors.success} />
          </Pressable>
          <Pressable
            {...tooltip("Happening now")}
            testID="map-now"
            accessibilityRole="button"
            accessibilityLabel="Happening now"
            accessibilityState={{ selected: nowSelected }}
            aria-pressed={nowSelected}
            onPress={() => onQuickFilter("Now")}
            style={{
              ...iconStyle(nowSelected),
              borderColor: nowSelected ? "#F3C917" : colors.outline,
              backgroundColor: nowSelected
                ? "#F3C91730"
                : colors.surface + "DF",
            }}
          >
            <Zap
              size={18}
              color="#E9B900"
              fill={nowSelected ? "#F3C917" : "none"}
            />
          </Pressable>
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
              ...iconStyle(false),
            }}
          >
            <SlidersHorizontal size={15} color={colors.primary} />
            {!!activeFilterCount && (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -6,
                  borderRadius: 9,
                  minWidth: 22,
                  paddingHorizontal: 4,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.onPrimary, fontSize: 10 }}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      {menu && (
        <Modal
          transparent
          visible
          accessibilityLabel={
            menu === "friends" ? "Friends filters" : "Interests filters"
          }
          onShow={() =>
            focusOverlay(
              menuContent,
              menu === "friends" ? "All Friends" : BEACON_CATEGORIES[0],
            )
          }
          animationType="none"
          onRequestClose={closeMenu}
        >
          <View style={{ flex: 1 }} accessibilityViewIsModal>
            <Pressable
              testID="map-discovery-menu-backdrop"
              accessibilityLabel="Dismiss discovery menu"
              onPress={closeMenu}
              style={{ position: "absolute", inset: 0 }}
            />
            <View
              ref={menuContent}
              accessibilityRole="none"
              style={{ position: "absolute", inset: 0 }}
              pointerEvents="box-none"
            >
              <MapControlPopover
                title={menu === "friends" ? "Friends" : "Interests"}
                onClose={closeMenu}
                width={menuWidth}
                maxHeight={menuHeight}
                top={Math.min(anchor.y, size.height - menuHeight - 12)}
                right={Math.max(
                  16,
                  Math.min(size.width - menuWidth - 16, size.width - anchor.x),
                )}
              >
                {menu === "friends" ? (
                  friendChoices.map((choice) => (
                    <Pressable
                      key={choice.id}
                      accessibilityRole="radio"
                      accessibilityLabel={choice.label}
                      accessibilityState={{
                        checked: filters.friendScope === choice.id,
                      }}
                      aria-checked={filters.friendScope === choice.id}
                      onPress={() => {
                        onFriendScopeChange(choice.id);
                        closeMenu();
                      }}
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 8,
                      }}
                    >
                      {React.createElement(
                        choice.id === "friends"
                          ? Users
                          : choice.id === "favorites"
                            ? Star
                            : List,
                        {
                          size: 18,
                          color:
                            choice.id === "favorites"
                              ? colors.warning
                              : colors.primary,
                        },
                      )}
                      <Text
                        style={{
                          color: colors.ink,
                          flex: 1,
                          marginLeft: 10,
                          fontSize: 13,
                        }}
                      >
                        {choice.label}
                      </Text>
                      {filters.friendScope === choice.id && (
                        <Check size={17} color={colors.primary} />
                      )}
                    </Pressable>
                  ))
                ) : (
                  <>
                    {BEACON_CATEGORIES.map((category) => (
                      <Pressable
                        key={category}
                        accessibilityRole="checkbox"
                        accessibilityLabel={category}
                        accessibilityState={{
                          checked: categories.includes(category),
                        }}
                        aria-checked={categories.includes(category)}
                        onPress={() =>
                          onCategoriesChange(
                            categories.includes(category)
                              ? categories.filter((c) => c !== category)
                              : [...categories, category],
                          )
                        }
                        style={{
                          minHeight: 44,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 8,
                        }}
                      >
                        {React.createElement(categoryIcons[category], {
                          size: 18,
                          color: categoryTokens[category].color,
                        })}
                        <Text
                          style={{
                            color: colors.ink,
                            flex: 1,
                            marginLeft: 10,
                            fontSize: 13,
                          }}
                        >
                          {category}
                        </Text>
                        {categories.includes(category) && (
                          <Check size={17} color={colors.primary} />
                        )}
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="For Me"
                      accessibilityState={{
                        checked: forMe,
                        disabled: !hasProfileInterests,
                      }}
                      aria-checked={forMe}
                      disabled={!hasProfileInterests}
                      onPress={() => onPersonalizedChange(!forMe)}
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 8,
                        opacity: hasProfileInterests ? 1 : 0.55,
                      }}
                    >
                      <Sparkles size={18} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.ink,
                          flex: 1,
                          marginLeft: 10,
                          fontSize: 13,
                        }}
                      >
                        For Me
                      </Text>
                      {forMe && <Check size={17} color={colors.primary} />}
                    </Pressable>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        paddingHorizontal: 8,
                      }}
                    >
                      {hasProfileInterests
                        ? "Prioritize your interests while keeping other eligible Beacons."
                        : "Add profile interests to enable For Me. You can still browse categories."}
                    </Text>
                  </>
                )}
              </MapControlPopover>
            </View>
          </View>
        </Modal>
      )}
      {[false, true].map((contextRail) =>
        activeChips.some(
          (chip) => chip.key.startsWith("context:") === contextRail,
        ) ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 1 }}
            key={String(contextRail)}
            accessibilityLabel={contextRail ? "Map focus" : "Active filters"}
          >
            {activeChips
              .filter((chip) => chip.key.startsWith("context:") === contextRail)
              .map((chip) => (
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
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {chip.label}
                  </Text>
                  <X size={13} color={colors.muted} />
                </Pressable>
              ))}
            {contextRail && onClearContexts ? (
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
        ) : null,
      )}

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
