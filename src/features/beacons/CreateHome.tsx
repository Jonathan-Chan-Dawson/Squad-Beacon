import { useNow } from "@/src/shared/useNow";
import { listSavedCreationDrafts } from "./creationDraftStorage";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  Footprints,
  CircleDot,
  UtensilsCrossed,
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
  onReuse,
  onTemplate,
  context: handoffContext,
  selectedFriends = [],
  contextError = "",
  onClearInvitees,
  onClearStatusSource,
}: {
  onBlank: () => void;
  onReuse: (id: string) => void;
  onTemplate: (template: BeaconTemplate) => void;
  context?: Record<string, string>;
  selectedFriends?: { id: string; name: string }[];
  contextError?: string;
  onRemoveInvitee?: (id: string) => void;
  onClearInvitees?: () => void;
  onClearStatusSource?: () => void;
  inviteeControl?: React.ReactNode;
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
    activityNoteId?: string;
    featureAfter?: string;
    startsAt?: string;
    fromMap?: string;
    timezone?: string;
  }>();
  const context = handoffContext ?? creationHandoffParams(routeContext);
  const { styles, colors } = useTheme();
  const [browser, setBrowser] = useState(false);
  const [source, setSource] = useState("Browse");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<TemplateFamily | null>(null);
  const [launcherError] = useState("");
  const clockNow = useNow();
  const [focusedAt, setFocusedAt] = useState(() => Date.now());
  const now = Math.max(clockNow, focusedAt);
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
    .filter((item) => item.mode !== "solo" && Date.parse(item.starts_at) < now)
    .slice(0, 3);
  const [continueDraft, setContinueDraft] = useState<{
    token: string;
    title: string;
  } | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  useFocusEffect(
    useCallback(() => {
      setFocusedAt(Date.now());
      let active = true;
      if (userId)
        void listSavedCreationDrafts(userId)
          .then((rows) => {
            if (active) setContinueDraft(rows[0] ?? null);
          })
          .catch(() => {
            if (active)
              setDraftNotice(
                "Saved drafts could not be loaded. Your stored drafts have not been replaced.",
              );
          });
      return () => {
        active = false;
      };
    }, [userId]),
  );
  const interests =
    data.profiles.find((item) => item.id === userId)?.interests ?? [];
  const recommended = [
    "study-learning",
    "sports-fitness",
    "hangout-social",
    "nature-outdoors",
    "productivity-errands",
    "gaming",
  ]
    .map(
      (groupId) =>
        catalog
          .filter((item) => recommendationFamily(item) === groupId)
          .sort((a, b) => {
            const score = (item: BeaconTemplate) =>
              history
                .slice(0, 10)
                .filter((row) => row.category === item.category).length +
              interests.filter((interest) =>
                `${item.title} ${item.groupLabel ?? ""}`
                  .toLowerCase()
                  .includes(interest.toLowerCase()),
              ).length *
                3;
            const preferred = new Set([
              "Basketball",
              "General Hangout",
              "Hiking",
              "Grocery Run",
            ]);
            return (
              score(b) - score(a) ||
              Number(preferred.has(b.title)) - Number(preferred.has(a.title))
            );
          })[0],
    )
    .filter((item): item is BeaconTemplate => !!item);
  for (const item of catalog)
    if (
      recommended.length < 6 &&
      !recommended.some(
        (row) => recommendationFamily(row) === recommendationFamily(item),
      )
    )
      recommended.push(item);
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
      title="Create"
      compactHeader
      eyebrow="MAKE TIME TOGETHER"
      create={false}
    >
      <View style={[styles.card, { padding: 16, gap: 10 }]}>
        <Text style={styles.h2}>Create a Beacon</Text>
        <Txt muted>Bring people together for an activity.</Txt>
        <Button title="+ Create Blank Beacon" onPress={onBlank} />
      </View>
      {selectedFriends.length ||
      context.statusSourceId ||
      context.planId ||
      context.threadId ||
      context.placeLabel ? (
        <Txt muted>
          {selectedFriends.length
            ? `${selectedFriends.length} friends selected · `
            : ""}
          {context.placeLabel ||
            (context.planId
              ? "Adding to a Plan"
              : context.threadId
                ? "Council proposal"
                : context.statusSourceId
                  ? "From your activity note"
                  : "")}
        </Txt>
      ) : null}
      {!!(contextError || launcherError || draftNotice) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {contextError || launcherError || draftNotice}
        </Text>
      )}
      {selectedFriends.length || contextError ? (
        <Button
          compact
          secondary
          title="Clear selected people"
          onPress={() => onClearInvitees?.()}
        />
      ) : null}
      {context.statusSourceId ? (
        <Button
          compact
          secondary
          title="Clear activity source"
          onPress={() => onClearStatusSource?.()}
        />
      ) : null}
      <Text style={styles.h2}>Quick Access</Text>
      {continueDraft
        ? card(
            "continue",
            "Continue Draft",
            `${continueDraft.title} · Unpublished`,
            () =>
              router.push({
                pathname: "/create",
                params: { resumeDraft: continueDraft.token },
              }),
            <Pencil size={20} color={colors.muted} />,
          )
        : null}
      <Field
        label="Search activities or templates"
        placeholder="Search activities or templates…"
        value={query}
        onChangeText={setQuery}
      />
      {query.trim() ? (
        <>
          {section("SEARCH RESULTS", appResults.map(recipeCard))}
          {!!savedResults.length &&
            section("MY TEMPLATES", savedResults.map(savedCard))}
          {!appResults.length && !savedResults.length ? (
            <Empty
              title="No matching templates"
              body="Try another search or create a blank Beacon."
            />
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.label}>RECOMMENDED STARTERS</Text>
          <View
            testID="creation-starters"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          >
            {recommended.map((item) => (
              <Pressable
                key={item.id ?? item.title}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => onTemplate(item)}
                style={({ pressed }) => ({
                  width: "48%",
                  flexGrow: 1,
                  minHeight: 110,
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.line,
                  gap: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <ActivityBadge category={item.category} size={34} />
                <Text
                  style={[styles.body, { fontSize: 14, fontWeight: "700" }]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.muted, { fontSize: 12 }]}>
                  {item.suggestedTools
                    ?.map(
                      (tool) =>
                        ({
                          chat: "Chat",
                          checklist: "Checklist",
                          notes: "Sketchboard",
                          focus: "Timer",
                          memories: "Memories",
                          music: "Music",
                          scoreboard: "Teams",
                        })[tool],
                    )
                    .join(" · ") || item.category}
                </Text>
              </Pressable>
            ))}
          </View>
          {!!recent.length &&
            section(
              "RECENT BEACONS",
              recent.map((item) =>
                card(
                  item.id,
                  item.title,
                  `${new Date(item.starts_at).toLocaleDateString()} · Reuse`,
                  () => onReuse(item.id),
                  <ActivityBadge category={item.category} size={34} />,
                ),
              ),
            )}
        </>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            compact
            secondary
            title="My Templates"
            onPress={() => openBrowser("My Templates")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            compact
            secondary
            title="Browse All"
            onPress={() => openBrowser()}
          />
        </View>
      </View>
      <Text style={styles.h2}>More ways to create</Text>
      {card("ping", "Ping", "See who's interested", () =>
        router.push({
          pathname: "/councils",
          params: { ...context, newPing: "yes", creationKind: "ping" },
        }),
      )}
      {card("vote", "Vote Council", "Compare options together", () =>
        router.push({
          pathname: "/councils",
          params: { ...context, newPing: "yes", creationKind: "council" },
        }),
      )}
      {card("draw", "Draw Council", "Let chance choose", () =>
        router.push({
          pathname: "/councils",
          params: {
            ...context,
            newPing: "yes",
            creationKind: "draw",
          },
        }),
      )}
      {card(
        "note",
        "Activity Note",
        "Share what you're doing",
        () => router.push("/activity-note"),
        <Pencil size={20} color={colors.muted} />,
      )}
      {card("plan", "Create Plan", "Organize multiple Beacons", () =>
        router.push({ pathname: "/plans", params: { create: "yes" } }),
      )}
      {card("routine", "Create Routine", "Repeat a Plan", () =>
        router.push({ pathname: "/routines", params: { create: "yes" } }),
      )}
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
                router.push({
                  pathname: "/create",
                  params: { ...context, saveTemplate: "yes", editor: "yes" },
                });
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
