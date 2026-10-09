import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Dumbbell,
  Gamepad2,
  Palette,
  Search,
  Sparkles,
  Users,
  CalendarDays,
  MapPin,
  UserRoundCheck,
  ListChecks,
} from "lucide-react-native";
import type { Category } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";
import { Sheet, useTheme } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/theme";
import { uiHaptics } from "@/src/shared/design-system";
import { mapAdvancedFilterCount } from "@/src/features/maps/mapUIselectors";

export type MapAudienceChoice = {
  id: string;
  label: string;
  kind: "List" | "Squad" | "Organization";
};

const categories: Category[] = ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"];
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
      {Icon ? <Icon size={17} color={selected ? colors.green : colors.muted} /> : <View style={{ width: 17 }} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{label}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      {selected ? <Check size={17} color={colors.green} /> : null}
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
    <View style={{ gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.line }}>
      <View style={{ minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8 }}>
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
    () => audiences.filter((choice) => choice.label.toLowerCase().includes(audienceQuery.trim().toLowerCase())),
    [audiences, audienceQuery],
  );
  const visiblePlans = useMemo(
    () => planOptions.filter((choice) => choice.label.toLowerCase().includes(planQuery.trim().toLowerCase())),
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
    if (filters.category !== "All categories") patch({ category: "All categories" });
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
          : audiences.find((choice) => choice.id === filters.audience)?.label ?? "Selected group";

  return (
    <Sheet
      title="Filters"
      visible={visible}
      onClose={onClose}
      maxHeightPercent={72}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            onPress={reset}
            style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <Text style={[styles.label, { color: colors.green }]}>Reset{activeCount ? ` · ${activeCount}` : ""}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${resultCount} Beacons`}
            onPress={onClose}
            style={{ flex: 1, minHeight: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }}
          >
            <Text style={{ color: colors.white, fontWeight: "700" }}>Show {resultCount} Beacons</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView
        testID="advanced-map-filters"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
      >
        <ChoiceSection title="When" icon={CalendarDays}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {whens.map((when) => {
              const selected = currentWhen === when;
              return (
                <Pressable
                  key={when}
                  accessibilityRole="button"
                  accessibilityLabel={when}
                  accessibilityState={{ selected }}
                  onPress={() => patch({ when, time: when === "Any" || filters.time === "Now" ? "All" : filters.time })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: selected ? colors.ink : colors.line, backgroundColor: selected ? colors.ink : colors.white }}
                >
                  <Text style={{ color: selected ? colors.white : colors.ink, fontSize: 13, fontWeight: "700" }}>{when}</Text>
                </Pressable>
              );
            })}
          </View>
        </ChoiceSection>

        <ChoiceSection title="Category" icon={Sparkles}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              const tone = categoryTokens[category];
              const selected = selectedCategories.includes(category);
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={category}
                  accessibilityState={{ selected }}
                  aria-pressed={selected}
                  onPress={() => toggleCategory(category)}
                  style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, borderRadius: 22, backgroundColor: selected ? tone.tint : colors.white, borderWidth: 1, borderColor: selected ? tone.color : colors.line }}
                >
                  <Icon size={15} color={tone.color} />
                  <Text style={{ color: tone.color, fontSize: 13, fontWeight: "700" }}>{category}</Text>
                </Pressable>
              );
            })}
          </View>
        </ChoiceSection>

        <ChoiceSection title="Join" icon={UserRoundCheck}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {joins.map((join) => {
              const selected = currentJoin === join;
              return (
                <Pressable
                  key={join}
                  accessibilityRole="button"
                  accessibilityLabel={join}
                  accessibilityState={{ selected }}
                  onPress={() => patch({ join })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: selected ? colors.ink : colors.line, backgroundColor: selected ? colors.ink : colors.white }}
                >
                  <Text style={{ color: selected ? colors.white : colors.ink, fontSize: 13, fontWeight: "700" }}>{join}</Text>
                </Pressable>
              );
            })}
          </View>
        </ChoiceSection>

        <View style={{ borderBottomWidth: 1, borderColor: colors.line }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More filters"
            accessibilityState={{ expanded: moreOpen }}
            onPress={() => setMoreOpen((value) => !value)}
            style={{ minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Users size={18} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>MORE FILTERS</Text>
              <Text style={styles.muted} numberOfLines={1}>{currentAudience} · {filters.format && filters.format !== "Any" ? filters.format : "Any place"}{filters.planId ? " · Plan" : ""}</Text>
            </View>
            {moreOpen ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
          </Pressable>
          {moreOpen ? (
            <View style={{ gap: 12, paddingBottom: 14 }}>
              <Text style={styles.label}>PEOPLE & GROUPS</Text>
              <RowChoice label="Everyone" selected={filters.audience === "Everyone"} onPress={() => patch({ audience: "Everyone" })} icon={Users} />
              <RowChoice label="Friends" selected={filters.audience === "Friends"} onPress={() => patch({ audience: "Friends" })} icon={Users} />
              <RowChoice label="Public" selected={filters.audience === "Public"} onPress={() => patch({ audience: "Public" })} icon={Users} />
              <RowChoice label="Starred only" description="Beacons from Starred friends or Squads" selected={filters.starredOnly === true} onPress={() => patch({ starredOnly: !filters.starredOnly })} icon={Users} />
              {audiences.length ? (
                <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }}>
                  <Search size={17} color={colors.muted} />
                  <TextInput accessibilityLabel="Search groups" placeholder="Search lists, Squads, and Organizations" placeholderTextColor={colors.muted} value={audienceQuery} onChangeText={setAudienceQuery} style={{ flex: 1, color: colors.ink, paddingVertical: 9, outlineStyle: "none" } as never} />
                </View>
              ) : null}
              {visibleAudiences.map((choice) => (
                <RowChoice key={`${choice.kind}:${choice.id}`} label={choice.label} description={choice.kind} selected={filters.audience === choice.id} onPress={() => patch({ audience: filters.audience === choice.id ? "Everyone" : choice.id })} icon={choice.kind === "List" ? ListChecks : Users} />
              ))}
              {!visibleAudiences.length ? <Text style={styles.muted}>No matching groups you can access.</Text> : null}

              <Text style={[styles.label, { marginTop: 4 }]}>PLACE & PLAN</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(["All", "Upcoming"] as const).map((time) => {
                  const selected = filters.time === (time === "All" ? "All" : "Upcoming");
                  return <RowChoice key={time} label={time === "All" ? "Any time" : time} selected={selected} onPress={() => patch({ time })} icon={CalendarDays} />;
                })}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {formats.map((format) => <RowChoice key={format} label={format === "Any" ? "Any place" : format} selected={(filters.format ?? "Any") === format} onPress={() => patch({ format })} icon={format === "Virtual" ? Search : MapPin} />)}
              </View>
              {planOptions.length ? (
                <>
                  <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }}>
                    <Search size={17} color={colors.muted} />
                    <TextInput accessibilityLabel="Search plans" placeholder="Search plans" placeholderTextColor={colors.muted} value={planQuery} onChangeText={setPlanQuery} style={{ flex: 1, color: colors.ink, paddingVertical: 9, outlineStyle: "none" } as never} />
                  </View>
                  <RowChoice label="Any plan" selected={!filters.planId} onPress={() => patch({ planId: null })} icon={ListChecks} />
                  {visiblePlans.map((plan) => <RowChoice key={plan.id} label={plan.label} selected={filters.planId === plan.id} onPress={() => patch({ planId: plan.id })} icon={ListChecks} />)}
                </>
              ) : null}
              <Text style={styles.label}>ADDITIONAL JOIN OPTIONS</Text>
              {moreJoins.map((join) => <RowChoice key={join} label={join} selected={currentJoin === join} onPress={() => patch({ join: currentJoin === join ? "Any" : join })} icon={UserRoundCheck} />)}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Sheet>
  );
}
