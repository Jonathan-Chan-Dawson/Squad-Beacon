import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Dumbbell,
  Gamepad2,
  Palette,
  Sparkles,
  Users,
  CalendarDays,
  UserRoundCheck,
  ListChecks,
} from "lucide-react-native";
import type { Category } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";
import { Button, Field, Sheet, useTheme } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/theme";
import { SecondaryButton, uiHaptics } from "@/src/shared/design-system";
import { mapAdvancedFilterCount } from "@/src/features/maps/mapUIselectors";

export type MapAudienceChoice = {
  id: string;
  label: string;
  kind: "List" | "Squad" | "Organization";
};

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
const whens = ["Any", "Today", "Tonight", "Tomorrow", "Weekend"] as const;
const joins = ["Any", "Open", "Needs People", "I'm In"] as const;
const moreJoins = ["Request Approval", "Invited", "Spots Available"] as const;
const formats = ["Any", "Physical", "Virtual"] as const;
const categoryIcons = {
  Fitness: Dumbbell,
  Study: BookOpen,
  Gaming: Gamepad2,
  Creative: Palette,
  Social: Coffee,
  Other: Sparkles,
};

function RowChoice({
  label,
  description,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: selected ? colors.lime + "66" : "transparent",
      }}
    >
      {Icon ? (
        <Icon size={17} color={selected ? colors.green : colors.muted} />
      ) : (
        <View style={{ width: 17 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{label}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      {selected ? <Check size={17} color={colors.green} /> : null}
    </Pressable>
  );
}

function FilterRadio({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1.5,
          borderColor: selected ? colors.green : colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.green,
            }}
          />
        )}
      </View>
      <Text
        style={[
          styles.body,
          {
            flex: 1,
            fontSize: 14,
            color: selected ? colors.green : colors.ink,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  children: React.ReactNode;
}) {
  const { colors, styles } = useTheme();
  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View
        style={{
          minHeight: 28,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon size={17} color={colors.green} />
        <Text style={styles.label}>{title.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

export function AdvancedMapFilters({
  visible,
  onClose,
  filters,
  onChange,
  audiences,
  planOptions,
  resultCount,
  selectedCategories,
  onCategoriesChange,
}: {
  visible: boolean;
  onClose: () => void;
  filters: ExplorationFilters;
  onChange: (filters: ExplorationFilters) => void;
  audiences: MapAudienceChoice[];
  planOptions: { id: string; label: string }[];
  resultCount: number;
  selectedCategories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}) {
  const { colors, styles } = useTheme();
  const { categories: categoryTokens } = useDesignTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [audienceQuery, setAudienceQuery] = useState("");
  const [planQuery, setPlanQuery] = useState("");
  const visibleAudiences = useMemo(
    () =>
      audiences.filter((choice) =>
        choice.label.toLowerCase().includes(audienceQuery.trim().toLowerCase()),
      ),
    [audiences, audienceQuery],
  );
  const visiblePlans = useMemo(
    () =>
      planOptions.filter((choice) =>
        choice.label.toLowerCase().includes(planQuery.trim().toLowerCase()),
      ),
    [planOptions, planQuery],
  );
  const activeCount = mapAdvancedFilterCount(filters, selectedCategories);

  function patch(values: Partial<ExplorationFilters>) {
    onChange({ ...filters, ...values });
  }
  function reset() {
    onChange({
      audience: "Everyone",
      category: "All categories",
      time: "All",
      planId: null,
      when: "Any",
      join: "Any",
      format: "Any",
      starredOnly: false,
    });
    onCategoriesChange([]);
  }
  function toggleCategory(category: Category) {
    uiHaptics.light();
    onCategoriesChange(
      selectedCategories.includes(category)
        ? selectedCategories.filter((value) => value !== category)
        : [...selectedCategories, category],
    );
    // The shared model remains scalar for older consumers; the multi-select lives in this screen session.
    if (filters.category !== "All categories")
      patch({ category: "All categories" });
  }

  const currentWhen = filters.when ?? "Any";
  const currentJoin = filters.join ?? "Any";
  const currentAudience =
    filters.audience === "Everyone"
      ? "Everyone"
      : filters.audience === "Friends"
        ? "Friends"
        : filters.audience === "Public"
          ? "Public"
          : (audiences.find((choice) => choice.id === filters.audience)
              ?.label ?? "Selected group");

  return (
    <Sheet
      title="Filters"
      centered
      visible={visible}
      onClose={onClose}
      maxHeightPercent={72}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton
            title={`Reset${activeCount ? ` · ${activeCount}` : ""}`}
            accessibilityLabel="Reset filters"
            onPress={reset}
          />
          <View style={{ flex: 1 }}>
            <Button title={`Show ${resultCount} Beacons`} onPress={onClose} />
          </View>
        </View>
      }
    >
      <View testID="advanced-map-filters" style={{ gap: 14, paddingBottom: 8 }}>
        <ChoiceSection title="When" icon={CalendarDays}>
          <View accessibilityRole="radiogroup" accessibilityLabel="When">
            {whens.map((when) => (
              <FilterRadio
                key={when}
                label={when}
                selected={currentWhen === when}
                onPress={() =>
                  patch({
                    when,
                    time:
                      when === "Any" || filters.time === "Now"
                        ? "All"
                        : filters.time,
                  })
                }
              />
            ))}
          </View>
        </ChoiceSection>

        <ChoiceSection title="Category" icon={Sparkles}>
          <View
            testID="filter-category-grid"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 8,
            }}
          >
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              const tone = categoryTokens[category];
              const selected = selectedCategories.includes(category);
              return (
                <Pressable
                  key={category}
                  accessibilityRole="checkbox"
                  accessibilityLabel={category}
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={() => toggleCategory(category)}
                  style={{
                    width: "48.5%",
                    minHeight: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor: selected ? tone.tint : "transparent",
                    borderWidth: 1,
                    borderColor: selected ? tone.color : colors.line,
                  }}
                >
                  <Icon size={14} color={tone.color} />
                  <Text
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    {category}
                  </Text>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      borderWidth: 1,
                      borderColor: selected ? tone.color : colors.muted,
                      backgroundColor: selected ? tone.color : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected && <Check size={12} color={tone.onColor} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ChoiceSection>

        <ChoiceSection title="Join" icon={UserRoundCheck}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Join">
            {joins.map((join) => (
              <FilterRadio
                key={join}
                label={join}
                selected={currentJoin === join}
                onPress={() => patch({ join })}
              />
            ))}
          </View>
        </ChoiceSection>

        <View style={{ borderBottomWidth: 1, borderColor: colors.line }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More filters"
            accessibilityState={{ expanded: moreOpen }}
            onPress={() => setMoreOpen((value) => !value)}
            style={{
              minHeight: 54,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Users size={18} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>MORE FILTERS</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {currentAudience} ·{" "}
                {filters.format && filters.format !== "Any"
                  ? filters.format
                  : "Any place"}
                {filters.planId ? " · Plan" : ""}
              </Text>
            </View>
            {moreOpen ? (
              <ChevronUp size={18} color={colors.muted} />
            ) : (
              <ChevronDown size={18} color={colors.muted} />
            )}
          </Pressable>
          {moreOpen ? (
            <View style={{ gap: 12, paddingBottom: 14 }}>
              <Text style={styles.label}>PEOPLE & GROUPS</Text>
              <RowChoice
                label="Everyone"
                selected={filters.audience === "Everyone"}
                onPress={() => patch({ audience: "Everyone" })}
                icon={Users}
              />
              <RowChoice
                label="Friends"
                selected={filters.audience === "Friends"}
                onPress={() => patch({ audience: "Friends" })}
                icon={Users}
              />
              <RowChoice
                label="Public"
                selected={filters.audience === "Public"}
                onPress={() => patch({ audience: "Public" })}
                icon={Users}
              />
              <RowChoice
                label="Starred only"
                description="Beacons from Starred friends or Squads"
                selected={filters.starredOnly === true}
                onPress={() => patch({ starredOnly: !filters.starredOnly })}
                icon={Users}
              />
              {audiences.length ? (
                <Field
                  label="Search groups"
                  placeholder="Search lists, Squads, and Organizations"
                  value={audienceQuery}
                  onChangeText={setAudienceQuery}
                />
              ) : null}
              {visibleAudiences.map((choice) => (
                <RowChoice
                  key={`${choice.kind}:${choice.id}`}
                  label={choice.label}
                  description={choice.kind}
                  selected={filters.audience === choice.id}
                  onPress={() =>
                    patch({
                      audience:
                        filters.audience === choice.id ? "Everyone" : choice.id,
                    })
                  }
                  icon={choice.kind === "List" ? ListChecks : Users}
                />
              ))}
              {!visibleAudiences.length ? (
                <Text style={styles.muted}>
                  No matching groups you can access.
                </Text>
              ) : null}

              <Text style={[styles.label, { marginTop: 4 }]}>PLACE & PLAN</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(["All", "Upcoming"] as const).map((time) => {
                  const selected =
                    filters.time === (time === "All" ? "All" : "Upcoming");
                  return (
                    <RowChoice
                      key={time}
                      label={time === "All" ? "Any time" : time}
                      selected={selected}
                      onPress={() => patch({ time })}
                      icon={CalendarDays}
                    />
                  );
                })}
              </View>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Format"
                style={{
                  flexDirection: "row",
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 8,
                  padding: 3,
                }}
              >
                {formats.map((format) => {
                  const selected = (filters.format ?? "Any") === format;
                  return (
                    <Pressable
                      key={format}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        format === "Any" ? "Any place" : format
                      }
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => patch({ format })}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: 5,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? colors.lime : "transparent",
                        paddingHorizontal: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          textAlign: "center",
                          color: selected ? colors.green : colors.muted,
                        }}
                      >
                        {format === "Any" ? "Any place" : format}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {planOptions.length ? (
                <>
                  <Field
                    label="Search plans"
                    placeholder="Search plans"
                    value={planQuery}
                    onChangeText={setPlanQuery}
                  />
                  <RowChoice
                    label="Any plan"
                    selected={!filters.planId}
                    onPress={() => patch({ planId: null })}
                    icon={ListChecks}
                  />
                  {visiblePlans.map((plan) => (
                    <RowChoice
                      key={plan.id}
                      label={plan.label}
                      selected={filters.planId === plan.id}
                      onPress={() => patch({ planId: plan.id })}
                      icon={ListChecks}
                    />
                  ))}
                </>
              ) : null}
              <Text style={styles.label}>ADDITIONAL JOIN OPTIONS</Text>
              {moreJoins.map((join) => (
                <FilterRadio
                  key={join}
                  label={join}
                  selected={currentJoin === join}
                  onPress={() =>
                    patch({ join: currentJoin === join ? "Any" : join })
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
