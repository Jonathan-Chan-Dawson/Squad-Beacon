import { MapRelationshipActions } from "./MapRelationshipActions";
import type { MapContextFilter } from "./contextFilters";
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { X } from "lucide-react-native";
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
import { uiHaptics } from "@/src/shared/design-system";
import {
  canReadBeaconActivity,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import {
  canManageBeaconSettings,
  canWriteBeaconModule,
} from "@/src/features/beacons/permissions";
import { canReadBeaconMeetingDetails } from "./filtering";
import { activityWhen } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { BeaconResponse } from "@/src/features/beacons/BeaconResponse";
import { BeaconTools } from "@/src/features/beacons/BeaconTools";
import { BeaconMemories } from "@/src/features/beacons/BeaconMemories";
import { BeaconScoreboard } from "@/src/features/beacons/BeaconScoreboard";
import { BeaconSettings } from "@/src/features/beacons/BeaconSettings";
import { AttendanceControls } from "@/src/features/beacons/AttendanceControls";
import { ChatThread } from "@/src/features/messages/ChatThread";
import {
  enabledMapBeaconFeatures,
  beaconFeatureLabels,
  type MapBeaconFeature,
} from "./mapBeaconFeatures";
import { clusterPeople } from "./mapDiscovery";

export function MapPanel({
  beaconId,
  onShowContext,
  initialTab = "overview",
  onClose,
  onPerson,
}: {
  onShowContext?: (filter: MapContextFilter) => void;
  beaconId: string;
  initialTab?: MapBeaconFeature;
  onClose(): void;
  onPerson(id: string): void;
}) {
  const { data, userId, act } = useBeacon();
  const { styles, colors, semanticColors, tokens } = useTheme();
  const now = useNow();
  const [tab, setTab] = useState(initialTab);
  const [comment, setComment] = useState("");
  const activity = data.activities.find((item) => item.id === beaconId);
  const readable =
    !!activity &&
    !!userId &&
    data.viewer_id === userId &&
    canReadBeaconActivity(data, activity, userId);
  if (!readable) return null;
  const features = enabledMapBeaconFeatures(activity);
  const manage = canManageBeaconSettings(data, activity, userId);
  if (manage) features.push("settings");
  const activeTab = features.includes(tab) ? tab : "overview";
  const allowed = canUseBeaconModules(data, activity, userId);
  const place = canReadBeaconMeetingDetails(data, activity, userId)
    ? data.places.find((row) => row.activity_id === activity.id)
    : undefined;
  const owner = data.profiles.find(
    (row) => row.id === activity.owner_id && canViewProfile(data, row, userId),
  );
  const people = clusterPeople(data, [activity.id], [], userId);
  const decision = data.planning_threads.find(
    (row) =>
      row.materialized_activity_id === activity.id &&
      (row.kind === "vote" || row.kind === "draw") &&
      canReadPlanningThread(data, row, userId),
  );
  const comments = allowed
    ? data.comments.filter((row) => row.activity_id === activity.id)
    : [];
  return (
    <View
      testID="map-panel"
      style={[
        styles.card,
        { flex: 1, minHeight: 0, padding: 0, overflow: "hidden" },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space.sm,
          padding: tokens.layout.screenGutter,
        }}
      >
        <Text style={[styles.h2, { flex: 1 }]} numberOfLines={2}>
          {activity.title}
        </Text>
        <IconButton label="Close Beacon panel" onPress={onClose}>
          <X color={colors.ink} size={20} />
        </IconButton>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: tokens.layout.screenGutter,
          paddingBottom: tokens.space.xxl,
          gap: tokens.space.md,
        }}
      >
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Beacon features"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: tokens.space.sm,
          }}
        >
          {features.map((feature) => (
            <Pressable
              key={feature}
              accessibilityRole="tab"
              accessibilityLabel={beaconFeatureLabels[feature]}
              accessibilityState={{ selected: activeTab === feature }}
              aria-selected={activeTab === feature}
              onPress={() => setTab(feature)}
              style={{
                minHeight: tokens.layout.minTapTarget,
                paddingHorizontal: tokens.space.md,
                paddingVertical: tokens.space.sm,
                borderRadius: tokens.radius.button,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor:
                  activeTab === feature ? colors.green : colors.white,
              }}
            >
              <Text
                style={[
                  styles.muted,
                  {
                    color:
                      activeTab === feature
                        ? semanticColors.onAccent
                        : colors.ink,
                  },
                ]}
              >
                {beaconFeatureLabels[feature]}
              </Text>
            </Pressable>
          ))}
        </View>
        {activeTab === "overview" && (
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
                onPress={() => onPerson(owner.id)}
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
                onPress={() =>
                  router.push({
                    pathname: "/council/[id]",
                    params: { id: decision.id },
                  })
                }
              />
            )}
            <MapRelationshipActions
              beaconId={activity.id}
              onShow={onShowContext}
            />
            <BeaconResponse activity={activity} compact />
            {allowed && <AttendanceControls activity={activity} />}
          </View>
        )}
        {activeTab === "people" &&
          people.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${person.name}'s profile`}
              onPress={() => onPerson(person.id)}
              style={[styles.card, styles.row]}
            >
              <ProfileAvatar profile={person} />
              <Text style={[styles.body, { flex: 1 }]}>{person.name}</Text>
            </Pressable>
          ))}
        {activeTab !== "overview" && activeTab !== "people" && !allowed && (
          <Txt muted>
            Join this Beacon to use its participant features. Approval may be
            required.
          </Txt>
        )}
        {allowed && activeTab === "comments" && (
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
        {allowed && activeTab === "reactions" && (
          <View style={{ gap: tokens.space.sm }}>
            <Txt muted>
              {
                data.reactions.filter((row) => row.activity_id === activity.id)
                  .length
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
        {allowed &&
          (["checklist", "journal", "focus"] as const)
            .filter((section) => features.includes(section))
            .map((section) => (
              <View
                key={section}
                style={{ display: activeTab === section ? "flex" : "none" }}
              >
                <BeaconTools activity={activity} section={section} />
              </View>
            ))}
        {allowed && activeTab === "experiences" && (
          <BeaconMemories activity={activity} />
        )}
        {allowed && activeTab === "scoreboard" && (
          <BeaconScoreboard activity={activity} />
        )}
        {allowed && activeTab === "chat" && (
          <View style={{ height: 420 }}>
            <ChatThread key={activity.id} activityId={activity.id} />
          </View>
        )}
        {allowed && activeTab === "music" && (
          <Button
            title="Open music link"
            onPress={() => {
              try {
                const url = new URL(activity.music_url || "");
                if (
                  ["https:", "http:"].includes(url.protocol) &&
                  !url.username &&
                  !url.password
                )
                  void Linking.openURL(url.toString());
              } catch {
                /* Invalid links remain closed. */
              }
            }}
          />
        )}
        {activeTab === "settings" && manage && (
          <BeaconSettings
            activity={activity}
            onSave={(settings) =>
              act("set_beacon_controls", { id: activity.id, ...settings })
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
