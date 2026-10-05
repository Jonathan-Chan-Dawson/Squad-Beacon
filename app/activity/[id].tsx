import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Info,
  MessageCircle,
  MessagesSquare,
  Music2,
  UsersRound,
  Wrench,
} from "lucide-react-native";
import DateField from "@/components/DateField";
import { BeaconResponse } from "@/src/features/beacons/BeaconResponse";
import { BeaconSettings } from "@/src/features/beacons/BeaconSettings";
import { BeaconTools } from "@/src/features/beacons/BeaconTools";
import { BeaconMemories } from "@/src/features/beacons/BeaconMemories";
import { BeaconScoreboard } from "@/src/features/beacons/BeaconScoreboard";
import { AttendanceControls } from "@/src/features/beacons/AttendanceControls";
import { beaconSettingsDraftKey } from "@/src/features/beacons/controls";
import {
  canAdmitBeaconParticipants,
  canManageBeaconSettings,
  isBeaconModuleEnabled,
} from "@/src/features/beacons/permissions";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { ChatThread } from "@/src/features/messages/ChatThread";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { useBeacon } from "@/src/shared/store";
import type { Activity } from "@/src/shared/types";
import { friendIds, validateActivity } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import {
  Action,
  Button,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

type DetailTab = "Overview" | "People" | "Chat" | "More";
const tabIcons = {
  Overview: Info,
  People: UsersRound,
  Chat: MessagesSquare,
  More: Wrench,
} satisfies Record<DetailTab, typeof Info>;

function activityHasMore(activity: Activity, canManage: boolean) {
  return (
    canManage ||
    isBeaconModuleEnabled(activity, "checklist") ||
    isBeaconModuleEnabled(activity, "journal") ||
    isBeaconModuleEnabled(activity, "focus") ||
    isBeaconModuleEnabled(activity, "experiences") ||
    isBeaconModuleEnabled(activity, "scoreboard") ||
    (isBeaconModuleEnabled(activity, "music") && !!activity.music_url)
  );
}

export default function ActivityDetail() {
  const { colors, styles } = useTheme();
  const { id, tab: initialTab } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const { data, userId, act } = useBeacon();
  const activityId = Array.isArray(id) ? id[0] : id;
  const activity = data.activities.find((item) => item.id === activityId);
  const now = useNow();
  const [selectedTab, setSelectedTab] = useState<{
    activityId: string;
    tab: DetailTab;
  }>({
    activityId: activityId ?? "",
    tab: initialTab === "chat" ? "Chat" : "Overview",
  });
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");

  if (!activity || !activityId) {
    return (
      <Screen title="Activity unavailable" eyebrow="ACTIVITY" create={false}>
        <Empty
          title="This plan is no longer visible."
          body="It may have been removed, or its audience may have changed."
        />
        <Button
          title="Back to activities"
          onPress={() => router.replace("/(tabs)/activities")}
        />
      </Screen>
    );
  }

  const owner = data.profiles.find(
    (profile) => profile.id === activity.owner_id,
  );
  const ownerVisible =
    !!owner &&
    !!userId &&
    (owner.id === userId || canViewProfile(data, owner, userId));
  const hostName = ownerVisible ? owner.name : "Beacon host";
  const place = data.places.find((item) => item.activity_id === activity.id);
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
  const mine = activity.owner_id === userId;
  const canManage = !!userId && canManageBeaconSettings(data, activity, userId);
  const canAdmit =
    !!userId && canAdmitBeaconParticipants(data, activity, userId);
  const canAccess = !!userId && canUseBeaconModules(data, activity, userId);
  const open =
    activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
  const chatEnabled = isBeaconModuleEnabled(activity, "chat");
  const moreEnabled = activityHasMore(activity, canManage);
  const options: DetailTab[] = ["Overview", "People"];
  if (chatEnabled && canAccess) options.push("Chat");
  if (moreEnabled && canAccess) options.push("More");
  const requestedTab =
    selectedTab.activityId === activity.id ? selectedTab.tab : "Overview";
  const activeTab = options.includes(requestedTab) ? requestedTab : "Overview";
  const rsvps = data.rsvps.filter((rsvp) => rsvp.activity_id === activity.id);
  const visibleRsvps = rsvps.filter((rsvp) => {
    if (rsvp.user_id === userId) return true;
    const profile = data.profiles.find((item) => item.id === rsvp.user_id);
    return !!profile && !!userId && canViewProfile(data, profile, userId);
  });
  const goingCount = rsvps.filter((rsvp) => rsvp.status === "going").length;
  const interestedCount = rsvps.filter(
    (rsvp) => rsvp.status === "interested",
  ).length;
  const friends = userId ? friendIds(data, userId) : [];
  const commentsEnabled = activity.enable_comments !== false;
  const canComment =
    commentsEnabled && activity.status !== "cancelled" && !!userId && canAccess;
  const comments = data.comments
    .filter((item) => item.activity_id === activity.id)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
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
  const selectTab = (tab: DetailTab) =>
    setSelectedTab({ activityId: activity.id, tab });

  return (
    <Screen
      title={activity.title}
      eyebrow={activity.category + " · " + activity.mode}
      create={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
        accessibilityLabel="Beacon sections"
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
              onPress={() => selectTab(tab)}
              style={({ pressed }) => ({
                minHeight: 48,
                minWidth: 82,
                paddingHorizontal: 13,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.line,
                backgroundColor: selected ? colors.ink : colors.white,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Icon size={16} color={selected ? colors.white : colors.green} />
              <Text
                style={{
                  color: selected ? colors.white : colors.ink,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === "Overview" && (
        <>
          <View style={[styles.card, { gap: 11 }]}>
            <View style={styles.row}>
              <ProfileAvatar profile={ownerVisible ? owner : undefined} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.body}>{hostName}</Text>
                <Text style={styles.muted}>
                  {new Date(activity.starts_at).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              {ownerVisible && owner && owner.id !== userId ? (
                <Button
                  compact
                  secondary
                  title="Host profile"
                  onPress={() =>
                    router.push({
                      pathname: "/person/[id]",
                      params: { id: activity.owner_id },
                    })
                  }
                />
              ) : null}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.h2}>
                {new Date(activity.starts_at).toLocaleString()} –{" "}
                {new Date(activity.ends_at).toLocaleString()}
              </Text>
              <Txt muted>Event timezone: {activity.timezone}</Txt>
            </View>
            {activity.description ? <Txt>{activity.description}</Txt> : null}
            {place?.label ? (
              <Txt>{place.label}</Txt>
            ) : (
              <Txt muted>Meeting place to be decided together.</Txt>
            )}
            {place?.online_url ? (
              <Action
                title="Open online activity"
                secondary
                run={() => Linking.openURL(place.online_url!)}
              />
            ) : place?.latitude != null && place.longitude != null ? (
              <Button
                title="Open Beacon on map"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)",
                    params: { beacon: activity.id },
                  })
                }
              />
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
            {decision && (
              <Button
                compact
                secondary
                title={`View ${decision.kind === "vote" ? "Vote" : "Draw"} decision`}
                onPress={() =>
                  router.push({
                    pathname: "/council/[id]",
                    params: { id: decision.id },
                  })
                }
              />
            )}
            {aspirations.length > 0 ? (
              <Txt muted>
                For: {aspirations.map((goal) => goal.title).join(" · ")}
              </Txt>
            ) : null}
            <Txt muted>
              Audience: {activity.audience} ·{" "}
              {activity.approval_required
                ? "Host approval required"
                : "Joining follows activity mode"}
            </Txt>
            {activity.mode !== "solo" ? (
              <View style={{ gap: 3 }}>
                <Text style={styles.label}>
                  {activity.accepted_seat_count ?? goingCount + 1} going
                  {interestedCount > 0
                    ? " · " + interestedCount + " considering"
                    : ""}
                </Text>
                {activity.target_count ? (
                  <Text style={styles.muted}>
                    {goingCount + 1 >= activity.target_count
                      ? "The crew is ready."
                      : "Need " +
                        (activity.target_count - goingCount - 1) +
                        " more to make it happen."}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <BeaconResponse activity={activity} />
            <AttendanceControls activity={activity} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                compact
                secondary
                title={savedBeacon ? "Remove saved Beacon" : "Save Beacon"}
                onPress={() =>
                  void act("save_beacon", {
                    activity_id: activity.id,
                    saved: !savedBeacon,
                  })
                }
              />
              {activity.enable_reactions !== false ? (
                <Button
                  compact
                  secondary
                  title={
                    (hasReaction ? "Reacted" : "React") +
                    " 🙌" +
                    (reactionCount ? " · " + reactionCount : "")
                  }
                  disabled={hasReaction || activity.status === "cancelled"}
                  onPress={() => void act("react", { id: activity.id })}
                />
              ) : null}
              <Button
                compact
                secondary
                title="Save as a template"
                onPress={() =>
                  router.push({
                    pathname: "/create",
                    params: { repeat: activity.id, saveTemplate: "yes" },
                  })
                }
              />
              {activity.status !== "scheduled" ? (
                <Button
                  compact
                  secondary
                  title="Do this again"
                  onPress={() =>
                    router.push({
                      pathname: "/create",
                      params: { repeat: activity.id },
                    })
                  }
                />
              ) : null}
            </View>
          </View>

          {commentsEnabled ? (
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
                        borderTopWidth: 1,
                        borderTopColor: colors.line,
                        paddingTop: 8,
                        gap: 3,
                      }}
                    >
                      <Text style={styles.muted}>
                        {authorVisible
                          ? (author?.name ?? "You")
                          : "Beacon participant"}{" "}
                        ·{" "}
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Text style={styles.body}>{item.body}</Text>
                    </View>
                  );
                })
              ) : (
                <Txt muted>No comments yet.</Txt>
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
        </>
      )}

      {activeTab === "People" && (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>People</Text>
            <Txt muted>
              {activity.accepted_seat_count ?? goingCount + 1} going ·{" "}
              {rsvps.filter((rsvp) => rsvp.status === "requested").length}{" "}
              awaiting approval
            </Txt>
            <Txt muted>
              Names and profile details appear only when that person has shared
              them with you.
            </Txt>
          </View>
          {visibleRsvps.map((rsvp) => {
            const profile = data.profiles.find(
              (item) => item.id === rsvp.user_id,
            );
            const profileVisible =
              !!profile &&
              !!userId &&
              (rsvp.user_id === userId ||
                canViewProfile(data, profile, userId));
            const displayName = profileVisible
              ? (profile?.name ?? "You")
              : "Beacon participant";
            return (
              <View key={rsvp.user_id} style={[styles.card, { gap: 8 }]}>
                <View style={styles.row}>
                  <ProfileAvatar
                    profile={profileVisible ? profile : undefined}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.body}>{displayName}</Text>
                    <Text style={styles.muted}>
                      {rsvp.status === "requested" && !rsvp.approved
                        ? "Pending"
                        : rsvp.status === "going"
                          ? "I'm In"
                          : rsvp.status === "interested"
                            ? "Maybe"
                            : "Invited"}
                    </Text>
                  </View>
                  {profileVisible && profile && profile.id !== userId ? (
                    <Button
                      compact
                      secondary
                      title="Profile"
                      onPress={() =>
                        router.push({
                          pathname: "/person/[id]",
                          params: { id: profile.id },
                        })
                      }
                    />
                  ) : null}
                </View>
                {canAdmit && rsvp.status === "requested" ? (
                  <Action
                    secondary
                    title={
                      "Approve " +
                      (profileVisible ? displayName : "participant")
                    }
                    run={() =>
                      act("approve_rsvp", {
                        id: activity.id,
                        user_id: rsvp.user_id,
                      })
                    }
                  />
                ) : null}
                {canManage && rsvp.user_id !== userId ? (
                  <Action
                    secondary
                    title={
                      "Remove " + (profileVisible ? displayName : "participant")
                    }
                    run={() =>
                      act("remove_rsvp", {
                        id: activity.id,
                        user_id: rsvp.user_id,
                      })
                    }
                  />
                ) : null}
              </View>
            );
          })}
          {canAdmit && open && activity.mode !== "solo" ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Invite a friend</Text>
              {data.profiles
                .filter(
                  (profile) =>
                    friends.includes(profile.id) &&
                    !rsvps.some((rsvp) => rsvp.user_id === profile.id),
                )
                .map((profile) => {
                  const visible =
                    !!userId && canViewProfile(data, profile, userId);
                  return (
                    <Action
                      key={profile.id}
                      secondary
                      title={"Invite " + (visible ? profile.name : "friend")}
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
        </>
      )}

      {activeTab === "Chat" && chatEnabled && canAccess ? (
        <ChatThread
          key={activity.id + ":" + (userId ?? "viewer")}
          activityId={activity.id}
        />
      ) : null}

      {activeTab === "More" && moreEnabled && canAccess ? (
        <>
          {isBeaconModuleEnabled(activity, "checklist") ||
          isBeaconModuleEnabled(activity, "journal") ||
          isBeaconModuleEnabled(activity, "focus") ? (
            <BeaconTools
              key={activity.id + ":" + (userId ?? "viewer")}
              activity={activity}
            />
          ) : null}
          {isBeaconModuleEnabled(activity, "experiences") ? (
            <View style={styles.card}>
              <BeaconMemories
                key={activity.id + ":" + (userId ?? "viewer")}
                activity={activity}
              />
            </View>
          ) : null}
          {isBeaconModuleEnabled(activity, "scoreboard") ? (
            <View style={styles.card}>
              <BeaconScoreboard
                key={activity.id + ":" + (userId ?? "viewer")}
                activity={activity}
              />
            </View>
          ) : null}
          {isBeaconModuleEnabled(activity, "music") && activity.music_url ? (
            <View style={[styles.card, { gap: 8 }]}>
              <View style={styles.row}>
                <Music2 size={19} color={colors.green} />
                <Text style={styles.h2}>Music link</Text>
              </View>
              <Txt muted>
                Opens in your music app. Audio is not played here.
              </Txt>
              <Button
                title="Open music link"
                onPress={() => void Linking.openURL(activity.music_url!)}
              />
            </View>
          ) : null}
          {canManage ? (
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
        </>
      ) : null}

      {!mine ? (
        <Button
          secondary
          title="Report this Beacon"
          onPress={() => setReport(true)}
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
        <Action
          title="Send report"
          run={async () => {
            if (reason.trim().length < 5)
              throw new Error("Please include a little more detail.");
            await act("report", { id: activity.id, reason });
            setReport(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
