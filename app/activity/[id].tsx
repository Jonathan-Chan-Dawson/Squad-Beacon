import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import {
  Bookmark,
  Camera,
  Check,
  ClipboardCheck,
  Flag,
  Info,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Music2,
  NotebookPen,
  Pencil,
  Share2,
  Timer,
  Trophy,
  UsersRound,
  Wrench,
} from "lucide-react-native";
import DateField from "@/components/DateField";
import { ActivityDetailHero } from "@/src/features/beacons/components/activity-detail/ActivityDetailHero";
import { ActivityDetailInfo } from "@/src/features/beacons/components/activity-detail/ActivityDetailInfo";
import { ActivityDetailProgress } from "@/src/features/beacons/components/activity-detail/ActivityDetailProgress";
import {
  ActivityDetailPeople,
  type SafeRsvpRow,
} from "@/components/activity-detail/ActivityDetailPeople";
import {
  ActivityDetailTools,
  type ActivityDetailToolDescriptor,
} from "@/components/activity-detail/ActivityDetailTools";
import {
  canReadBeaconActivity,
  canReadBeaconModuleEntry,
  canReadBeaconNote,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { BeaconSettings } from "@/src/features/beacons/BeaconSettings";
import { BeaconTools } from "@/src/features/beacons/BeaconTools";
import { BeaconMemories } from "@/src/features/beacons/BeaconMemories";
import { BeaconScoreboard } from "@/src/features/beacons/BeaconScoreboard";
import { AttendanceControls } from "@/src/features/beacons/AttendanceControls";
import { beaconSettingsDraftKey } from "@/src/features/beacons/controls";
import {
  beaconCapacity,
  canAdmitBeaconParticipants,
  canManageBeacon,
  canManageBeaconSettings,
  canRemoveBeaconParticipant,
  canWriteBeaconModule,
  isBeaconModuleEnabled,
} from "@/src/features/beacons/permissions";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { physicalDirectionsUrl } from "@/src/features/maps/directions";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { useBeacon } from "@/src/shared/store";
import type { Activity, Profile, RSVP } from "@/src/shared/types";
import { friendIds, validateActivity } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import {
  Action,
  Button,
  Empty,
  Field,
  Sheet,
  Txt,
  uiHaptics,
  useTheme,
} from "@/src/shared/ui";
import {
  GlassBar,
  Skeleton,
  useReducedMotion,
} from "@/src/shared/design-system";
import {
  canReadMemory,
  mediaForActivity,
  type BeaconMemory,
} from "@/src/features/beacons/models";

type DetailTab = "Overview" | "People" | "Tools" | "Chat";
const tabIcons = {
  Overview: Info,
  People: UsersRound,
  Tools: Wrench,
  Chat: MessagesSquare,
} satisfies Record<DetailTab, typeof Info>;

type ToolId =
  | "checklist"
  | "journal"
  | "focus"
  | "experiences"
  | "scoreboard"
  | "music"
  | "chat";
const toolLabels: Record<ToolId, string> = {
  checklist: "Checklist",
  journal: "Journal",
  focus: "Focus timer",
  experiences: "Memories",
  scoreboard: "Teams & scores",
  music: "Music",
  chat: "Chat",
};
const toolIcons: Record<ToolId, React.ReactNode> = {
  checklist: <ListChecks size={20} />,
  journal: <NotebookPen size={20} />,
  focus: <Timer size={20} />,
  experiences: <Camera size={20} />,
  scoreboard: <Trophy size={20} />,
  music: <Music2 size={20} />,
  chat: <MessagesSquare size={20} />,
};

function friendlyDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return "Time to be decided";
  const sameDay = start.toDateString() === end.toDateString();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const day =
    start.toDateString() === today.toDateString()
      ? "Today"
      : start.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : start.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
  const time = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const endText = sameDay
    ? time(end)
    : end.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      time(end);
  return day + " · " + time(start) + "–" + endText;
}

function safeWebUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username &&
      !parsed.password
    )
      return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

function feedbackMessage(failure: unknown, fallback: string) {
  return failure instanceof Error && failure.message.trim()
    ? failure.message
    : fallback;
}

function safeProfile(
  data: ReturnType<typeof useBeacon>["data"],
  profile: Profile | undefined,
  userId: string | null,
) {
  return !!(
    profile &&
    userId &&
    (profile.id === userId || canViewProfile(data, profile, userId))
  );
}

function activityHasTools(activity: Activity) {
  return (
    isBeaconModuleEnabled(activity, "checklist") ||
    isBeaconModuleEnabled(activity, "journal") ||
    isBeaconModuleEnabled(activity, "focus") ||
    isBeaconModuleEnabled(activity, "experiences") ||
    isBeaconModuleEnabled(activity, "scoreboard") ||
    (isBeaconModuleEnabled(activity, "music") && !!activity.music_url)
  );
}

export default function ActivityDetail() {
  const { colors, styles, tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    id,
    tab: initialTab,
    from,
  } = useLocalSearchParams<{
    id: string;
    tab?: string;
    from?: string;
  }>();
  const reducedMotion = useReducedMotion();
  const detailAnimation =
    from === "map" ? (reducedMotion ? "none" : "fade") : undefined;
  const { data, userId, demo, loading, error, refresh, act } = useBeacon();
  const activityId = Array.isArray(id) ? id[0] : id;
  const activity = data.activities.find((item) => item.id === activityId);
  const now = useNow();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [selectedTab, setSelectedTab] = useState<{
    activityId: string;
    tab: DetailTab;
  }>({
    activityId: activityId ?? "",
    tab: initialTab === "chat" ? "Chat" : "Overview",
  });
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [report, setReport] = useState(false);
  const [confirmReport, setConfirmReport] = useState(false);
  const [reason, setReason] = useState("");
  const [overflow, setOverflow] = useState(false);
  const [manage, setManage] = useState(false);
  const [hostSheet, setHostSheet] = useState(false);
  const [denyTarget, setDenyTarget] = useState<SafeRsvpRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SafeRsvpRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionTray, setReactionTray] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState(false);
  const [joining, setJoining] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [joinFeedback, setJoinFeedback] = useState(false);
  const [rsvpChoices, setRsvpChoices] = useState(false);
  const [floatingReactionProgress] = useState(() => new Animated.Value(0));
  const [interactionActivityId, setInteractionActivityId] =
    useState(activityId);
  if (interactionActivityId !== activityId) {
    setInteractionActivityId(activityId);
    setSelectedTool(null);
    setJoinFeedback(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    setInteractionError("");
    setRetryAction(null);
    try {
      await refresh();
    } catch (failure) {
      setInteractionError(
        feedbackMessage(failure, "Could not refresh. Try again."),
      );
      setRetryAction(() => () => {
        void onRefresh();
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (!activity || !activityId) {
    return (
      <>
        <Stack.Screen options={{ animation: detailAnimation }} />
        <SafeAreaView edges={["top"]} style={styles.screen}>
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={{ flex: 1 }}>
                <Skeleton
                  height={212}
                  borderRadius={0}
                  style={{ position: "absolute", top: 0, left: 0, right: 0 }}
                />
                <View
                  style={{
                    flex: 1,
                    width: Math.min(
                      width,
                      tokens.layout.contentMaxWidth ?? width,
                    ),
                    maxWidth: "100%",
                    alignSelf: "center",
                    paddingHorizontal: tokens.layout.screenGutter,
                    paddingTop: 228,
                    paddingBottom: 112 + insets.bottom,
                    gap: tokens.space.md,
                  }}
                >
                  <Skeleton height={132} borderRadius={18} />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Skeleton width={48} height={48} borderRadius={24} />
                    <Skeleton height={58} style={{ flex: 1 }} />
                  </View>
                  <Skeleton height={116} borderRadius={18} />
                </View>
                <GlassBar
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 0,
                    paddingHorizontal: tokens.layout.screenGutter,
                    paddingTop: 9,
                    paddingBottom: Math.max(insets.bottom, 10),
                  }}
                >
                  <View
                    style={{
                      width: Math.min(
                        width,
                        tokens.layout.contentMaxWidth ?? width,
                      ),
                      maxWidth: "100%",
                      alignSelf: "center",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Skeleton height={48} style={{ flex: 1 }} />
                    <Skeleton width={48} height={48} borderRadius={24} />
                  </View>
                </GlassBar>
              </View>
            ) : error ? (
              <>
                <Empty
                  title="Couldn't load this activity."
                  body="Your activity data could not be refreshed."
                />
                <Action title="Try again" run={refresh} />
                <Button
                  title="Back to activities"
                  secondary
                  onPress={() => router.replace("/(tabs)/activities")}
                />
              </>
            ) : (
              <>
                <Empty
                  title="This plan is no longer visible."
                  body="It may have been removed, or its audience may have changed."
                />
                <Button
                  title="Back to activities"
                  onPress={() => router.replace("/(tabs)/activities")}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </>
    );
  }

  const canRead = !!userId && canReadBeaconActivity(data, activity, userId);
  if (!canRead) {
    return (
      <>
        <Stack.Screen options={{ animation: detailAnimation }} />
        <SafeAreaView edges={["top"]} style={styles.screen}>
          <View style={[styles.content, { flex: 1, justifyContent: "center" }]}>
            <Empty
              title="This activity is no longer available."
              body="Its audience or your access may have changed."
            />
            <Button
              title="Back to activities"
              onPress={() => router.replace("/(tabs)/activities")}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  const owner = data.profiles.find(
    (profile) => profile.id === activity.owner_id,
  );
  const ownerVisible = safeProfile(data, owner, userId);
  const hostName = ownerVisible ? (owner?.name ?? "You") : "Beacon host";
  const canAccess = !!userId && canUseBeaconModules(data, activity, userId);
  const mine = activity.owner_id === userId;
  const canManage = !!userId && canManageBeacon(data, activity, userId);
  const canManageSettings =
    !!userId && canManageBeaconSettings(data, activity, userId);
  const canAdmit =
    !!userId && canAdmitBeaconParticipants(data, activity, userId);
  const approvalRequired =
    activity.approval_required || activity.mode === "invite";
  const isApprovalPending = (rsvp: RSVP | undefined) =>
    !!(
      rsvp &&
      !rsvp.approved &&
      (rsvp.status === "requested" ||
        (rsvp.status === "going" && approvalRequired))
    );
  const canSeeMeeting = !!(
    userId && canReadBeaconMeetingDetails(data, activity, userId)
  );
  const canReadMemoryHistory = (memory: BeaconMemory) => {
    if (!userId || data.viewer_id !== userId) return false;
    if (isBeaconModuleEnabled(activity, "experiences"))
      return canReadMemory(data, activity, memory, userId);
    const current = data.beacon_memories.find(
      (item) =>
        item.id === memory.id &&
        item.activity_id === activity.id &&
        item.author_id === memory.author_id &&
        item.object_path === memory.object_path,
    );
    return !!(
      current &&
      memory.activity_id === activity.id &&
      canReadBeaconModuleEntry(data, activity, memory.author_id, userId) &&
      canViewProfile(data, memory.author_id, userId)
    );
  };
  const place = canSeeMeeting
    ? data.places.find((item) => item.activity_id === activity.id)
    : undefined;
  const plan = activity.plan_id
    ? data.plans.find((item) => item.id === activity.plan_id)
    : undefined;
  const decision =
    userId && data.viewer_id === userId
      ? data.planning_threads.find(
          (thread) =>
            (thread.kind === "vote" || thread.kind === "draw") &&
            thread.materialized_activity_id === activity.id &&
            canReadPlanningThread(data, thread, userId),
        )
      : undefined;
  const aspirations = ownerVisible
    ? (owner?.aspiration_goals ?? []).filter((goal) =>
        activity.aspiration_ids.includes(goal.id),
      )
    : [];
  const capacity = beaconCapacity(data, activity);
  const rsvps = data.rsvps.filter((rsvp) => rsvp.activity_id === activity.id);
  const myRsvp = rsvps.find((rsvp) => rsvp.user_id === userId);
  const rosterVisible = canAccess;
  const profileFor = (rsvp: RSVP) =>
    data.profiles.find((profile) => profile.id === rsvp.user_id);
  const visibleRows = rosterVisible
    ? rsvps.filter((rsvp) => {
        const profile = profileFor(rsvp);
        return (
          (rsvp.status !== "requested" ||
            canAdmit ||
            rsvp.user_id === userId) &&
          (rsvp.user_id === userId || safeProfile(data, profile, userId))
        );
      })
    : [];
  const toSafeRow = (rsvp: RSVP): SafeRsvpRow => {
    const profile = profileFor(rsvp);
    const visible = safeProfile(data, profile, userId);
    return {
      userId: rsvp.user_id,
      name:
        rsvp.user_id === userId
          ? "You"
          : visible
            ? (profile?.name ?? "Beacon participant")
            : "Beacon participant",
      profile: visible ? profile : undefined,
      isSelf: rsvp.user_id === userId,
    };
  };
  const goingRows = visibleRows
    .filter(
      (rsvp) =>
        rsvp.status === "going" &&
        (rsvp.approved ||
          !(activity.approval_required || activity.mode === "invite")),
    )
    .map(toSafeRow);
  const maybeRows = visibleRows
    .filter((rsvp) => rsvp.status === "interested")
    .map(toSafeRow);
  const requestRows = visibleRows.filter(isApprovalPending).map(toSafeRow);
  const friends = userId ? friendIds(data, userId) : [];
  const commentsEnabled = activity.enable_comments !== false;
  const canReadComments = commentsEnabled && canAccess;
  const canComment =
    canReadComments && activity.status !== "cancelled" && !!userId && canAccess;
  const comments = canReadComments
    ? data.comments
        .filter((item) => item.activity_id === activity.id)
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
    : [];
  const savedBeacon = data.beacon_favorites.some(
    (favorite) =>
      favorite.owner_id === userId && favorite.activity_id === activity.id,
  );
  const hasReaction = data.reactions.some(
    (reaction) =>
      reaction.activity_id === activity.id && reaction.user_id === userId,
  );
  const reactionCount = data.reactions.filter(
    (reaction) => reaction.activity_id === activity.id,
  ).length;
  const chatEnabled = isBeaconModuleEnabled(activity, "chat");
  const hasChatHistory = data.messages.some(
    (message) => message.activity_id === activity.id,
  );
  const options: DetailTab[] = ["Overview"];
  if (rosterVisible) options.push("People");
  const hasPausedHistory =
    canAccess &&
    (
      [
        "checklist",
        "journal",
        "experiences",
        "scoreboard",
        "music",
        "chat",
      ] as ToolId[]
    ).some(
      (tool) =>
        !isBeaconModuleEnabled(
          activity,
          tool === "experiences"
            ? "experiences"
            : tool === "scoreboard"
              ? "scoreboard"
              : tool === "music"
                ? "music"
                : tool,
        ) &&
        (tool === "chat"
          ? hasChatHistory
          : tool === "music"
            ? !!activity.music_url
            : tool === "checklist"
              ? data.beacon_checklist_items.some(
                  (item) =>
                    item.activity_id === activity.id &&
                    canReadBeaconModuleEntry(
                      data,
                      activity,
                      item.author_id,
                      userId!,
                    ),
                )
              : tool === "journal"
                ? data.beacon_notes.some(
                    (note) =>
                      note.activity_id === activity.id &&
                      canReadBeaconNote(data, note, userId!),
                  )
                : tool === "experiences"
                  ? mediaForActivity(data, activity.id).some(
                      canReadMemoryHistory,
                    )
                  : data.beacon_teams.some(
                      (team) => team.activity_id === activity.id,
                    )),
    );
  if (
    canAccess &&
    (activityHasTools(activity) || hasPausedHistory || chatEnabled)
  )
    options.push("Tools");
  if (canAccess && (chatEnabled || hasChatHistory)) options.push("Chat");
  const requestedTab =
    selectedTab.activityId === activity.id ? selectedTab.tab : "Overview";
  const visibleTab = options.includes(requestedTab) ? requestedTab : "Overview";
  const selectTab = (tab: DetailTab) => {
    setSelectedTab({ activityId: activity.id, tab });
  };
  const canShareHost = !!(
    ownerVisible &&
    owner &&
    userId &&
    owner.id !== userId &&
    friends.includes(owner.id)
  );
  const openProfile = (profileId: string) =>
    router.push({ pathname: "/person/[id]", params: { id: profileId } });
  const openOnline = async (value: string) => {
    const safeUrl = safeWebUrl(value);
    if (!safeUrl || !place || safeUrl !== safeWebUrl(place.online_url)) return;
    try {
      if (await Linking.canOpenURL(safeUrl)) await Linking.openURL(safeUrl);
    } catch {
      // A destination may become unavailable after the activity loads.
    }
  };
  const openMusic = async () => {
    const safeUrl = safeWebUrl(activity.music_url);
    if (!safeUrl || safeUrl !== safeWebUrl(activity.music_url)) return;
    try {
      if (await Linking.canOpenURL(safeUrl)) await Linking.openURL(safeUrl);
    } catch {
      // A destination may become unavailable after the activity loads.
    }
  };
  const openDirections = async () => {
    if (!canSeeMeeting || !place || place.online_url) return;
    const directionsUrl = physicalDirectionsUrl(
      place.latitude,
      place.longitude,
    );
    if (!directionsUrl || !safeWebUrl(directionsUrl)) return;
    try {
      if (await Linking.canOpenURL(directionsUrl))
        await Linking.openURL(directionsUrl);
    } catch {
      // Directions can be unavailable on the current device.
    }
  };
  const openMap = () =>
    router.push({ pathname: "/(tabs)", params: { beacon: activity.id } });
  const shareActivity = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    setInteractionError("");
    setRetryAction(null);
    try {
      const shareUrl = ExpoLinking.createURL(
        "/activity/" + encodeURIComponent(activity.id),
      );
      await Share.share({
        title: activity.title,
        message:
          activity.title +
          " · " +
          friendlyDateRange(activity.starts_at, activity.ends_at) +
          "\n" +
          shareUrl,
      });
    } catch (failure) {
      setInteractionError(
        feedbackMessage(failure, "Could not open sharing. Try again."),
      );
      setRetryAction(() => () => {
        void shareActivity();
      });
    } finally {
      setShareBusy(false);
    }
  };
  const toggleSavedBeacon = async () => {
    if (saveBusy) return;
    setSaveBusy(true);
    setInteractionError("");
    setRetryAction(null);
    try {
      await act("save_beacon", {
        activity_id: activity.id,
        saved: !savedBeacon,
      });
      setOverflow(false);
    } catch (failure) {
      setInteractionError(
        feedbackMessage(failure, "Could not save this Beacon. Try again."),
      );
      setRetryAction(() => () => {
        void toggleSavedBeacon();
      });
    } finally {
      setSaveBusy(false);
    }
  };
  const showFloatingReaction = () => {
    setFloatingReaction(true);
    floatingReactionProgress.setValue(0);
    if (reducedMotion) {
      floatingReactionProgress.setValue(1);
    } else {
      Animated.timing(floatingReactionProgress, {
        toValue: 1,
        duration: 750,
        useNativeDriver: true,
      }).start();
    }
    setTimeout(() => setFloatingReaction(false), 900);
  };
  const sendReaction = async () => {
    if (reactionBusy || hasReaction) return false;
    setReactionBusy(true);
    setInteractionError("");
    setRetryAction(null);
    try {
      await act("react", { id: activity.id });
      await uiHaptics.success();
      setReactionTray(true);
      showFloatingReaction();
      setTimeout(() => setReactionTray(false), 1100);
      return true;
    } catch (failure) {
      setInteractionError(
        feedbackMessage(failure, "Could not send your reaction. Try again."),
      );
      setRetryAction(() => () => {
        void sendReaction();
      });
      return false;
    } finally {
      setReactionBusy(false);
    }
  };
  const respond = async (
    status: "going" | "interested" | "withdraw",
  ): Promise<boolean> => {
    if (rsvpBusy) return false;
    setRsvpBusy(true);
    setInteractionError("");
    setRetryAction(null);
    setJoining(status !== "withdraw");
    try {
      await act("rsvp", { id: activity.id, status });
      if (status !== "withdraw") {
        await uiHaptics.success();
        if (status === "going") {
          setJoinFeedback(true);
          setTimeout(() => setJoinFeedback(false), 1200);
        }
      }
      return true;
    } catch (failure) {
      setJoinFeedback(false);
      setInteractionError(
        feedbackMessage(failure, "Could not update your response. Try again."),
      );
      setRetryAction(() => () => {
        void respond(status);
      });
      return false;
    } finally {
      setJoining(false);
      setRsvpBusy(false);
    }
  };
  const denyRequest = async () => {
    if (!denyTarget || !userId || !canAdmit) return;
    const currentRequest = data.rsvps.find(
      (rsvp) =>
        rsvp.activity_id === activity.id && rsvp.user_id === denyTarget.userId,
    );
    if (
      !isApprovalPending(currentRequest) ||
      !canRemoveBeaconParticipant(data, activity, userId, denyTarget.userId)
    ) {
      setDenyTarget(null);
      return;
    }
    await act("remove_rsvp", {
      id: activity.id,
      user_id: denyTarget.userId,
    });
    setDenyTarget(null);
  };
  const removeParticipant = async () => {
    if (!removeTarget || !userId || removeTarget.isSelf) return;
    const currentRsvp = data.rsvps.find(
      (rsvp) =>
        rsvp.activity_id === activity.id &&
        rsvp.user_id === removeTarget.userId,
    );
    if (
      !currentRsvp ||
      currentRsvp.status === "requested" ||
      !canRemoveBeaconParticipant(data, activity, userId, removeTarget.userId)
    ) {
      setRemoveTarget(null);
      return;
    }
    await act("remove_rsvp", {
      id: activity.id,
      user_id: removeTarget.userId,
    });
    setRemoveTarget(null);
  };
  const progressAvatars = [
    ...(ownerVisible && owner ? [owner] : []),
    ...goingRows.map((row) => row.profile),
  ]
    .filter((profile): profile is Profile => !!profile)
    .slice(0, 5);
  const isPast = Date.parse(activity.ends_at) <= now;
  const startsAt = Date.parse(activity.starts_at);
  const startsInMinutes = Math.max(0, Math.ceil((startsAt - now) / 60_000));
  const startLabel =
    startsAt <= now
      ? "Happening now"
      : startsInMinutes < 60
        ? "Starts in " + startsInMinutes + " min"
        : startsInMinutes < 24 * 60
          ? "Starts in " + Math.ceil(startsInMinutes / 60) + " hr"
          : "Starts in " + Math.ceil(startsInMinutes / (60 * 24)) + " days";
  const stateLabel =
    activity.status === "cancelled"
      ? "Cancelled"
      : activity.status === "completed" || isPast
        ? "Ended"
        : isApprovalPending(myRsvp)
          ? "Request pending"
          : myRsvp?.status === "going"
            ? "Going"
            : myRsvp?.status === "interested"
              ? "Maybe"
              : myRsvp?.status === "invited"
                ? "Invited"
                : capacity.closed
                  ? capacity.manuallyClosed
                    ? "Closed"
                    : "Full"
                  : startLabel;
  const stateTone =
    stateLabel === "Request pending"
      ? "pending"
      : stateLabel === "Full" || stateLabel === "Closed"
        ? "closed"
        : stateLabel === "Ended" || stateLabel === "Cancelled"
          ? "ended"
          : "open";
  const audienceChips = [
    activity.audience === "friends"
      ? "Friends only"
      : activity.audience === "list"
        ? "Selected list"
        : activity.audience === "squad"
          ? "Squad"
          : activity.audience === "organization"
            ? "Organization"
            : "Private",
    activity.approval_required
      ? "Host approves"
      : activity.mode === "invite"
        ? "Invitation only"
        : "Open to join",
  ];
  const enabledFor = (tool: ToolId) => {
    if (tool === "experiences")
      return isBeaconModuleEnabled(activity, "experiences");
    if (tool === "scoreboard")
      return isBeaconModuleEnabled(activity, "scoreboard");
    if (tool === "music") return isBeaconModuleEnabled(activity, "music");
    return isBeaconModuleEnabled(activity, tool);
  };
  const hasToolHistory = (tool: ToolId) => {
    if (!userId) return false;
    if (tool === "checklist")
      return data.beacon_checklist_items.some(
        (item) =>
          item.activity_id === activity.id &&
          canReadBeaconModuleEntry(data, activity, item.author_id, userId),
      );
    if (tool === "journal")
      return data.beacon_notes.some(
        (note) =>
          note.activity_id === activity.id &&
          canReadBeaconNote(data, note, userId),
      );
    if (tool === "experiences")
      return mediaForActivity(data, activity.id).some((memory) =>
        canReadMemoryHistory(memory),
      );
    if (tool === "scoreboard")
      return data.beacon_teams.some((team) => team.activity_id === activity.id);
    if (tool === "music") return !!activity.music_url;
    if (tool === "chat") return hasChatHistory;
    return false;
  };
  const toolOrder: ToolId[] = [
    "checklist",
    "journal",
    "focus",
    "experiences",
    "scoreboard",
    "music",
    "chat",
  ];
  const checklistHistory = data.beacon_checklist_items
    .filter(
      (item) =>
        item.activity_id === activity.id &&
        canReadBeaconModuleEntry(data, activity, item.author_id, userId!),
    )
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
  const journalHistory = data.beacon_notes
    .filter(
      (note) =>
        note.activity_id === activity.id &&
        canReadBeaconNote(data, note, userId!),
    )
    .sort((left, right) => left.updated_at.localeCompare(right.updated_at));
  const memoryHistory = mediaForActivity(data, activity.id).filter((memory) =>
    canReadMemoryHistory(memory),
  );
  const scoreboardHistory = data.beacon_teams
    .filter((team) => team.activity_id === activity.id)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
  const toolStatus = (tool: ToolId) => {
    if (!enabledFor(tool)) {
      const count =
        tool === "checklist"
          ? checklistHistory.length
          : tool === "journal"
            ? journalHistory.length
            : tool === "experiences"
              ? memoryHistory.length
              : tool === "scoreboard"
                ? scoreboardHistory.length
                : tool === "music"
                  ? activity.music_url
                    ? 1
                    : 0
                  : tool === "chat"
                    ? data.messages.filter(
                        (message) => message.activity_id === activity.id,
                      ).length
                    : 0;
      return count
        ? count + (tool === "music" ? " saved link" : " saved")
        : "Paused";
    }
    if (tool === "focus") return "On this device";
    if (tool === "checklist") {
      const done = checklistHistory.filter((item) => item.completed).length;
      return checklistHistory.length
        ? done + "/" + checklistHistory.length + " done"
        : "No items yet";
    }
    if (tool === "journal") return journalHistory.length + " shared notes";
    if (tool === "experiences")
      return memoryHistory.length + " shared memories";
    if (tool === "scoreboard") return scoreboardHistory.length + " teams";
    if (tool === "chat")
      return (
        data.messages.filter((message) => message.activity_id === activity.id)
          .length + " messages"
      );
    return activity.music_url ? "Link saved" : "Add a link in settings";
  };
  const tools: ActivityDetailToolDescriptor[] = canAccess
    ? toolOrder
        .filter(
          (tool) =>
            enabledFor(tool) || (tool !== "focus" && hasToolHistory(tool)),
        )
        .map((tool) => ({
          id: tool,
          icon: toolIcons[tool],
          label: toolLabels[tool],
          status: toolStatus(tool),
          paused: !enabledFor(tool),
          onPress: () => {
            if (tool === "chat") selectTab("Chat");
            else setSelectedTool(tool);
          },
        }))
    : [];
  const contentWidth = Math.min(width, tokens.layout.contentMaxWidth ?? width);
  const bottomClearance = 90 + Math.max(insets.bottom, 8);
  const openForRsvp =
    activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
  const pending = isApprovalPending(myRsvp);
  const going = myRsvp?.status === "going" && !pending;
  const approval = approvalRequired && !myRsvp?.approved;
  const blockedForJoin = capacity.closed && !pending && !going;
  const primaryRsvpLabel = !openForRsvp
    ? stateLabel
    : pending
      ? "Request pending"
      : going
        ? "Going ✓"
        : myRsvp?.status === "interested"
          ? "Maybe ✓"
          : capacity.full
            ? "Full"
            : capacity.closed
              ? "Closed"
              : approval
                ? "Request to join"
                : "I'm In";

  return (
    <>
      <Stack.Screen options={{ animation: detailAnimation }} />
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <View style={{ flex: 1 }}>
          <Animated.ScrollView
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.green}
              />
            }
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              {
                width: contentWidth,
                maxWidth: "100%",
                alignSelf: "center",
                paddingTop: width <= 375 || height <= 667 ? 196 : 228,
                paddingBottom: bottomClearance,
                gap: tokens.space.md,
              },
            ]}
          >
            {error ? (
              <View style={[styles.card, { gap: 8 }]}>
                <Txt muted>Could not refresh this activity. {error}</Txt>
                <Action title="Try again" run={refresh} />
              </View>
            ) : null}

            <ActivityDetailInfo
              startsAt={activity.starts_at}
              endsAt={activity.ends_at}
              timezone={
                activity.timezone ===
                Intl.DateTimeFormat().resolvedOptions().timeZone
                  ? null
                  : activity.timezone
              }
              place={
                place
                  ? {
                      label: place.label,
                      latitude: place.latitude,
                      longitude: place.longitude,
                      onlineUrl: place.online_url,
                    }
                  : undefined
              }
              canReadLocation={canSeeMeeting}
              onOpenMap={openMap}
              onOpenOnline={(url) => void openOnline(url)}
              onOpenDirections={() => void openDirections()}
            />

            <View style={[styles.card, styles.row, { gap: 11 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View host profile"
                onPress={() => setHostSheet(true)}
                style={[styles.row, { flex: 1, gap: 11 }]}
              >
                <ProfileAvatar profile={ownerVisible ? owner : undefined} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.muted}>Hosted by</Text>
                  <Text style={styles.body}>{hostName}</Text>
                </View>
              </Pressable>
              {canShareHost && owner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Message host"
                  onPress={() =>
                    router.push({
                      pathname: "/messages/[id]",
                      params: { id: owner.id },
                    })
                  }
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MessageCircle size={19} color={colors.green} />
                </Pressable>
              ) : null}
            </View>

            {activity.mode !== "solo" ? (
              <ActivityDetailProgress
                avatars={progressAvatars}
                count={capacity.count}
                capacity={capacity.limit}
                target={activity.target_count ?? null}
                joining={joining}
              />
            ) : null}

            {activity.description ? (
              <DescriptionCard description={activity.description} />
            ) : null}
            {aspirations.length > 0 ? (
              <Txt muted>
                For: {aspirations.map((goal) => goal.title).join(" · ")}
              </Txt>
            ) : null}
            {plan ? (
              <Button
                title={"Part of " + plan.title}
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/plan/[id]",
                    params: { id: plan.id },
                  })
                }
              />
            ) : null}
            {decision ? (
              <Button
                compact
                secondary
                title={
                  "View " +
                  (decision.kind === "vote" ? "Vote" : "Draw") +
                  " decision"
                }
                onPress={() =>
                  router.push({
                    pathname: "/council/[id]",
                    params: { id: decision.id },
                  })
                }
              />
            ) : null}

            {activity.enable_reactions !== false && canAccess ? (
              <View style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasReaction
                      ? "Reacted with raised hands. " +
                        reactionCount +
                        " reactions"
                      : "React with raised hands. " +
                        reactionCount +
                        " reactions"
                  }
                  disabled={
                    hasReaction ||
                    reactionBusy ||
                    activity.status === "cancelled"
                  }
                  onLongPress={() => setReactionTray(true)}
                  onPress={() => void sendReaction()}
                  style={[
                    styles.card,
                    styles.row,
                    { minHeight: 48, padding: 12 },
                  ]}
                >
                  <Text style={styles.body}>
                    {hasReaction ? "🙌 Reacted" : "🙌 React"}
                  </Text>
                  <Text style={styles.muted}>{reactionCount}</Text>
                  {reactionTray ? (
                    <Check size={17} color={colors.green} />
                  ) : null}
                  {floatingReaction ? (
                    <Animated.Text
                      pointerEvents="none"
                      accessibilityLabel="Reaction sent"
                      style={{
                        position: "absolute",
                        top: -20,
                        right: 24,
                        fontSize: 25,
                        opacity: floatingReactionProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                        transform: [
                          {
                            translateY: floatingReactionProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -24],
                            }),
                          },
                        ],
                      }}
                    >
                      🙌
                    </Animated.Text>
                  ) : null}
                </Pressable>
                {reactionTray ? (
                  <View
                    style={[styles.row, { gap: 8, justifyContent: "center" }]}
                  >
                    <Button
                      compact
                      secondary
                      title="🙌"
                      disabled={reactionBusy || hasReaction}
                      onPress={() => void sendReaction()}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <SlidingTabBar
              options={options}
              activeTab={visibleTab}
              onSelect={selectTab}
              reducedMotion={reducedMotion}
            />

            {visibleTab === "Overview" ? (
              <View style={{ gap: tokens.space.md }}>
                {canReadComments ? (
                  <View style={[styles.card, { gap: 9 }]}>
                    <View style={styles.row}>
                      <MessageCircle size={18} color={colors.green} />
                      <Text style={styles.h2}>Comments</Text>
                    </View>
                    {comments.length ? (
                      comments.map((item) => {
                        const author = data.profiles.find(
                          (profile) => profile.id === item.author_id,
                        );
                        const authorVisible =
                          !!userId &&
                          (item.author_id === userId ||
                            (!!author && canViewProfile(data, author, userId)));
                        return (
                          <View
                            key={item.id}
                            style={{
                              alignSelf:
                                item.author_id === userId
                                  ? "flex-end"
                                  : "flex-start",
                              maxWidth: "90%",
                              padding: 12,
                              borderRadius: 16,
                              backgroundColor:
                                item.author_id === userId
                                  ? colors.lime
                                  : colors.white,
                              gap: 3,
                            }}
                          >
                            <Text style={styles.muted}>
                              {(authorVisible
                                ? (author?.name ?? "You")
                                : "Beacon participant") +
                                " · " +
                                new Date(item.created_at).toLocaleTimeString(
                                  [],
                                  { hour: "numeric", minute: "2-digit" },
                                )}
                            </Text>
                            <Text style={styles.body}>{item.body}</Text>
                          </View>
                        );
                      })
                    ) : (
                      <View style={{ paddingVertical: 8 }}>
                        <Text style={styles.h2}>No comments yet.</Text>
                        <Txt muted>Start the conversation.</Txt>
                      </View>
                    )}
                    {canComment ? (
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
                            if (!comment.trim())
                              throw new Error("Write a comment first.");
                            await act("comment", {
                              id: activity.id,
                              body: comment.trim(),
                            });
                            setComment("");
                          }}
                        />
                      </>
                    ) : (
                      <Txt muted>
                        Comments are for people with access to this Beacon.
                      </Txt>
                    )}
                  </View>
                ) : null}
                {canAccess ? <AttendanceControls activity={activity} /> : null}
              </View>
            ) : null}

            {visibleTab === "People" ? (
              <View style={{ gap: tokens.space.md }}>
                <ActivityDetailPeople
                  going={goingRows}
                  maybe={maybeRows}
                  requested={requestRows}
                  viewerUserId={userId}
                  canAdmit={canAdmit}
                  canRemove={(targetId) =>
                    !!userId &&
                    canRemoveBeaconParticipant(data, activity, userId, targetId)
                  }
                  onProfile={openProfile}
                  onApprove={(targetId) =>
                    act("approve_rsvp", {
                      id: activity.id,
                      user_id: targetId,
                    })
                  }
                  onDeny={(targetId) => {
                    const target = requestRows.find(
                      (row) => row.userId === targetId,
                    );
                    if (target) setDenyTarget(target);
                    return Promise.resolve();
                  }}
                  onRemove={(targetId) => {
                    const target = [...goingRows, ...maybeRows].find(
                      (row) => row.userId === targetId,
                    );
                    if (
                      target &&
                      userId &&
                      canRemoveBeaconParticipant(
                        data,
                        activity,
                        userId,
                        target.userId,
                      )
                    )
                      setRemoveTarget(target);
                  }}
                />
                {canAdmit && activity.status === "scheduled" && !isPast ? (
                  <View style={[styles.card, { gap: 8 }]}>
                    <Text style={styles.h2}>Invite a friend</Text>
                    {data.profiles
                      .filter(
                        (profile) =>
                          friends.includes(profile.id) &&
                          !rsvps.some((rsvp) => rsvp.user_id === profile.id),
                      )
                      .map((profile) => {
                        const visible = safeProfile(data, profile, userId);
                        return (
                          <Action
                            key={profile.id}
                            secondary
                            title={
                              "Invite " + (visible ? profile.name : "friend")
                            }
                            run={() =>
                              act("invite_activity", {
                                id: activity.id,
                                user_id: profile.id,
                              })
                            }
                          />
                        );
                      })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {visibleTab === "Tools" && canAccess ? (
              <View style={{ gap: tokens.space.md }}>
                <ActivityDetailTools tools={tools} />
                {selectedTool === "checklist" && !enabledFor("checklist") ? (
                  <ReadOnlyHistoryCard title="Checklist history">
                    {checklistHistory.length ? (
                      checklistHistory.map((item) => (
                        <View key={item.id} style={styles.row}>
                          <Check
                            size={16}
                            color={item.completed ? colors.green : colors.line}
                          />
                          <Txt>{item.text}</Txt>
                        </View>
                      ))
                    ) : (
                      <Txt muted>No checklist history is available.</Txt>
                    )}
                  </ReadOnlyHistoryCard>
                ) : null}
                {selectedTool === "journal" && !enabledFor("journal") ? (
                  <ReadOnlyHistoryCard title="Journal history">
                    {journalHistory.length ? (
                      journalHistory.map((note) => (
                        <View key={note.id} style={{ gap: 4 }}>
                          <Txt>{note.body}</Txt>
                          <Txt muted>
                            {new Date(note.updated_at).toLocaleDateString()}
                          </Txt>
                        </View>
                      ))
                    ) : (
                      <Txt muted>No shared journal history is available.</Txt>
                    )}
                  </ReadOnlyHistoryCard>
                ) : null}
                {selectedTool === "experiences" ? (
                  enabledFor("experiences") ? (
                    <View style={styles.card}>
                      <BeaconMemories activity={activity} />
                    </View>
                  ) : (
                    <ReadOnlyHistoryCard title="Memory history">
                      {memoryHistory.length ? (
                        memoryHistory.map((memory) => (
                          <View key={memory.id} style={{ gap: 3 }}>
                            <Txt>{memory.caption || "Shared memory"}</Txt>
                            <Txt muted>
                              {new Date(memory.created_at).toLocaleDateString()}
                            </Txt>
                          </View>
                        ))
                      ) : (
                        <Txt muted>No shared memory history is available.</Txt>
                      )}
                    </ReadOnlyHistoryCard>
                  )
                ) : null}
                {selectedTool === "scoreboard" ? (
                  enabledFor("scoreboard") ? (
                    <View style={styles.card}>
                      <BeaconScoreboard activity={activity} />
                    </View>
                  ) : (
                    <ReadOnlyHistoryCard title="Score history">
                      {scoreboardHistory.length ? (
                        scoreboardHistory.map((team) => (
                          <View
                            key={team.id}
                            style={[
                              styles.row,
                              { justifyContent: "space-between" },
                            ]}
                          >
                            <Txt>{team.name}</Txt>
                            <Text style={styles.label}>{team.score}</Text>
                          </View>
                        ))
                      ) : (
                        <Txt muted>No shared score history is available.</Txt>
                      )}
                    </ReadOnlyHistoryCard>
                  )
                ) : null}
                {selectedTool === "music" && activity.music_url ? (
                  <View style={[styles.card, { gap: 8 }]}>
                    <View style={styles.row}>
                      <Music2 size={19} color={colors.green} />
                      <Text style={styles.h2}>Music link</Text>
                    </View>
                    <Txt muted>
                      {enabledFor("music")
                        ? "Opens in your music app. Audio is not played here."
                        : "Music is paused. Its saved link remains available."}
                    </Txt>
                    <Button
                      title="Open music link"
                      secondary
                      onPress={() => void openMusic()}
                      disabled={!safeWebUrl(activity.music_url)}
                    />
                  </View>
                ) : null}
                {selectedTool === "chat" ? (
                  <View style={{ height: 470, minHeight: 320 }}>
                    <ActivityChatPanel activity={activity} />
                  </View>
                ) : null}
                {selectedTool &&
                ["checklist", "journal", "focus"].includes(selectedTool) &&
                (isBeaconModuleEnabled(activity, "checklist") ||
                  isBeaconModuleEnabled(activity, "journal") ||
                  isBeaconModuleEnabled(activity, "focus")) ? (
                  <BeaconTools
                    key={activity.id + ":" + (userId ?? "viewer")}
                    activity={activity}
                  />
                ) : null}
                {canManageSettings ? (
                  <BeaconSettings
                    key={beaconSettingsDraftKey(activity)}
                    activity={activity}
                    onSave={(settings) =>
                      act("set_beacon_controls", {
                        id: activity.id,
                        ...settings,
                      })
                    }
                  />
                ) : null}
                {mine && activity.status === "scheduled" ? (
                  <View style={[styles.card, { gap: 8 }]}>
                    <Text style={styles.h2}>Host controls</Text>
                    <Button
                      secondary
                      title="Edit title or time"
                      onPress={() => {
                        setTitle(activity.title);
                        setStarts(activity.starts_at);
                        setEnds(activity.ends_at);
                        setEdit(true);
                      }}
                    />
                    <Action
                      title="Mark completed"
                      run={() =>
                        act("activity_status", {
                          id: activity.id,
                          status: "completed",
                        })
                      }
                    />
                    <Action
                      title="Cancel Beacon"
                      feedback="warning"
                      secondary
                      run={() =>
                        act("activity_status", {
                          id: activity.id,
                          status: "cancelled",
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {visibleTab === "Chat" && canAccess ? (
              <View style={{ height: 470, minHeight: 320 }}>
                <ActivityChatPanel activity={activity} />
              </View>
            ) : null}
          </Animated.ScrollView>

          <ActivityDetailHero
            title={activity.title}
            category={activity.category}
            modeLabel={
              activity.mode === "solo"
                ? "Solo"
                : activity.mode === "invite"
                  ? "Invite"
                  : "Squad"
            }
            stateLabel={stateLabel}
            stateTone={stateTone}
            chips={audienceChips}
            demo={demo}
            scrollY={scrollY}
            onBack={() => router.back()}
            onOverflow={() => setOverflow(true)}
          />

          <GlassBar
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 4,
              borderRadius: 0,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderBottomWidth: 0,
              paddingHorizontal: tokens.layout.screenGutter,
              paddingTop: 9,
              paddingBottom: Math.max(insets.bottom, 10),
            }}
          >
            {interactionError ? (
              <View
                style={{
                  width: contentWidth,
                  maxWidth: "100%",
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={[styles.error, { flex: 1 }]}
                >
                  {interactionError}
                </Text>
                {retryAction ? (
                  <Button
                    title="Try again"
                    compact
                    secondary
                    onPress={() => retryAction()}
                  />
                ) : null}
              </View>
            ) : null}
            <View
              style={{
                width: contentWidth,
                maxWidth: "100%",
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {canManage ? (
                <Button title="Manage" onPress={() => setManage(true)} />
              ) : mine ? (
                <Button title="You're hosting" disabled onPress={() => {}} />
              ) : activity.mode === "solo" ? (
                <View style={{ flex: 1 }}>
                  <Button title="Solo activity" disabled onPress={() => {}} />
                </View>
              ) : (
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={
                        joining
                          ? "Joining…"
                          : joinFeedback
                            ? approval
                              ? "Request sent ✓"
                              : "You're in ✓"
                            : primaryRsvpLabel
                      }
                      disabled={
                        rsvpBusy ||
                        (!openForRsvp &&
                          !going &&
                          myRsvp?.status !== "interested" &&
                          !pending) ||
                        (blockedForJoin &&
                          !going &&
                          myRsvp?.status !== "interested")
                      }
                      secondary={
                        !!going ||
                        blockedForJoin ||
                        pending ||
                        myRsvp?.status === "interested"
                      }
                      onPress={() => {
                        if (
                          going ||
                          myRsvp?.status === "interested" ||
                          pending
                        ) {
                          setRsvpChoices(true);
                        } else {
                          void respond("going");
                        }
                      }}
                    />
                  </View>
                  {pending ? (
                    <Button
                      title="Cancel request"
                      compact
                      secondary
                      disabled={rsvpBusy}
                      onPress={() => void respond("withdraw")}
                    />
                  ) : !going &&
                    myRsvp?.status !== "interested" &&
                    !blockedForJoin &&
                    openForRsvp ? (
                    <Button
                      title="Maybe"
                      compact
                      secondary
                      disabled={rsvpBusy}
                      onPress={() => void respond("interested")}
                    />
                  ) : null}
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  shareBusy ? "Sharing activity" : "Share activity"
                }
                accessibilityState={{ disabled: shareBusy, busy: shareBusy }}
                disabled={shareBusy}
                onPress={() => void shareActivity()}
                style={({ pressed }) => ({
                  minWidth: 48,
                  minHeight: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.white,
                  borderColor: colors.line,
                  borderWidth: 1,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Share2 size={19} color={colors.ink} />
              </Pressable>
            </View>
          </GlassBar>
        </View>
      </SafeAreaView>

      <Sheet
        title="Activity actions"
        visible={overflow}
        onClose={() => setOverflow(false)}
      >
        {interactionError ? (
          <View
            style={[styles.row, { gap: 8, justifyContent: "space-between" }]}
          >
            <Text accessibilityRole="alert" style={[styles.error, { flex: 1 }]}>
              {interactionError}
            </Text>
            {retryAction ? (
              <Button
                title="Try again"
                compact
                secondary
                onPress={() => retryAction()}
              />
            ) : null}
          </View>
        ) : null}
        <Button
          title={
            saveBusy
              ? "Saving…"
              : savedBeacon
                ? "Remove saved Beacon"
                : "Save Beacon"
          }
          secondary
          disabled={saveBusy}
          icon={<Bookmark size={17} />}
          onPress={() => void toggleSavedBeacon()}
        />
        <Button
          title="Save as a template"
          secondary
          icon={<ClipboardCheck size={17} />}
          onPress={() => {
            setOverflow(false);
            router.push({
              pathname: "/create",
              params: { repeat: activity.id, saveTemplate: "yes" },
            });
          }}
        />
        {activity.status !== "scheduled" ? (
          <Button
            title="Do this again"
            secondary
            onPress={() => {
              setOverflow(false);
              router.push({
                pathname: "/create",
                params: { repeat: activity.id },
              });
            }}
          />
        ) : null}
        {!mine ? (
          <Button
            title="Report this Beacon"
            secondary
            icon={<Flag size={17} />}
            onPress={() => {
              setOverflow(false);
              setReason("");
              setReport(true);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        title="Manage Beacon"
        visible={manage}
        onClose={() => setManage(false)}
      >
        {mine && activity.status === "scheduled" ? (
          <Button
            title="Edit title or time"
            secondary
            icon={<Pencil size={17} />}
            onPress={() => {
              setTitle(activity.title);
              setStarts(activity.starts_at);
              setEnds(activity.ends_at);
              setManage(false);
              setEdit(true);
            }}
          />
        ) : null}
        <Button
          title="Attendance and requests"
          secondary
          onPress={() => {
            setManage(false);
            selectTab("People");
          }}
        />
        <Button
          title="Tools and settings"
          secondary
          onPress={() => {
            setManage(false);
            selectTab("Tools");
          }}
        />
        <Button
          title="Invite people"
          secondary
          onPress={() => {
            setManage(false);
            selectTab("People");
          }}
        />
      </Sheet>

      {owner ? (
        <PersonProfilePreview
          personId={owner.id}
          visible={hostSheet}
          onClose={() => setHostSheet(false)}
        />
      ) : null}

      <Sheet
        title="Update the Beacon"
        visible={edit}
        onClose={() => setEdit(false)}
      >
        <Field label="Title" value={title} onChangeText={setTitle} />
        <DateField label="Starts" value={starts} onChange={setStarts} />
        <DateField label="Ends" value={ends} onChange={setEnds} />
        <Action
          title="Save and notify attendees"
          run={async () => {
            validateActivity({ title, starts_at: starts, ends_at: ends });
            await act("edit_activity", {
              id: activity.id,
              title,
              starts_at: starts,
              ends_at: ends,
            });
            setEdit(false);
          }}
        />
      </Sheet>

      <Sheet
        title="Report Beacon"
        visible={report}
        onClose={() => setReport(false)}
      >
        <Field
          label="What happened? Include relevant context."
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <Button
          title="Review report"
          disabled={reason.trim().length < 5}
          onPress={() => setConfirmReport(true)}
        />
      </Sheet>
      <Sheet
        title="Confirm report"
        visible={confirmReport}
        onClose={() => setConfirmReport(false)}
      >
        <Txt>Your report will be sent to the Squad Beacon team for review.</Txt>
        <Txt muted>{reason.trim()}</Txt>
        <Action
          title="Send report"
          feedback="warning"
          run={async () => {
            await act("report", {
              id: activity.id,
              reason: reason.trim(),
            });
            setConfirmReport(false);
            setReport(false);
          }}
        />
      </Sheet>
      <Sheet
        title="Deny request?"
        visible={!!denyTarget}
        onClose={() => setDenyTarget(null)}
      >
        <Txt>
          {denyTarget
            ? "Remove " +
              denyTarget.name +
              "'s pending request from this Beacon?"
            : ""}
        </Txt>
        <Action title="Deny request" feedback="warning" run={denyRequest} />
      </Sheet>
      <Sheet
        title="Remove participant?"
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
      >
        <Txt>
          {removeTarget
            ? "Remove " +
              removeTarget.name +
              " from this Beacon? Their RSVP and Beacon role will be removed."
            : ""}
        </Txt>
        <Action
          title="Remove participant"
          feedback="warning"
          run={removeParticipant}
        />
      </Sheet>
      <Sheet
        title={pending ? "Request pending" : "Your response"}
        visible={rsvpChoices}
        onClose={() => setRsvpChoices(false)}
      >
        <Txt>
          {pending
            ? "Your request is waiting for the host."
            : "You can update your response while this Beacon is open."}
        </Txt>
        {pending ? (
          <Action
            title="Cancel request"
            secondary
            run={async () => {
              if (await respond("withdraw")) setRsvpChoices(false);
            }}
          />
        ) : myRsvp?.status === "interested" ? (
          <Action
            title={approval ? "Request to join" : "I'm In"}
            run={async () => {
              if (await respond("going")) setRsvpChoices(false);
            }}
          />
        ) : null}
        {!pending ? (
          <Action
            title="I'm Out"
            secondary
            run={async () => {
              if (await respond("withdraw")) setRsvpChoices(false);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function DescriptionCard({ description }: { description: string }) {
  const { colors, styles } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const long = description.trim().split(/\s+/).length > 34;
  return (
    <View style={[styles.card, { gap: 7 }]}>
      <Text style={styles.h2}>About this Beacon</Text>
      <Text
        style={styles.body}
        numberOfLines={expanded ? undefined : 3}
        ellipsizeMode="tail"
      >
        {description}
      </Text>
      {long ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : "Read more"}
          onPress={() => setExpanded((value) => !value)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: colors.green, fontWeight: "700" }}>
            {expanded ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReadOnlyHistoryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { styles } = useTheme();
  return (
    <View style={[styles.card, { gap: 10, opacity: 0.88 }]}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.h2}>{title}</Text>
        <Text style={styles.muted}>Paused · read only</Text>
      </View>
      {children}
    </View>
  );
}

function ActivityChatPanel({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [body, setBody] = useState("");
  const canRead = !!userId && canUseBeaconModules(data, activity, userId);
  const canWrite =
    !!userId && canWriteBeaconModule(data, activity, userId, "chat");
  const messages = canRead
    ? data.messages
        .filter((message) => message.activity_id === activity.id)
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
    : [];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, minHeight: 320, gap: 8 }}>
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 9, paddingVertical: 8, flexGrow: 1 }}
        >
          {messages.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={styles.h2}>Start with a hello.</Text>
              <Txt muted>
                {
                  'Meet-up details, who\'s bringing what, and a quick "on my way".'
                }
              </Txt>
            </View>
          ) : null}
          {messages.map((message) => {
            const author = data.profiles.find(
              (profile) => profile.id === message.author_id,
            );
            const name =
              message.author_id === userId
                ? "You"
                : safeProfile(data, author, userId)
                  ? (author?.name ?? "Beacon participant")
                  : "Beacon participant";
            const own = message.author_id === userId;
            return (
              <View
                key={message.id}
                style={{
                  alignSelf: own ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  padding: 12,
                  gap: 4,
                  borderRadius: 16,
                  backgroundColor: own ? colors.lime : colors.white,
                }}
              >
                <Text style={styles.label}>{name}</Text>
                <Txt>{message.body}</Txt>
                <Txt muted>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Txt>
              </View>
            );
          })}
        </ScrollView>
        {canWrite ? (
          <View
            style={{
              gap: 7,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: colors.line,
            }}
          >
            <Field
              label="Message"
              placeholder="Say something..."
              value={body}
              onChangeText={setBody}
              maxLength={2000}
            />
            <Action
              title="Send message"
              disabled={!body.trim()}
              run={async () => {
                if (!body.trim()) throw new Error("Write a message first.");
                await act("send_message", {
                  activity_id: activity.id,
                  body: body.trim(),
                });
                setBody("");
              }}
            />
          </View>
        ) : (
          <Txt muted>
            {activity.status === "cancelled"
              ? "This Beacon was cancelled. Earlier messages stay visible."
              : "Chat is paused. Earlier messages stay visible."}
          </Txt>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function SlidingTabBar({
  options,
  activeTab,
  onSelect,
  reducedMotion,
}: {
  options: DetailTab[];
  activeTab: DetailTab;
  onSelect: (tab: DetailTab) => void;
  reducedMotion: boolean;
}) {
  const { colors } = useTheme();
  const [position] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(0, options.indexOf(activeTab));
  useEffect(() => {
    if (reducedMotion) {
      position.setValue(activeIndex);
      return;
    }
    Animated.spring(position, {
      toValue: activeIndex,
      useNativeDriver: false,
      damping: 20,
      stiffness: 180,
    }).start();
  }, [activeIndex, position, reducedMotion]);
  const indexes = options.map((_, index) => index);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Activity sections"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        height: 52,
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        position: "relative",
      }}
    >
      {options.map((tab) => {
        const selected = activeTab === tab;
        const Icon = tabIcons[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Icon size={16} color={selected ? colors.green : colors.muted} />
            <Text
              style={{
                color: selected ? colors.ink : colors.muted,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
      {options.length > 1 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: width / options.length,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.green,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: indexes,
                  outputRange: indexes.map(
                    (index) => (width / options.length) * index,
                  ),
                }),
              },
            ],
          }}
        />
      ) : null}
    </View>
  );
}
