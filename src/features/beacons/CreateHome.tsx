import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pencil,
  ChevronRight,
  Sparkles,
  Coffee,
  UsersRound,
  Dumbbell,
  BookOpen,
  ShoppingBasket,
  Ticket,
  Trees,
  Gamepad2,
  Palette,
  Briefcase,
  Heart,
  Plane,
  HandHeart,
  PartyPopper,
  Music2,
  Camera,
  Car,
  House,
  LayoutGrid,
  Bookmark,
  Plus,
  Footprints,
  CircleDot,
  UtensilsCrossed,
  MapPin,
} from "lucide-react-native";
import { ActivityBadge } from "./ActivityBadge";
import { matchesSearch } from "@/src/shared/search";
import {
  mainTemplateFamilies,
  moreTemplateFamilies,
  familyTemplates,
  type TemplateFamily,
} from "./templateBrowser";
import { useBeacon } from "@/src/shared/store";
import { creationHandoffParams } from "./createHandoff";
import {
  beaconTemplateCatalog,
  templateMatchesSearch,
  templates,
  type BeaconTemplate,
} from "@/src/shared/templates";
import {
  Button,
  Chips,
  Empty,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

function recommendationFamily(item: BeaconTemplate) {
  const quickFamilies: Record<string, string> = {
    "quick-coffee": "food-dining",
    "quick-study": "study-learning",
    "quick-walk": "nature-outdoors",
  };
  return item.groupId ?? quickFamilies[item.id ?? ""] ?? item.category;
}

export function CreateHome({
  onBlank,
  onTemplate,
  context: handoffContext,
  selectedFriends = [],
  contextError = "",
  onRemoveInvitee,
  onClearInvitees,
  onClearStatusSource,
}: {
  onBlank: () => void;
  onTemplate: (template: BeaconTemplate) => void;
  context?: Record<string, string>;
  selectedFriends?: { id: string; name: string }[];
  contextError?: string;
  onRemoveInvitee?: (id: string) => void;
  onClearInvitees?: () => void;
  onClearStatusSource?: () => void;
}) {
  const { data, userId } = useBeacon();
  const routeContext = useLocalSearchParams<{
    threadId?: string;
    planId?: string;
    latitude?: string;
    longitude?: string;
    placeLabel?: string;
    inviteeIds?: string;
    statusSourceId?: string;
    startsAt?: string;
    fromMap?: string;
    timezone?: string;
  }>();
  const context = handoffContext ?? creationHandoffParams(routeContext);
  const { styles, colors } = useTheme();
  const [tab, setTab] = useState("Beacon");
  const [browser, setBrowser] = useState(false);
  const [source, setSource] = useState("Browse");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<TemplateFamily | null>(null);
  const [launcherError, setLauncherError] = useState("");
  const hasSelectedContext = selectedFriends.length > 0 || !!context.statusSourceId || !!contextError;
  const own =
    data.viewer_id === userId
      ? data.templates.filter((item) => item.owner_id === userId)
      : [];
  const history = data.activities
    .filter((item) => item.owner_id === userId)
    .slice()
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const catalog = [...templates, ...beaconTemplateCatalog];
  const recent = history
    .flatMap((activity) => {
      if (activity.template_source_id) return [activity.template_source_id];
      const match = catalog.find(
        (item) => item.title.toLowerCase() === activity.title.toLowerCase(),
      );
      return match ? [`app:${match.id}`] : [];
    })
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .filter((id) =>
      id.startsWith("mine:")
        ? own.some((item) => `mine:${item.id}` === id)
        : catalog.some((item) => `app:${item.id}` === id),
    )
    .slice(0, 3);
  const interests =
    data.profiles.find((item) => item.id === userId)?.interests ?? [];
  const recommended = [...catalog]
    .sort((a, b) => {
      const score = (item: BeaconTemplate) =>
        history
          .slice(0, 10)
          .filter((activity) => activity.category === item.category).length +
        interests.filter((interest) =>
          `${item.title} ${item.category} ${item.groupLabel ?? ""}`
            .toLowerCase()
            .includes(interest.toLowerCase()),
        ).length *
          3;
      return score(b) - score(a);
    })
    .filter(
      (item, index, items) =>
        items.findIndex((other) => other.title === item.title) === index &&
        items.findIndex(
          (other) => recommendationFamily(other) === recommendationFamily(item),
        ) === index,
    )
    .slice(0, 3);
  const planTemplates = data.plan_templates.filter(
    (item) => item.owner_id === userId,
  );
  const routines = data.plan_routines.filter(
    (item) => item.owner_id === userId && item.status !== "ended",
  );
  const card = (
    key: string,
    title: string,
    detail: string,
    onPress: () => void,
    icon: React.ReactNode = <Sparkles size={20} color={colors.green} />,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 11,
          minHeight: 64,
          borderBottomWidth: 1,
          borderColor: colors.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={{ width: 38, alignItems: "center" }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={[styles.h2, { fontSize: 15 }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.muted, { fontSize: 12 }]}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </Pressable>
  );
  const recipeCard = (item: BeaconTemplate) =>
    card(
      item.id ?? item.title,
      item.title,
      `${item.category} \u00b7 ${item.minutes} min${item.suggestedTools?.includes("checklist") ? " \u00b7 Checklist" : item.suggestedTools?.includes("focus") ? " \u00b7 Focus Timer" : ""}`,
      () => {
        setBrowser(false);
        onTemplate(item);
      },
      recipeIcon(item),
    );
  const savedRoute = (id: string, edit = false) => {
    setBrowser(false);
    router.push({
      pathname: "/create",
      params: {
        template: id,
        ...context,
        ...(edit ? { editTemplate: "yes" } : {}),
      },
    });
  };
  const savedCard = (item: (typeof own)[number]) =>
    card(
      item.id,
      item.name,
      `${item.title} \u00b7 ${item.minutes} min`,
      () => savedRoute(item.id),
      <ActivityBadge category={item.category} size={34} />,
    );
  const icons = {
    hangout: UsersRound,
    food: Coffee,
    sports: Dumbbell,
    study: BookOpen,
    errands: ShoppingBasket,
    outing: Ticket,
    outdoors: Trees,
    gaming: Gamepad2,
    creative: Palette,
    work: Briefcase,
    wellness: Heart,
    travel: Plane,
    community: HandHeart,
    celebrations: PartyPopper,
    music: Music2,
    photography: Camera,
    transport: Car,
    home: House,
  };
  function recipeIcon(item: BeaconTemplate) {
    const family = [...mainTemplateFamilies, ...moreTemplateFamilies].find(
      (row) => !!item.groupId && row.groupId === item.groupId,
    );
    const Icon = /coffee/i.test(item.title)
      ? Coffee
      : /photography|filming|content|video/i.test(item.title)
        ? Camera
        : /music|band|karaoke/i.test(item.title)
          ? Music2
          : /walk/i.test(item.title)
            ? Footprints
            : /basketball|bowling/i.test(item.title)
              ? CircleDot
              : family?.icon === "food"
                ? UtensilsCrossed
                : item.id === "quick-study"
                  ? BookOpen
                  : family
                    ? (icons[family.icon as keyof typeof icons] ?? Sparkles)
                    : Sparkles;
    return (
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={colors.green} />
      </View>
    );
  }
  const familyCard = (item: TemplateFamily) => {
    const Icon = icons[item.icon as keyof typeof icons] ?? Sparkles;
    return card(
      item.id,
      item.title,
      item.description,
      () => setFamily(item),
      <Icon size={23} color={colors.green} />,
    );
  };
  const openBrowser = (nextSource = "Browse") => {
    setSource(nextSource);
    setFamily(null);
    setBrowser(true);
  };
  const appResults = (family ? familyTemplates(family) : catalog).filter(
    (item) => templateMatchesSearch(item, query),
  );
  const savedResults = own.filter((item) =>
    matchesSearch(query, item.name, item.title, item.category),
  );
  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
  return (
    <Screen
      title={tab === "Beacon" ? "Create Beacon" : `Create ${tab}`}
      eyebrow="MAKE TIME TOGETHER"
      create={false}
    >
      <Chips
        options={["Beacon", "Plan", "Routine"]}
        value={tab}
        onChange={(next) => {
          if (next !== "Beacon" && hasSelectedContext) { setLauncherError("Clear selected friends and the status source before switching to a Plan or Routine. They apply to the new Beacon."); return; }
          setLauncherError(""); setTab(next);
        }}
        showSelectedCheckmark={false}
      />
      <Txt muted>
        {tab === "Beacon"
          ? "One activity, with your people."
          : tab === "Plan"
            ? "Arrange Beacons into a simple itinerary."
            : "Save a Plan to reuse or repeat."}
      </Txt>
      {!!(contextError || launcherError) && <Text accessibilityRole="alert" style={styles.error}>{contextError || launcherError}</Text>}
      {(selectedFriends.length > 0 || contextError && context.inviteeIds !== "[]") && <View style={{ gap: 8 }}>
        <Txt muted>{selectedFriends.length} friends selected for this Beacon</Txt>
        <View style={[styles.row, { flexWrap: "wrap" }]}>{selectedFriends.map((friend) => <Button key={friend.id} compact secondary title={`Remove ${friend.name}`} onPress={() => onRemoveInvitee?.(friend.id)} />)}</View>
        <Button compact secondary title="Clear selected friends" onPress={() => { onClearInvitees?.(); setLauncherError(""); }} />
      </View>}
      {!!context.statusSourceId && <View style={{ gap: 4 }}><Txt muted>Starting from your status note. Your status stays as it is.</Txt>
        <Button compact secondary title="Clear status source" onPress={() => { onClearStatusSource?.(); setLauncherError(""); }} /></View>}
      {tab === "Beacon" ? (
        <>
          {context.fromMap === "yes" ? card("map-location", "Create Beacon on Map", "Choose a physical meeting point, then a template", () => router.push({ pathname: "/(tabs)", params: { ...context, pickLocation: "yes" } }), <MapPin size={22} color={colors.green} />) : null}
          {card(
            "blank",
            "Create Blank Template",
            "Start fresh, then make it yours",
            onBlank,
            <Plus size={24} color={colors.green} />,
          )}
          <Field
            label="Search activities"
            placeholder="Search activities or templates…"
            value={query}
            onChangeText={setQuery}
          />
          {query.trim() ? (
            <>
              {section("SEARCH RESULTS", appResults.map(recipeCard))}
              {!!savedResults.length &&
                section("MY TEMPLATES", savedResults.map(savedCard))}
              {!appResults.length && !savedResults.length && (
                <Empty
                  title="No matching templates"
                  body="Try a different activity, or start blank."
                />
              )}
              <Button
                compact
                secondary
                title="Clear search"
                onPress={() => setQuery("")}
              />
            </>
          ) : (
            <>
              {section("FOR YOU", recommended.map(recipeCard))}
              {!!recent.length &&
                section(
                  "RECENT",
                  recent.map((id) =>
                    id.startsWith("mine:")
                      ? savedCard(own.find((item) => `mine:${item.id}` === id)!)
                      : recipeCard(
                          catalog.find((item) => `app:${item.id}` === id)!,
                        ),
                  ),
                )}
            </>
          )}
          {card(
            "browse",
            "Browse More Templates",
            "Explore activities by family",
            () => openBrowser(),
            <LayoutGrid size={21} color={colors.muted} />,
          )}
          {card(
            "mine",
            "My Templates",
            "Reuse or edit your saved starting points",
            () => openBrowser("My Templates"),
            <Bookmark size={21} color={colors.muted} />,
          )}
        </>
      ) : (
        section(
          "QUICK START",
          <Button
            title={tab === "Routine" ? "+ Create Routine" : "+ Blank Plan"}
            onPress={() =>
              router.push({
                pathname: tab === "Plan" ? "/plans" : "/routines",
                params: { create: "yes" },
              })
            }
          />,
        )
      )}
      {tab === "Plan" && (
        <>
          {!!planTemplates.length &&
            section(
              "MY TEMPLATES",
              planTemplates.map((item) =>
                card(item.id, item.title, `${item.steps.length} Beacons`, () =>
                  router.push({
                    pathname: "/plans",
                    params: {
                      template: item.id,
                      create: "yes",
                      ...(item.squad_id ? { squadId: item.squad_id } : {}),
                    },
                  }),
                ),
              ),
            )}
          <Button
            title="My Plans →"
            secondary
            onPress={() => router.push("/plans")}
          />
        </>
      )}
      {tab === "Routine" && (
        <>
          {!!routines.length &&
            section(
              "MY ROUTINES",
              routines.map((item) => {
                const plan = data.plans.find(
                  (plan) => plan.id === item.plan_id,
                );
                return plan
                  ? card(
                      item.id,
                      plan.title,
                      item.run_mode === "manual"
                        ? "Run Manually"
                        : item.status === "paused"
                          ? "Paused"
                          : `Next · ${item.next_occurrence_on ?? "Run manually"}`,
                      () =>
                        router.push({
                          pathname: "/routines",
                          params: { planId: plan.id },
                        }),
                    )
                  : null;
              }),
            )}
          <Button
            title="My Routines →"
            secondary
            onPress={() => router.push("/routines")}
          />
        </>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          compact
          secondary
          title="Share a status"
          onPress={() => {
            if (hasSelectedContext) { setLauncherError("Clear selected friends and the status source before sharing a separate status."); return; }
            router.push({ pathname: "/create", params: { ...context, kind: "status" } });
          }}
        />
        <Button
          compact
          secondary
          title="Beacon for a Squad"
          onPress={() =>
            router.push({ pathname: "/create", params: { ...context, kind: "squad" } })
          }
        />
      </View>
      <Sheet
        title={
          source === "My Templates"
            ? "My Templates"
            : (family?.title ?? "Beacon Templates")
        }
        visible={browser}
        onClose={() => setBrowser(false)}
      >
        <Field
          label="Search"
          placeholder="Search activities or categories…"
          value={query}
          onChangeText={setQuery}
        />
        <Chips
          options={["Browse", "My Templates"]}
          value={source}
          onChange={(next) => {
            setSource(next);
            setFamily(null);
          }}
          showSelectedCheckmark={false}
        />
        {source === "My Templates" ? (
          <>
            {savedResults.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{ flex: 1 }}>{savedCard(item)}</View>
                <IconButton
                  label={`Edit template ${item.name}`}
                  onPress={() => savedRoute(item.id, true)}
                >
                  <Pencil size={18} color={colors.muted} />
                </IconButton>
              </View>
            ))}
            {!savedResults.length && (
              <Empty
                title={
                  query.trim()
                    ? "No matching saved templates"
                    : "No saved templates yet"
                }
                body="Save a configuration from Advanced Options in the Beacon editor."
              />
            )}
            <Button
              secondary
              title="Create Blank Template"
              onPress={() => {
                setBrowser(false);
                onBlank();
              }}
            />
          </>
        ) : family ? (
          <>
            <Button
              compact
              secondary
              title="Back to categories"
              onPress={() => setFamily(null)}
            />
            <Txt muted>{family.description}</Txt>
            {appResults.map(recipeCard)}
            {!appResults.length && (
              <Empty
                title="No matching templates"
                body="Try another activity or go back to categories."
              />
            )}
          </>
        ) : query.trim() ? (
          <>
            {appResults.map(recipeCard)}
            {!appResults.length && (
              <Empty
                title="No matching templates"
                body="Try another activity or category."
              />
            )}
          </>
        ) : (
          <>
            {section("QUICK START", mainTemplateFamilies.map(familyCard))}
            {section("MORE ACTIVITIES", moreTemplateFamilies.map(familyCard))}
          </>
        )}
        <Button secondary title="Done" onPress={() => setBrowser(false)} />
      </Sheet>
    </Screen>
  );
}
