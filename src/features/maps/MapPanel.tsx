import PlanningDetailScreen from "@/src/features/planning/PlanningDetailScreen";
import { router } from "expo-router";
import { BeaconMusicLink } from "@/src/features/beacons/BeaconMusicLink";
import { BeaconSheetPeople } from "./BeaconSheetPeople";
import { MapRelationshipActions } from "./MapRelationshipActions";
import type { MapContextFilter } from "./contextFilters";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapBeaconRsvp } from "./MapBeaconRsvp";
import { MapPersonPreview } from "./MapPersonPreview";
import { physicalDirectionsUrl } from "./directions";
import { MoreHorizontal } from "lucide-react-native";
import {
  BeaconToolContent,
  BeaconPanelTabs,
  BeaconToolSwitcher,
  type SheetTool,
} from "./BeaconPanelNavigation";
import { readBeaconTool, rememberBeaconTool } from "./beaconToolPreference";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  Action,
  Button,
  Field,
  IconButton,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { uiHaptics, useReducedMotion } from "@/src/shared/design-system";
import {
  canReadBeaconActivity,
  canReadBeaconModuleEntry,
  canUseBeaconModules,
  beaconChecklistLabel,
} from "@/src/features/beacons/beaconModules";
import {
  canManageBeaconSettings,
  canWriteBeaconModule,
  beaconSeatCount,
} from "@/src/features/beacons/permissions";
import { canReadBeaconMeetingDetails } from "./filtering";
import { activityWhen } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { BeaconTools } from "@/src/features/beacons/BeaconTools";
import { BeaconMemories } from "@/src/features/beacons/BeaconMemories";
import { BeaconScoreboard } from "@/src/features/beacons/BeaconScoreboard";
import { BeaconSettings } from "@/src/features/beacons/BeaconSettings";
import { AttendanceControls } from "@/src/features/beacons/AttendanceControls";
import { ChatThread } from "@/src/features/messages/ChatThread";
import {
  beaconActivityModules,
  beaconLinkedDecision,
  beaconSheetTabs,
  sheetTabForFeature,
  type BeaconSheetTab,
  type BeaconActivityModule,
  type MapBeaconFeature,
} from "./mapBeaconFeatures";
import { clusterPeople } from "./mapDiscovery";

export function MapPanel({
  beaconId,
  onShowContext,
  initialTab = "overview",
  onClose,
  onBeacon,
  collapsed = false,
  expanded = false,
  onResize,
  onCollapse,
}: {
  collapsed?: boolean;
  expanded?: boolean;
  onResize?: () => void;
  onCollapse?: () => void;
  onShowContext?: (filter: MapContextFilter) => void;
  beaconId: string;
  initialTab?: MapBeaconFeature;
  onClose(): void;
  onBeacon(id: string): void;
}) {
  const { data, userId, act } = useBeacon();
  const { styles, colors, tokens } = useTheme();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const explicitSelection = useRef(false);
  const [tab, setTab] = useState<BeaconSheetTab>(
    sheetTabForFeature(initialTab),
  );
  const [focused, setFocused] = useState<MapBeaconFeature | null>(
    ["settings", "comments", "reactions"].includes(initialTab)
      ? initialTab
      : null,
  );
  const [selectedModule, setSelectedModule] = useState<
    BeaconActivityModule | "teams" | "decision" | null
  >(
    [
      "checklist",
      "focus",
      "scoreboard",
      "journal",
      "experiences",
      "music",
    ].includes(initialTab)
      ? (initialTab as BeaconActivityModule)
      : null,
  );
  const activity = data.activities.find((item) => item.id === beaconId);
  const modules = activity ? beaconActivityModules(activity, now) : [];
  const decision = beaconLinkedDecision(data, beaconId, userId);
  const modulePositions = useRef<Record<string, number>>({});
  const [focusedPerson, setFocusedPerson] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const panelRef = useRef<View>(null);
  const offsets = useRef<Record<string, number>>({});
  const currentModule =
    selectedModule &&
    ((selectedModule === "decision" && decision?.status === "open") ||
      (selectedModule === "teams"
        ? modules.includes("scoreboard")
        : selectedModule !== "decision" && modules.includes(selectedModule)))
      ? selectedModule
      : decision?.status === "open"
        ? "decision"
        : (modules[0] ?? "decision");
  const manyModules = modules.length + Number(decision?.status === "open") >= 3;
  const contentKey = focusedPerson
    ? "profile"
    : focused ||
      (tab === "activity" && manyModules ? `activity:${currentModule}` : tab);
  const chooseModule = (
    module: BeaconActivityModule | "teams" | "decision",
  ) => {
    explicitSelection.current = true;
    setSelectedModule(module);
    if (userId) rememberBeaconTool(userId, beaconId, module);
    if (!manyModules)
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({
          y:
            modulePositions.current[
              module === "teams" ? "scoreboard" : module
            ] || 0,
          animated: true,
        }),
      );
  };
  const changeTab = (next: BeaconSheetTab) => {
    setFocused(null);
    setFocusedPerson(null);
    setTab(next);
  };
  const back = () => {
    setFocused(null);
    setFocusedPerson(null);
  };
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const element = panelRef.current as unknown as HTMLElement | null;
      element
        ?.querySelector<HTMLElement>('[aria-label="Beacon menu"]')
        ?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({
        y: offsets.current[contentKey] || 0,
        animated: false,
      }),
    );
    setScrolled((offsets.current[contentKey] || 0) > 1);
    return () => cancelAnimationFrame(frame);
  }, [contentKey, collapsed]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (focused || focusedPerson) back();
        else onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [focused, focusedPerson, onClose]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (focused || focusedPerson) back();
        else onClose();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [focused, focusedPerson, onClose]);
  useEffect(() => {
    if (!userId || (initialTab !== "overview" && initialTab !== "activity"))
      return;
    let active = true;
    void readBeaconTool(userId, beaconId).then((tool) => {
      if (active && tool && !explicitSelection.current) setSelectedModule(tool);
    });
    return () => {
      active = false;
    };
  }, [userId, beaconId, initialTab]);
  const PanelScroll =
    Platform.OS === "web" ? ScrollView : BottomSheetScrollView;
  const [comment, setComment] = useState("");
  const readable =
    !!activity &&
    !!userId &&
    data.viewer_id === userId &&
    canReadBeaconActivity(data, activity, userId);
  if (!readable)
    return (
      <View
        style={{ padding: tokens.layout.screenGutter, gap: tokens.space.md }}
      >
        <Txt>This Beacon is unavailable or no longer shared with you.</Txt>
        <Button title="Close Beacon panel" secondary onPress={onClose} />
      </View>
    );
  const manage = canManageBeaconSettings(data, activity, userId);
  const allowed = canUseBeaconModules(data, activity, userId);
  const place = canReadBeaconMeetingDetails(data, activity, userId)
    ? data.places.find((row) => row.activity_id === activity.id)
    : undefined;
  const owner = data.profiles.find(
    (row) => row.id === activity.owner_id && canViewProfile(data, row, userId),
  );
  const people = clusterPeople(data, [activity.id], [], userId);
  const goingCount = beaconSeatCount(data, activity);
  const availableTools: SheetTool[] = [
    ...(allowed
      ? modules.flatMap((module) =>
          module === "scoreboard" ? [module, "teams" as const] : [module],
        )
      : []),
    ...(decision?.status === "open" ? ["decision" as const] : []),
  ];
  const features = beaconSheetTabs(
    activity,
    decision?.status === "open",
  ).filter((feature) => feature !== "activity" || availableTools.length > 0);
  const activeTab = features.includes(tab) ? tab : "overview";
  const activeFeature =
    focused &&
    (focused === "decision"
      ? !!decision
      : focused === "settings"
        ? manage
        : focused === "comments"
          ? activity.enable_comments !== false
          : focused === "reactions"
            ? activity.enable_reactions !== false
            : modules.includes(focused as BeaconActivityModule))
      ? focused
      : activeTab;
  const orderedTools = availableTools.includes(currentModule)
    ? [
        currentModule,
        ...availableTools.filter((tool) => tool !== currentModule),
      ]
    : availableTools;
  const switchTool = (tool: SheetTool, direction?: number) => {
    if (tool === currentModule) return;
    const travel =
      direction ??
      (orderedTools.indexOf(tool) > orderedTools.indexOf(currentModule)
        ? 1
        : -1);
    chooseModule(tool);
    slide.stopAnimation();
    fade.stopAnimation();
    slide.setValue(reducedMotion ? 0 : travel * 36);
    fade.setValue(reducedMotion ? 0.45 : 0.65);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: reducedMotion ? 120 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const swipeTool = (direction: number) => {
    const index = availableTools.indexOf(currentModule);
    const next = availableTools[index + direction];
    if (next) switchTool(next, direction);
  };
  const past =
    activity.status !== "scheduled" || Date.parse(activity.ends_at) <= now;
  const live = !past && Date.parse(activity.starts_at) <= now;
  const checklist = allowed
    ? data.beacon_checklist_items.filter(
        (row) =>
          row.activity_id === activity.id &&
          canReadBeaconModuleEntry(data, activity, row.author_id, userId),
      )
    : [];
  const teams = allowed
    ? data.beacon_teams.filter((row) => row.activity_id === activity.id)
    : [];
  const directions =
    place && physicalDirectionsUrl(place.latitude, place.longitude);
  const showPerson = (id: string) => {
    setFocusedPerson(id);
    if (collapsed) onResize?.();
  };
  const comments = allowed
    ? data.comments.filter((row) => row.activity_id === activity.id)
    : [];
  return (
    <View
      testID="map-panel"
      ref={panelRef}
      style={[
        styles.card,
        {
          flex: 1,
          minHeight: 0,
          padding: 0,
          gap: 0,
          overflow: "hidden",
          borderWidth: 0,
          borderRadius: 0,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space.sm,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={[
            styles.h2,
            { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 16 },
          ]}
          ellipsizeMode="tail"
          numberOfLines={1}
        >
          {activity.title}
        </Text>
        <IconButton
          label="Beacon menu"
          selected={menuOpen}
          onPress={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal color={colors.ink} size={20} />
        </IconButton>
      </View>
      {menuOpen && (
        <View style={{ paddingHorizontal: 12, gap: 4 }}>
          {manage && (
            <Button
              title="Host controls"
              compact
              secondary
              onPress={() => {
                setMenuOpen(false);
                setFocused("settings");
                if (collapsed) onResize?.();
              }}
            />
          )}
          {onResize && (
            <Button
              title="Resize Beacon sheet"
              compact
              secondary
              onPress={() => {
                setMenuOpen(false);
                onResize();
              }}
            />
          )}
          <Button
            title="Dismiss Beacon panel"
            compact
            secondary
            onPress={onClose}
          />
        </View>
      )}
      <View
        style={{
          paddingHorizontal: tokens.layout.screenGutter,
          paddingBottom: 2,
        }}
      >
        <MapBeaconRsvp activity={activity} compact tooltip />
        {collapsed && (
          <Button
            title="Open Beacon overview"
            compact
            secondary
            onPress={onResize!}
          />
        )}
      </View>
      <View
        style={{ flex: 1, minHeight: 0, display: collapsed ? "none" : "flex" }}
      >
        {focused || focusedPerson ? (
          <View style={{ paddingHorizontal: tokens.layout.screenGutter }}>
            <Button title="Back" compact secondary onPress={back} />
          </View>
        ) : (
          <BeaconPanelTabs
            tabs={features}
            selected={activeTab}
            onSelect={changeTab}
          />
        )}
        {activeFeature === "activity" &&
          !focusedPerson &&
          availableTools.length > 0 && (
            <BeaconToolSwitcher
              tools={orderedTools}
              checklistLabel={beaconChecklistLabel(activity)}
              selected={currentModule}
              onSelect={switchTool}
            />
          )}
        <View
          pointerEvents="none"
          style={{
            height: 1,
            backgroundColor: scrolled ? colors.line : "transparent",
          }}
        />
        <BeaconToolContent
          enabled={
            activeFeature === "activity" && allowed && availableTools.length > 1
          }
          onSwipe={swipeTool}
        >
          <Animated.View
            style={{
              flex: 1,
              minHeight: 0,
              opacity: fade,
              transform: [{ translateX: slide }],
            }}
          >
            <PanelScroll
              ref={scrollRef}
              testID="beacon-sheet-content"
              style={{
                flex: 1,
                minHeight: 0,
                display:
                  activeFeature === "chat" && allowed && !focusedPerson
                    ? "none"
                    : "flex",
              }}
              onScroll={(event) => {
                offsets.current[contentKey] = event.nativeEvent.contentOffset.y;
                const next = event.nativeEvent.contentOffset.y > 1;
                setScrolled((current) => (current === next ? current : next));
              }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 12,
                paddingBottom: tokens.space.xxl + insets.bottom,
                gap: 10,
              }}
            >
              {focusedPerson && (
                <MapPersonPreview
                  personId={focusedPerson}
                  onClose={back}
                  onBeacon={(id) => {
                    back();
                    onBeacon(id);
                  }}
                />
              )}
              {activeFeature === "overview" && !focusedPerson && (
                <View style={{ gap: tokens.space.md }}>
                  <Text style={styles.muted}>
                    {activityWhen(activity, new Date(now))}
                  </Text>
                  <Text style={styles.body}>
                    {activity.description || "A little time together."}
                  </Text>
                  <Text style={styles.muted}>
                    {place?.online_url
                      ? "Virtual"
                      : place?.label || "Meeting details are not shared."}
                  </Text>
                  {owner && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${owner.name}'s profile`}
                      onPress={() => showPerson(owner.id)}
                      style={styles.row}
                    >
                      <ProfileAvatar profile={owner} />
                      <Text style={styles.body}>Hosted by {owner.name}</Text>
                    </Pressable>
                  )}
                  {decision && (
                    <Button
                      title={`View ${decision.kind === "vote" ? "Vote" : "Draw"} decision`}
                      secondary
                      onPress={() => setFocused("decision")}
                    />
                  )}
                  <MapRelationshipActions
                    expanded
                    beaconId={activity.id}
                    onShow={onShowContext}
                  />
                  <BeaconMusicLink activity={activity} />
                  {past && (
                    <Button
                      title="Repeat Beacon"
                      secondary
                      compact
                      onPress={() =>
                        router.push({
                          pathname: "/create",
                          params: { repeat: activity.id },
                        })
                      }
                    />
                  )}
                  {directions && (
                    <Button
                      title="Directions"
                      secondary
                      compact
                      onPress={() => void Linking.openURL(directions)}
                    />
                  )}
                  {place?.online_url && (
                    <Button
                      title="Join online"
                      compact
                      onPress={() => {
                        try {
                          const url = new URL(place.online_url!);
                          if (
                            ["https:", "http:"].includes(url.protocol) &&
                            !url.username &&
                            !url.password
                          )
                            void Linking.openURL(url.toString());
                        } catch {
                          /* Invalid links stay closed. */
                        }
                      }}
                    />
                  )}
                  {allowed && (
                    <View style={[styles.card, { gap: 8 }]}>
                      <Txt>
                        {past
                          ? "Beacon recap"
                          : live
                            ? "Happening now"
                            : "Getting ready"}
                      </Txt>
                      <Txt muted>
                        {goingCount} going
                        {activity.target_count
                          ? ` \u00b7 ${Math.max(0, activity.target_count - goingCount)} more needed`
                          : ""}
                      </Txt>
                      {modules.includes("checklist") && (
                        <Txt muted>
                          {checklist.filter((row) => row.completed).length} of{" "}
                          {checklist.length} checklist items done
                        </Txt>
                      )}
                      {modules.includes("scoreboard") && teams.length > 0 && (
                        <Txt muted>
                          {teams
                            .map((team) => `${team.name} ${team.score}`)
                            .join(" \u00b7 ")}
                        </Txt>
                      )}
                      {activity.enable_comments !== false && (
                        <Button
                          title={`Comments \u00b7 ${comments.length}`}
                          compact
                          secondary
                          onPress={() => setFocused("comments")}
                        />
                      )}
                      {activity.enable_reactions !== false && (
                        <Button
                          title="Reactions"
                          compact
                          secondary
                          onPress={() => setFocused("reactions")}
                        />
                      )}
                    </View>
                  )}
                  {allowed && <AttendanceControls activity={activity} />}
                </View>
              )}
              {activeFeature === "people" &&
                !focusedPerson &&
                (allowed ? (
                  <BeaconSheetPeople
                    activity={activity}
                    onPerson={showPerson}
                  />
                ) : (
                  <View style={{ gap: 8 }}>
                    {people.map((person) => (
                      <Button
                        key={person.id}
                        title={person.name}
                        secondary
                        onPress={() => showPerson(person.id)}
                      />
                    ))}
                    <Txt muted>
                      Join this Beacon to see participant responses and
                      invitations.
                    </Txt>
                  </View>
                ))}
              {activeFeature !== "overview" &&
                activeFeature !== "people" &&
                activeFeature !== "decision" &&
                !allowed &&
                !focusedPerson && (
                  <Txt muted>
                    Join this Beacon to use its participant features. Approval
                    may be required.
                  </Txt>
                )}
              {allowed && activeFeature === "comments" && (
                <View style={{ gap: tokens.space.sm }}>
                  {!comments.length && <Txt muted>No comments yet.</Txt>}
                  {comments.map((row) => {
                    const author = data.profiles.find(
                      (person) =>
                        person.id === row.author_id &&
                        canViewProfile(data, person, userId),
                    );
                    return (
                      <View key={row.id} style={styles.card}>
                        <Txt muted>{author?.name || "Beacon participant"}</Txt>
                        <Txt>{row.body}</Txt>
                      </View>
                    );
                  })}
                  {canWriteBeaconModule(data, activity, userId, "comments") && (
                    <>
                      <Field
                        label="Add a comment"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        maxLength={2000}
                      />
                      <Action
                        title="Post comment"
                        disabled={!comment.trim()}
                        run={async () => {
                          await act("comment", {
                            id: activity.id,
                            body: comment.trim(),
                          });
                          setComment("");
                        }}
                      />
                    </>
                  )}
                </View>
              )}
              {allowed && activeFeature === "reactions" && (
                <View style={{ gap: tokens.space.sm }}>
                  <Txt muted>
                    {
                      data.reactions.filter(
                        (row) => row.activity_id === activity.id,
                      ).length
                    }{" "}
                    reactions
                  </Txt>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: tokens.space.sm,
                    }}
                  >
                    {["\u{1F64C}"].map((emoji) => (
                      <Action
                        key={emoji}
                        title={emoji}
                        secondary
                        compact
                        disabled={
                          !canWriteBeaconModule(
                            data,
                            activity,
                            userId,
                            "reactions",
                          ) ||
                          data.reactions.some(
                            (row) =>
                              row.activity_id === activity.id &&
                              row.user_id === userId &&
                              row.emoji === emoji,
                          )
                        }
                        run={async () => {
                          await act("react", { id: activity.id });
                          void uiHaptics.success();
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
              {decision &&
                (activeFeature === "decision" ||
                  (activeFeature === "activity" &&
                    decision.status === "open" &&
                    (!manyModules ||
                      !allowed ||
                      currentModule === "decision"))) &&
                !focusedPerson && (
                  <View
                    onLayout={(event) => {
                      modulePositions.current.decision =
                        event.nativeEvent.layout.y;
                    }}
                  >
                    <PlanningDetailScreen
                      key={decision.id}
                      threadId={decision.id}
                      embedded
                      onShowSuggested={
                        onShowContext
                          ? (id) => onShowContext({ kind: "thread", id })
                          : undefined
                      }
                    />
                  </View>
                )}
              {allowed &&
                modules.map((module) => {
                  const visible =
                    !focusedPerson &&
                    (activeFeature === module ||
                      (activeFeature === "activity" &&
                        (!manyModules ||
                          currentModule === module ||
                          (module === "scoreboard" &&
                            currentModule === "teams"))));
                  return (
                    <View
                      key={module}
                      onLayout={(event) => {
                        modulePositions.current[module] =
                          event.nativeEvent.layout.y;
                      }}
                      style={{
                        display: visible ? "flex" : "none",
                        gap: tokens.space.sm,
                      }}
                    >
                      <View>
                        {(
                          ["checklist", "journal", "focus"] as string[]
                        ).includes(module) && (
                          <BeaconTools
                            activity={activity}
                            section={
                              module as "checklist" | "journal" | "focus"
                            }
                            inlineEditors
                          />
                        )}
                        {module === "experiences" && (
                          <>
                            <BeaconMemories activity={activity} />
                            {past &&
                              manyModules &&
                              modules.includes("journal") && (
                                <Button
                                  title="Reflections & notes"
                                  secondary
                                  compact
                                  onPress={() => switchTool("journal")}
                                />
                              )}
                          </>
                        )}
                        {module === "scoreboard" && (
                          <>
                            <BeaconScoreboard
                              activity={activity}
                              compact
                              section={
                                currentModule === "teams" ? "teams" : "game"
                              }
                            />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              {allowed &&
                activeFeature === "activity" &&
                !focusedPerson &&
                decision &&
                decision.status !== "open" && (
                  <View style={styles.card}>
                    <Txt>{decision.title}</Txt>
                    <Txt muted>{decision.status.replaceAll("_", " ")}</Txt>
                    <Button
                      title={`View ${decision.kind === "vote" ? "Vote" : "Draw"} decision`}
                      secondary
                      onPress={() => setFocused("decision")}
                    />
                  </View>
                )}
              {activeFeature === "settings" && manage && (
                <BeaconSettings
                  activity={activity}
                  onSave={(settings) =>
                    act("set_beacon_controls", { id: activity.id, ...settings })
                  }
                />
              )}
            </PanelScroll>
            {allowed && activity.enable_chat !== false && (
              <View
                style={{
                  display:
                    activeFeature === "chat" && !focusedPerson
                      ? "flex"
                      : "none",
                  flex: 1,
                  minHeight: 0,
                  paddingBottom: insets.bottom,
                  paddingHorizontal: 12,
                }}
              >
                {onResize && (
                  <Button
                    compact
                    secondary
                    title={expanded ? "Reduce chat" : "Expand chat"}
                    onPress={onResize}
                  />
                )}
                <ChatThread
                  key={activity.id}
                  activityId={activity.id}
                  inlineActions
                  onPerson={showPerson}
                />
              </View>
            )}
          </Animated.View>
        </BeaconToolContent>
        {onCollapse && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse Beacon sheet"
            onPress={onCollapse}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderTopWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={[styles.label, { color: colors.muted, fontSize: 12 }]}>
              Show map
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
