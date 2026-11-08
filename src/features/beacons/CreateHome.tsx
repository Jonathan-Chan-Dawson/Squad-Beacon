import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import { randomUUID } from "expo-crypto";
import { useNow } from "@/src/shared/useNow";
import { CreationSavedDrafts } from "./components/CreationSavedDrafts";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import {
  Eye,
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
import { useDesignTheme } from "@/src/shared/design-system";
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
  Txt,
  useTheme,
} from "@/src/shared/ui";

function TemplateChoice({
  item,
  icon,
  expanded,
  onPreview,
  onApply,
  compact = false,
  title,
}: {
  item: BeaconTemplate;
  icon: React.ReactNode;
  expanded: boolean;
  onPreview: () => void;
  onApply: () => void;
  compact?: boolean;
  title?: string;
}) {
  const { colors, tokens } = useDesignTheme();
  const tools = (item.suggestedTools ?? []).map(
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
  );
  return (
    <View
      style={{
        width: compact ? "48%" : "100%",
        flexGrow: compact ? 1 : 0,
        padding: 10,
        gap: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: expanded ? colors.accent : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {icon}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Preview " + (title ?? item.title)}
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={onPreview}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Eye
            size={17}
            color={expanded ? colors.accent : colors.textSecondary}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title ?? item.title}
        onPress={onApply}
        style={{ minHeight: 44, gap: 4, paddingVertical: 4 }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: colors.textPrimary,
            ...tokens.type.secondary,
            fontWeight: "600",
          }}
        >
          {title ?? item.title}
        </Text>
        <Text style={{ color: colors.textSecondary, ...tokens.type.caption }}>
          Sets up · {item.minutes} min
          {tools.length ? " · " + tools.join(" · ") : ""}
        </Text>
      </Pressable>
      {expanded && (
        <View
          style={{
            gap: 6,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {!!item.description && (
            <Text
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              {item.description}
            </Text>
          )}
          {(item.prepPrompts ?? []).map((prompt, index) => (
            <Text
              key={index}
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              • {prompt}
            </Text>
          ))}
          <Text style={{ color: colors.textSecondary, ...tokens.type.caption }}>
            Tap the template name to use it.
          </Text>
        </View>
      )}
    </View>
  );
}

function recommendationFamily(item: BeaconTemplate) {
  const quickFamilies: Record<string, string> = {
    "quick-coffee": "food-dining",
    "quick-study": "study-learning",
    "quick-walk": "nature-outdoors",
  };
  return item.groupId ?? quickFamilies[item.id ?? ""] ?? item.category;
}

export function CreateHome({
  browserScreen = false,
  onBlank,
  onReuse,
  onTemplate,
  context: handoffContext,
  selectedFriends = [],
  contextError = "",
  onClearInvitees,
  onClearStatusSource,
}: {
  browserScreen?: boolean;
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
    savedDraft?: string;
    templates?: string;
  }>();
  const context = handoffContext ?? creationHandoffParams(routeContext);
  const { styles, colors } = useTheme();
  const design = useDesignTheme();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const togglePreview = (id: string) =>
    setPreviewId((current) => (current === id ? null : id));
  const browser =
    browserScreen ||
    routeContext.templates === "mine" ||
    routeContext.templates === "all";
  const [source, setSource] = useState(
    routeContext.templates === "mine" ? "My Templates" : "Browse",
  );
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
  useFocusEffect(
    useCallback(() => {
      setFocusedAt(Date.now());
    }, []),
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
          borderBottomWidth: browser ? 0 : 1,
          borderColor: colors.line,
          ...(browser
            ? { paddingHorizontal: 12, borderWidth: 1, borderRadius: 14 }
            : {}),
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
  const recipeCard = (item: BeaconTemplate) => (
    <TemplateChoice
      key={item.id ?? item.title}
      item={item}
      icon={recipeIcon(item)}
      expanded={previewId === (item.id ?? item.title)}
      onPreview={() => togglePreview(item.id ?? item.title)}
      onApply={() => onTemplate(item)}
    />
  );
  const savedRoute = (id: string, edit = false) => {
    router.push({
      pathname: "/create",
      params: {
        template: id,
        ...context,
        planSession: undefined,
        ...(edit ? { editTemplate: "yes" } : {}),
      },
    });
  };
  const savedCard = (item: (typeof own)[number]) => (
    <TemplateChoice
      item={{
        ...item,
        suggestedTools: (
          [
            ["chat", "enable_chat"],
            ["checklist", "enable_checklist"],
            ["notes", "enable_journal"],
            ["focus", "enable_focus"],
            ["memories", "enable_experiences"],
            ["music", "enable_music"],
            ["scoreboard", "enable_scoreboard"],
          ] as const
        )
          .filter(([, key]) => item.module_defaults?.[key])
          .map(([tool]) => tool),
      }}
      title={item.name}
      icon={<ActivityBadge category={item.category} size={34} />}
      expanded={previewId === "saved:" + item.id}
      onPreview={() => togglePreview("saved:" + item.id)}
      onApply={() => savedRoute(item.id)}
    />
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
          borderColor: design.categories[item.category].color,
          backgroundColor: design.categories[item.category].tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={design.categories[item.category].color} />
      </View>
    );
  }
  const familyCard = (item: TemplateFamily) => {
    const Icon = icons[item.icon as keyof typeof icons] ?? Sparkles;
    const tone =
      design.categories[familyTemplates(item)[0]?.category ?? "Other"];
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        onPress={() => setFamily(item)}
        style={({ pressed }) => ({
          width: "47%",
          flexGrow: 1,
          minHeight: 132,
          padding: 14,
          gap: 8,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            padding: 8,
            borderRadius: 12,
            alignSelf: "flex-start",
            backgroundColor: tone.tint,
          }}
        >
          <Icon size={24} color={tone.color} />
        </View>
        <Text numberOfLines={2} style={[styles.h2, { fontSize: 15 }]}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={[styles.muted, { fontSize: 12 }]}>
          {item.description}
        </Text>
      </Pressable>
    );
  };
  const openBrowser = (nextSource = "Browse") => {
    router.push({
      pathname: "/beacon-templates",
      params: {
        ...context,
        templates: nextSource === "My Templates" ? "mine" : "all",
      },
    });
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
  if (browser)
    return (
      <Screen
        title={
          source === "My Templates"
            ? "My Templates"
            : (family?.title ?? "Beacon Templates")
        }
        eyebrow="START WITH AN IDEA"
        compactHeader
        create={false}
        scrollStateKey={source + (family?.id ?? "")}
      >
        <Txt muted>
          {source === "My Templates"
            ? "Your saved starting points, ready for the next plan."
            : "Find an activity, make it yours, and bring your people."}
        </Txt>
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
        {source === "My Templates" && <PremiumPreview kind="Beacon" />}
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
              <SemanticEmpty
                name={query.trim() ? "empty.search" : "empty.templates"}
                illustration="templates"
                density="section"
                action={{
                  label: query.trim() ? "Clear search" : "Browse templates",
                  onPress: () => {
                    setQuery("");
                    setSource("Browse");
                    setFamily(null);
                  },
                }}
              />
            )}
            <Button
              secondary
              title="Create Blank Template"
              onPress={() => {
                router.push({
                  pathname: "/create",
                  params: {
                    ...context,
                    saveTemplate: "yes",
                    editor: "yes",
                    planSession: undefined,
                  },
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
            {section(
              "QUICK START",
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {mainTemplateFamilies.map(familyCard)}
              </View>,
            )}
            {section(
              "MORE ACTIVITIES",
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {moreTemplateFamilies.map(familyCard)}
              </View>,
            )}
          </>
        )}
      </Screen>
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
      {!!(contextError || launcherError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {contextError || launcherError}
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
      <CreationSavedDrafts key={userId} savedToken={routeContext.savedDraft} />
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
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              columnGap: 8,
            }}
          >
            <Text style={styles.label}>RECOMMENDED STARTERS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See All Templates"
              onPress={() => openBrowser()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={{ color: colors.green, fontSize: 12, fontWeight: "600" }}
              >
                See All Templates →
              </Text>
            </Pressable>
          </View>
          <View
            testID="creation-starters"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            {recommended.map((item) => (
              <TemplateChoice
                key={item.id ?? item.title}
                item={item}
                icon={recipeIcon(item)}
                compact
                expanded={previewId === (item.id ?? item.title)}
                onPreview={() => togglePreview(item.id ?? item.title)}
                onApply={() => onTemplate(item)}
              />
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
      <Text style={styles.label}>Plan with Others</Text>
      {card("ping", "Ping", "See who's interested", () =>
        router.push({
          pathname: "/planning/create",
          params: { ...context, kind: "ping", sessionId: randomUUID() },
        }),
      )}
      {card("vote", "Vote Council", "Compare options together", () =>
        router.push({
          pathname: "/planning/create",
          params: { ...context, kind: "vote", sessionId: randomUUID() },
        }),
      )}
      {card("draw", "Draw Council", "Let chance choose", () =>
        router.push({
          pathname: "/planning/create",
          params: {
            ...context,
            kind: "draw",
            sessionId: randomUUID(),
          },
        }),
      )}
      {(data.is_demo === true ||
        data.capabilities?.connected_planning === true) &&
        card("time", "Find a Time", "When works?", () =>
          router.push({
            pathname: "/planning/create",
            params: { ...context, kind: "time", sessionId: randomUUID() },
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
        router.push({ pathname: data.is_demo || data.capabilities?.plan_editor ? "/plan-editor" : "/plans", params: data.is_demo || data.capabilities?.plan_editor ? {} : { create: "yes" } } as Href),
      )}

    </Screen>
  );
}
