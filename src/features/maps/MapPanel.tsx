import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import {
  X,
  Maximize2,
  Minimize2,
  Info,
  Users,
  MessagesSquare,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import {
  BeaconMomentum,
  BeaconResponse,
} from "@/src/features/beacons/BeaconResponse";
import { ChatThread } from "@/src/features/messages/ChatThread";
import { canChat, crew } from "@/src/shared/browsing";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { Action, Button, Field, Txt, useTheme } from "@/src/shared/ui";
export function MapPanel({
  beaconId,
  personId,
  onBeacon,
  onClose,
  expanded,
  onExpand,
}: {
  beaconId: string | null;
  personId: string | null;
  onBeacon: (id: string) => void;
  onClose: () => void;
  expanded: boolean;
  onExpand: (value: boolean) => void;
}) {
  const { styles, colors } = useTheme();

  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [tab, setTab] = useState("Overview"),
    [comment, setComment] = useState("");
  const a = data.activities.find((a) => a.id === beaconId);
  const personCandidate = data.profiles.find((p) => p.id === personId);
  const person =
    personCandidate && userId && canViewProfile(data, personCandidate, userId)
      ? personCandidate
      : undefined;
  const place = data.places.find((p) => p.activity_id === beaconId);
  const eligible = a && canChat(data, a, userId!);
  const mine = a?.owner_id === userId;
  const canComment =
    !!a &&
    a.enable_comments !== false &&
    a.status !== "cancelled" &&
    !!userId &&
    canUseBeaconModules(data, a, userId);
  const chatEnabled =
    !!a &&
    isBeaconModuleEnabled(a, "chat") &&
    !!userId &&
    canUseBeaconModules(data, a, userId);
  const tabOptions = a
    ? (["Overview", "People", ...(chatEnabled ? ["Chat"] : [])] as const)
    : (["Overview"] as const);
  const activeTab =
    personId || !tabOptions.some((option) => option === tab)
      ? "Overview"
      : tab;
  const open = a?.status === "scheduled" && Date.parse(a.ends_at) > now;
  const decisionThread =
    a && userId && data.viewer_id === userId
      ? data.planning_threads.find(
          (thread) =>
            (thread.kind === "vote" || thread.kind === "draw") &&
            thread.materialized_activity_id === a.id &&
            canReadPlanningThread(data, thread, userId),
        )
      : undefined;
  return (
    <View
      testID="map-panel"
      style={{
        flex: 1,
        backgroundColor: colors.white + "ED",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 16,
        gap: 12,
        boxShadow: "0 -5px 24px #132d2920",
      }}
    >
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {person ? person.name : "ON THE MAP"}
          </Text>
          <Text style={styles.h2} numberOfLines={2}>
            {a?.title ?? person?.name ?? "Beacon unavailable"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse map panel" : "Expand map panel"
          }
          onPress={() => onExpand(!expanded)}
          style={{ padding: 10 }}
        >
          {expanded ? (
            <Minimize2 color={colors.ink} size={20} />
          ) : (
            <Maximize2 color={colors.ink} size={20} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map tooltip"
          onPress={onClose}
          style={{ padding: 10 }}
        >
          <X color={colors.ink} size={22} />
        </Pressable>
      </View>
      {a && (
        <View style={{ flexDirection: "row", gap: 4 }}>
          {tabOptions.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityLabel={t}
              accessibilityState={{ selected: activeTab === t }}
              onPress={() => {
                setTab(t);
                if (t === "Chat") onExpand(true);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                gap: 5,
                borderRadius: 14,
                alignItems: "center",
                minHeight: 48,
                backgroundColor: activeTab === t ? colors.ink : colors.bg + "99",
              }}
            >
              {React.createElement(
                (
                  {
                    Overview: Info,
                    People: Users,
                    Chat: MessagesSquare,
                  } as const
                )[t as "Overview" | "People" | "Chat"],
                { size: 18, color: activeTab === t ? colors.white : colors.green },
              )}
              <Text
                style={{
                  color: activeTab === t ? colors.white : colors.ink,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {a && activeTab === "Chat" && eligible ? (
        <ChatThread key={a.id} activityId={a.id} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        >
          {person && activeTab === "Overview" && (
            <View style={styles.row}>
              <ProfileAvatar profile={person} />
              <View style={{ flex: 1 }}>
                <Txt>{person.bio || "A little company goes a long way."}</Txt>
                <Button
                  title="View profile"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/person/[id]",
                      params: { id: person.id },
                    })
                  }
                />
              </View>
            </View>
          )}
          {!a && (
            <>
              <Txt muted>
                {person
                  ? "No active beacon right now. Start a conversation or make a plan together."
                  : "This beacon may have ended or its audience changed."}
              </Txt>
              {person &&
                person.id !== userId &&
                (friendIds(data, userId!).includes(person.id) ? (
                  <Button
                    title="Message"
                    onPress={() =>
                      router.push({
                        pathname: "/messages/[id]",
                        params: { id: person.id },
                      })
                    }
                  />
                ) : (
                  <Action
                    title="Add friend"
                    run={() =>
                      act("friend_request", { username: person.username })
                    }
                  />
                ))}
            </>
          )}
          {a && activeTab === "Overview" && (
            <>
              <Txt muted>
                {activityWhen(a)} | {a.category}
              </Txt>
              <Txt>
                {a.description || "A simple plan. A little time together."}
              </Txt>
              <Txt muted>
                {place?.label || "Meeting place to be decided together"}
              </Txt>
              <BeaconMomentum activity={a} />
              <BeaconResponse activity={a} />
              <Button
                title="Open beacon details & tools"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: a.id },
                  })
                }
              />
              {decisionThread && (
                <Button
                  title={`View ${decisionThread.kind === "vote" ? "Vote" : "Draw"} decision`}
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/council/[id]",
                      params: { id: decisionThread.id },
                    })
                  }
                />
              )}
              {mine && open && a.mode === "solo" && (
                <Action
                  title="Open this status to company"
                  run={() => act("open_status", { id: a.id })}
                />
              )}
              {mine && open && (
                <Action
                  title="End beacon & keep memories"
                  secondary
                  run={() =>
                    act("activity_status", { id: a.id, status: "completed" })
                  }
                />
              )}
              <Button
                title="Save as a template"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/create",
                    params: { repeat: a.id, saveTemplate: "yes" },
                  })
                }
              />
              {a.status !== "scheduled" && (
                <Button
                  title="Do this again"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/create",
                      params: { repeat: a.id },
                    })
                  }
                />
              )}
            </>
          )}
          {a &&
            activeTab === "People" &&
            crew(data, a)
              .filter(
                ({ person: p }) => userId && canViewProfile(data, p, userId),
              )
              .map(({ person: p, status }) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.row}>
                    <ProfileAvatar profile={p} />
                    <View style={{ flex: 1 }}>
                      <Txt>{p.name}</Txt>
                      <Txt muted>{status}</Txt>
                    </View>
                  </View>
                  {mine && status === "Pending approval" && (
                    <Action
                      title={`Approve ${p.name}`}
                      run={() =>
                        act("approve_rsvp", { id: a.id, user_id: p.id })
                      }
                    />
                  )}
                </View>
              ))}
          {a && activeTab === "Overview" && a.enable_comments !== false && (
            <>
              <Txt muted>
                {a.status === "completed"
                  ? "Memory comments are shared text. Media uploads aren’t available yet."
                  : "Quick questions and notes for anyone who can see this beacon. Chat is just for people going."}
              </Txt>
              {data.comments
                .filter((c) => c.activity_id === a.id)
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((c) => {
                  const author = data.profiles.find((p) => p.id === c.author_id);
                  const authorVisible =
                    !!userId &&
                    (c.author_id === userId ||
                      (!!author && canViewProfile(data, author, userId)));
                  return (
                    <View key={c.id} style={styles.card}>
                      <Text style={styles.label}>
                        {authorVisible ? author?.name ?? "You" : "Beacon participant"}
                      </Text>
                      <Txt>{c.body}</Txt>
                      <Txt muted>{new Date(c.created_at).toLocaleString()}</Txt>
                    </View>
                  );
                })}
              {canComment ? (
                <>
                  <Field
                    label={
                      a.status === "completed"
                        ? "Add a memory comment"
                        : "Add a comment"
                    }
                    value={comment}
                    onChangeText={setComment}
                    maxLength={2000}
                  />
                  <Action
                    title="Post comment"
                    run={async () => {
                      if (!comment.trim())
                        throw new Error("Write a note first.");
                      await act("comment", { id: a.id, body: comment.trim() });
                      setComment("");
                    }}
                  />
                </>
              ) : (
                <Txt muted>
                  Memory comments are paused by the host or unavailable for this
                  beacon.
                </Txt>
              )}
            </>
          )}
          {a && activeTab === "Chat" && !eligible && (
            <>
              <Text style={styles.h2}>A room for the crew</Text>
              <Txt muted>
                Join this beacon to read and send chat messages. If approval is
                needed, the host will let you in.
              </Txt>
              <BeaconResponse activity={a} />
            </>
          )}
          {person &&
            activeTab === "Overview" &&
            data.activities
              .filter(
                (b) =>
                  b.id !== beaconId &&
                  b.status === "scheduled" &&
                  Date.parse(b.ends_at) > now &&
                  (b.owner_id === person.id ||
                    data.rsvps.some(
                      (r) =>
                        r.activity_id === b.id &&
                        r.user_id === person.id &&
                        r.status === "going",
                    )),
              )
              .map((b) => (
                <Button
                  key={b.id}
                  title={b.title}
                  secondary
                  onPress={() => onBeacon(b.id)}
                />
              ))}
        </ScrollView>
      )}
    </View>
  );
}
