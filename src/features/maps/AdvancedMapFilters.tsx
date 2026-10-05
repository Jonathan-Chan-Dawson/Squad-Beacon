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
const joins = [
  "Any",
  "Open",
  "Needs People",
  "I'm In",
  "Request Approval",
  "Invited",
  "Spots Available",
] as const;
const formats = ["Any", "Physical", "Virtual"] as const;
const categoryIcons = {
  Fitness: Dumbbell,
  Study: BookOpen,
  Gaming: Gamepad2,
  Creative: Palette,
  Social: Coffee,
  Other: Sparkles,
};

function Section({
  title,
  summary,
  open,
  onPress,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, styles } = useTheme();
  const Icon =
    title === "People & groups"
      ? Users
      : title === "Activity"
        ? Sparkles
        : title === "Time & place"
          ? CalendarDays
          : title === "Joining"
            ? UserRoundCheck
            : ListChecks;
  return (
    <View style={{ borderBottomWidth: 1, borderColor: colors.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={{
          minHeight: 54,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon size={18} color={colors.green} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {open ? (
          <ChevronUp size={18} color={colors.muted} />
        ) : (
          <ChevronDown size={18} color={colors.muted} />
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: 14, gap: 9 }}>{children}</View>
      ) : null}
    </View>
  );
}

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
        minHeight: 48,
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

export function AdvancedMapFilters({
  visible,
  onClose,
  filters,
  onChange,
  audiences,
  planOptions,
  resultCount,
}: {
  visible: boolean;
  onClose: () => void;
  filters: ExplorationFilters;
  onChange: (filters: ExplorationFilters) => void;
  audiences: MapAudienceChoice[];
  planOptions: { id: string; label: string }[];
  resultCount: number;
}) {
  const { colors, styles } = useTheme();
  const [openSection, setOpenSection] = useState("People & groups");
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
  }
  const activeCount =
    Number(filters.audience !== "Everyone") +
    Number(filters.category !== "All categories") +
    Number(filters.time !== "All") +
    Number(!!filters.planId) +
    Number(!!filters.when && filters.when !== "Any") +
    Number(!!filters.join && filters.join !== "Any") +
    Number(!!filters.format && filters.format !== "Any") +
    Number(filters.starredOnly === true);
  const toggle = (title: string) =>
    setOpenSection((current) => (current === title ? "" : title));
  const whenSummary =
    filters.time === "Now"
      ? "Now"
      : filters.time === "Upcoming"
        ? "Upcoming"
        : filters.when && filters.when !== "Any"
          ? filters.when
          : "Any time";
  const groupSummary =
    filters.audience === "Everyone"
      ? "Everyone"
      : filters.audience === "Friends"
        ? "Friends"
        : filters.audience === "Public"
          ? "Public"
          : (audiences.find((choice) => choice.id === filters.audience)
              ?.label ?? "Selected group");
  const joinSummary =
    filters.join && filters.join !== "Any" ? filters.join : "Any";
  const planSummary = filters.planId
    ? (planOptions.find((option) => option.id === filters.planId)?.label ??
      "Selected plan")
    : "Any plan";

  return (
    <Sheet
      title="More Filters"
      visible={visible}
      onClose={onClose}
      maxHeightPercent={78}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            onPress={reset}
            style={{
              minHeight: 48,
              justifyContent: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text style={[styles.label, { color: colors.green }]}>
              Reset{activeCount ? ` · ${activeCount}` : ""}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${resultCount} Beacons`}
            onPress={onClose}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.ink,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: "700" }}>
              Show {resultCount} Beacons
            </Text>
          </Pressable>
        </View>
      }
    >
      <View testID="advanced-map-filters" style={{ paddingBottom: 8 }}>
        <Section
          title="People & groups"
          summary={groupSummary}
          open={openSection === "People & groups"}
          onPress={() => toggle("People & groups")}
        >
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
          <View
            style={{
              minHeight: 42,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 14,
            }}
          >
            <Search size={17} color={colors.muted} />
            <TextInput
              accessibilityLabel="Search groups"
              placeholder="Search lists, Squads, and Organizations"
              placeholderTextColor={colors.muted}
              value={audienceQuery}
              onChangeText={setAudienceQuery}
              style={
                {
                  flex: 1,
                  color: colors.ink,
                  paddingVertical: 9,
                  outlineStyle: "none",
                } as never
              }
            />
          </View>
          <ScrollView
            style={{ maxHeight: 168 }}
            keyboardShouldPersistTaps="handled"
          >
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
          </ScrollView>
        </Section>
        <Section
          title="Activity"
          summary={
            filters.category === "All categories"
              ? "All categories"
              : filters.category
          }
          open={openSection === "Activity"}
          onPress={() => toggle("Activity")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <RowChoice
              label="All categories"
              selected={filters.category === "All categories"}
              onPress={() => patch({ category: "All categories" })}
            />
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={category}
                  accessibilityState={{
                    selected: filters.category === category,
                  }}
                  onPress={() =>
                    patch({
                      category:
                        filters.category === category
                          ? "All categories"
                          : category,
                    })
                  }
                  style={{
                    width: "31%",
                    minWidth: 90,
                    minHeight: 74,
                    padding: 8,
                    gap: 5,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      filters.category === category
                        ? colors.lime + "66"
                        : colors.bg,
                  }}
                >
                  <Icon size={19} color={colors.green} />
                  <Text style={styles.label}>{category}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
        <Section
          title="Time & place"
          summary={`${whenSummary} · ${filters.format && filters.format !== "Any" ? filters.format : "Any place"}`}
          open={openSection === "Time & place"}
          onPress={() => toggle("Time & place")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {(["All", "Now", "Upcoming"] as const).map((time) => (
              <RowChoice
                key={time}
                label={time === "All" ? "Any time" : time}
                selected={filters.time === time}
                onPress={() =>
                  patch({ time, when: time === "All" ? filters.when : "Any" })
                }
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {whens.map((when) => (
              <RowChoice
                key={when}
                label={when === "Any" ? "Any day" : when}
                selected={(filters.when ?? "Any") === when}
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {formats.map((format) => (
              <RowChoice
                key={format}
                label={format === "Any" ? "Any place" : format}
                selected={(filters.format ?? "Any") === format}
                onPress={() => patch({ format })}
                icon={format === "Virtual" ? Search : MapPin}
              />
            ))}
          </View>
        </Section>
        <Section
          title="Joining"
          summary={joinSummary}
          open={openSection === "Joining"}
          onPress={() => toggle("Joining")}
        >
          {joins.map((join) => (
            <RowChoice
              key={join}
              label={join}
              description={
                join === "Needs People"
                  ? "Host’s target is not met"
                  : join === "Request Approval"
                    ? "Approval or invite-only Beacons you can access"
                    : join === "Spots Available"
                      ? "A strict capacity has open seats"
                      : undefined
              }
              selected={(filters.join ?? "Any") === join}
              onPress={() => patch({ join })}
              icon={UserRoundCheck}
            />
          ))}
        </Section>
        <Section
          title="Plans"
          summary={planSummary}
          open={openSection === "Plans"}
          onPress={() => toggle("Plans")}
        >
          <View
            style={{
              minHeight: 42,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 14,
            }}
          >
            <Search size={17} color={colors.muted} />
            <TextInput
              accessibilityLabel="Search plans"
              placeholder="Search plans"
              placeholderTextColor={colors.muted}
              value={planQuery}
              onChangeText={setPlanQuery}
              style={
                {
                  flex: 1,
                  color: colors.ink,
                  paddingVertical: 9,
                  outlineStyle: "none",
                } as never
              }
            />
          </View>
          <ScrollView
            style={{ maxHeight: 150 }}
            keyboardShouldPersistTaps="handled"
          >
            <RowChoice
              label="All plans"
              selected={!filters.planId}
              onPress={() => patch({ planId: null })}
              icon={ListChecks}
            />
            {visiblePlans.map((plan) => (
              <RowChoice
                key={plan.id}
                label={plan.label}
                selected={filters.planId === plan.id}
                onPress={() =>
                  patch({ planId: filters.planId === plan.id ? null : plan.id })
                }
                icon={ListChecks}
              />
            ))}
          </ScrollView>
        </Section>
      </View>
    </Sheet>
  );
}
