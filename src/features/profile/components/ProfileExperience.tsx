import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import {
  LivingActivitySection,
  LivingActivityHighlights,
} from "@/src/features/beacons/components/feed/LivingActivitySection";
import React, { useEffect, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { router } from "expo-router";
import {
  ChevronRight,
  Library,
  MapPin,
  Settings,
  Users,
} from "lucide-react-native";
import type { Profile } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { activityWhen, friendAvailabilityState } from "@/src/shared/domain";
import { Button, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { Skeleton, useReducedMotion } from "@/src/shared/design-system";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { ProfileAvatar } from "../ProfileAvatar";
import { selectProfileBeacon, type ProfileContentRow } from "../profileContent";
import { useProfileContent } from "../useProfileContent";
import { ProfileAlbums, openProfileBeacon } from "./ProfileAlbums";
import { visibleSoloActivity } from "@/src/features/maps/soloActivity";
import {
  StatusBubble,
  StatusViewer,
} from "@/src/features/beacons/components/feed/StatusViewer";
import { SharedStatusControl } from "@/src/features/beacons/components/feed/SharedStatusControl";
import {
  canViewBeaconMeetingDetails,
  selectSharedProfileContexts,
} from "@/src/features/people/previews/personPreview";
import { communityTypeLabel } from "@/src/features/people/components/CommunityCard";
import { canViewProfile } from "../privacy";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { getAspirationProgress } from "../aspirations";

export type ProfileTab = "Overview" | "Beacons" | "About";
function ActivityRow({ row }: { row: ProfileContentRow }) {
  const { styles, semanticColors: colors } = useTheme();
  return (
    <View style={{ gap: 2, paddingVertical: 6 }}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${row.title}`}
        onPress={() => openProfileBeacon(row.id)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 64,
        }}
      >
        <ActivityBadge category={row.category} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={2} style={[styles.body, { fontWeight: "600" }]}>
            {row.title}
          </Text>
          <Txt muted>
            {new Date(row.startsAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            · {row.role === "host" ? "Hosted" : "Joined"}
            {row.status === "cancelled" ? " · Canceled" : ""}
          </Txt>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </MotionPressable>
      {row.hasMemories && (
        <View style={{ alignSelf: "flex-start", marginLeft: 56 }}>
          <Button
            title={`View memories · ${row.title}`}
            secondary
            compact
            onPress={() => openProfileBeacon(row.id, true)}
          />
        </View>
      )}
    </View>
  );
}
function BeaconHistory({ personId }: { personId: string }) {
  const { styles } = useTheme();
  const [query, setQuery] = useState("");
  const upcoming = useProfileContent({
    personId,
    filter: "upcoming",
    pageSize: 6,
  });
  const past = useProfileContent({
    personId,
    filter: "past",
    query,
    pageSize: 6,
  });
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={styles.h2}>Current & Upcoming</Text>
        {upcoming.loading && <Skeleton height={76} />}
        {upcoming.page?.rows.map((row) => (
          <ActivityRow row={row} key={row.id} />
        ))}
        {!upcoming.loading &&
          !upcoming.error &&
          !upcoming.page?.rows.length && (
            <SemanticEmpty name="empty.upcoming" density="inline" />
          )}
        {upcoming.error && (
          <>
            <Txt muted>{upcoming.error}</Txt>
            <Button
              title="Retry upcoming Beacons"
              secondary
              compact
              onPress={upcoming.retry}
            />
          </>
        )}
        {upcoming.page?.nextCursor && (
          <Button
            title="More upcoming Beacons"
            secondary
            disabled={upcoming.loadingMore}
            onPress={() => void upcoming.more()}
          />
        )}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={styles.h2}>Past Beacons</Text>
        <Field
          label="Search past Beacons"
          value={query}
          onChangeText={setQuery}
          maxLength={80}
        />
        {past.loading && <Skeleton height={144} />}
        {past.page?.rows.map((row) => (
          <ActivityRow row={row} key={row.id} />
        ))}
        {!past.loading && !past.error && !past.page?.rows.length && (
          <Txt muted>
            {query
              ? "No experiences match your search."
              : "Past experiences will appear here, with or without photos."}
          </Txt>
        )}
        {past.error && (
          <>
            <Txt muted>{past.error}</Txt>
            <Button
              title="Retry past Beacons"
              secondary
              compact
              onPress={past.retry}
            />
          </>
        )}
        {past.page?.nextCursor && (
          <Button
            title={past.loadingMore ? "Loading…" : "More past Beacons"}
            secondary
            disabled={past.loadingMore}
            onPress={() => void past.more()}
          />
        )}
      </View>
    </View>
  );
}
function ProfileTags({ values }: { values: string[] }) {
  const { styles, semanticColors: colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {values.map((value) => (
        <View
          key={value}
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={styles.body}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
export function ProfileExperience({
  profile,
  actions,
  accessory,
  tab,
  onTabChange,
}: {
  profile: Profile;
  actions: React.ReactNode;
  accessory?: React.ReactNode;
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const { data, userId } = useBeacon();
  const { width: profileWidth } = useWindowDimensions();
  const { styles, semanticColors: colors, tokens } = useTheme();
  const reduced = useReducedMotion();
  const fade = useSharedValue(1);
  useEffect(() => {
    fade.set(reduced ? 1 : 0.88);
    fade.set(withTiming(1, { duration: reduced ? 0 : 160 }));
  }, [tab, reduced, fade]);
  const tabStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const now = useNow();
  const own = userId === profile.id;
  const [directory, setDirectory] = useState<
    "friends" | "squads" | "communities" | null
  >(null);
  const [expandedBio, setExpandedBio] = useState(false);
  const summary = useProfileContent({
    personId: profile.id,
    filter: "all",
    pageSize: 1,
  });
  const [statusViewerOpen, setStatusViewerOpen] = useState(false);
  const status = visibleSoloActivity(data, profile.id, userId, now);
  const presence = data.presence?.find((p) => p.owner_id === profile.id);
  const availability = presence
    ? !presence.availability ||
      (presence.availability_until &&
        Date.parse(presence.availability_until) <= now)
      ? "unknown"
      : presence.availability === "busy"
        ? "unavailable"
        : presence.availability_until &&
            Date.parse(presence.availability_until) - now <= 1800000
          ? "ending-soon"
          : "available"
    : friendAvailabilityState(status, now);
  const available = availability === "available";
  const availabilityColor =
    tokens.availability[
      availability === "ending-soon" ? "endingSoon" : availability
    ].color;
  const featured = selectProfileBeacon(data, profile, userId, now);
  const meetingLabel =
    featured && userId && canViewBeaconMeetingDetails(data, featured.id, userId)
      ? data.places.find((place) => place.activity_id === featured.id)?.label
      : undefined;
  const live =
    !!featured &&
    Date.parse(featured.starts_at) <= now &&
    Date.parse(featured.ends_at) > now;
  const contexts = selectSharedProfileContexts(data, profile.id, userId);
  const viewer = data.profiles.find((p) => p.id === userId);
  const sharedInterests = own
    ? []
    : profile.interests.filter((interest) =>
        viewer?.interests.includes(interest),
      );
  const friendPeople = (summary.page?.friendIds ?? []).map(
    (id) => data.profiles.find((p) => p.id === id) ?? { id, name: "Friend" },
  );
  const squadGroups = (summary.page?.squadIds ?? []).flatMap((id) =>
    data.squads.filter((s) => s.id === id),
  );
  const attendeeProfiles =
    featured && userId
      ? data.profiles
          .filter(
            (p) =>
              canViewProfile(data, p, userId) &&
              (p.id === featured.owner_id ||
                isApprovedGoing(
                  featured,
                  data.rsvps.find(
                    (r) => r.activity_id === featured.id && r.user_id === p.id,
                  ),
                )),
          )
          .slice(0, 3)
      : [];
  const edit = (section?: string) =>
    router.push({
      pathname: "/profile/edit",
      params: section ? { section } : {},
    });
  function openContext(context: (typeof contexts)[number]) {
    if (context.entityType === "organization")
      router.push({
        pathname: "/organization/[id]",
        params: { id: context.id },
      });
    else if (context.entityType === "space")
      router.push({ pathname: "/space/[id]", params: { id: context.id } });
    else router.push({ pathname: "/squad/[id]", params: { id: context.id } });
  }
  const renderIdentity = (availabilityControl?: React.ReactNode) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: availabilityControl && profileWidth < 360 ? 10 : 14,
      }}
    >
      <View style={{ alignItems: "center", gap: 6, maxWidth: "46%" }}>
        {!(data.is_demo || data.capabilities?.living_activity) && (
          <StatusBubble
            personId={profile.id}
            onPress={() => setStatusViewerOpen(true)}
          />
        )}
        <MotionPressable
          testID="profile-avatar"
          accessibilityRole="button"
          accessibilityLabel={
            own ? "Edit profile photo" : `${profile.name}'s avatar`
          }
          onPress={own ? () => edit() : undefined}
          disabled={!own}
          style={{
            padding: 3,
            borderRadius: 50,
            borderWidth: 1.5,
            borderColor:
              availability !== "unknown" ? availabilityColor : colors.border,
          }}
        >
          <ProfileAvatar
            profile={profile}
            size={availabilityControl && profileWidth < 360 ? 64 : 88}
            status={availability}
          />
        </MotionPressable>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            {
              fontSize: availabilityControl && profileWidth < 360 ? 22 : 25,
              lineHeight: 30,
            },
          ]}
        >
          {profile.name}
        </Text>
        <Txt muted>@{profile.username}</Txt>
        {!!profile.home && (
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            <MapPin size={13} color={colors.textSecondary} />
            <Text style={[styles.muted, { flex: 1, fontSize: 12 }]}>
              {profile.home}
            </Text>
          </View>
        )}
        {own ? (
          !(data.is_demo || data.capabilities?.living_activity) ? (
            <SharedStatusControl profilePill />
          ) : null
        ) : (
          availability !== "unknown" && (
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                paddingVertical: 5,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: availabilityColor,
                }}
              />
              <Text
                style={[
                  styles.muted,
                  {
                    flex: 1,
                    color: availabilityColor,
                  },
                ]}
              >
                {available
                  ? "Available now"
                  : availability === "ending-soon"
                    ? "Wrapping up soon"
                    : "Not available right now"}
              </Text>
            </View>
          )
        )}
      </View>
      {accessory}
      {availabilityControl}
    </View>
  );
  return (
    <View style={{ gap: 14 }}>
      <View
        testID={own ? "profile-identity" : "person-profile-identity"}
        style={{ gap: 10, padding: 2, overflow: "hidden", borderRadius: 22 }}
      >
        <Svg
          pointerEvents="none"
          style={{ position: "absolute", inset: 0 }}
          width="100%"
          height="100%"
        >
          <Defs>
            <LinearGradient id="profile-light" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.065} />
              <Stop offset="0.8" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#profile-light)" />
        </Svg>
        {(data.is_demo || data.capabilities?.living_activity) && own ? (
          <SharedStatusControl
            livingLayout
            identityOnly
            renderIdentity={renderIdentity}
          />
        ) : (
          renderIdentity()
        )}
        {(data.is_demo || data.capabilities?.living_activity) && !own && (
          <StatusBubble
            attached
            personId={profile.id}
            onPress={() => setStatusViewerOpen(true)}
          />
        )}
        <StatusViewer
          personId={profile.id}
          visible={statusViewerOpen}
          onClose={() => setStatusViewerOpen(false)}
        />
        {!!profile.bio && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={expandedBio ? "Collapse bio" : "Expand bio"}
            onPress={() => setExpandedBio(!expandedBio)}
          >
            <Text
              numberOfLines={expandedBio ? undefined : 3}
              style={styles.body}
            >
              {profile.bio}
            </Text>
          </MotionPressable>
        )}
        {!profile.bio && own && (
          <Button
            title="Add a little about yourself"
            compact
            secondary
            onPress={() => edit()}
          />
        )}
        <View
          style={{ flexDirection: "row", paddingVertical: 4 }}
          accessibilityLabel="Profile counts"
        >
          {[
            {
              label: own ? "Beacons" : "Visible Beacons",
              count: summary.page?.beaconCount,
              press: () => onTabChange("Beacons"),
            },
            {
              label: own ? "Friends" : "Mutual friends",
              count: summary.page?.friendIds.length,
              press: () =>
                own
                  ? router.push({
                      pathname: "/(tabs)/squads",
                      params: { peopleLists: "yes" },
                    })
                  : setDirectory("friends"),
            },
            {
              label: own ? "Squads" : "Shared Squads",
              count: summary.page?.squadIds.length,
              press: () => setDirectory("squads"),
            },
          ].map((stat, i) => (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${own ? "your " : ""}${stat.label.toLowerCase()}`}
              key={stat.label}
              onPress={stat.press}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                gap: 3,
                borderLeftWidth: i ? 1 : 0,
                borderLeftColor: colors.border,
              }}
            >
              <Text style={[styles.h2, { fontVariant: ["tabular-nums"] }]}>
                {stat.count ?? "—"}
              </Text>
              <Text
                style={[styles.muted, { fontSize: 12, textAlign: "center" }]}
              >
                {stat.label}
              </Text>
            </MotionPressable>
          ))}
        </View>
        {summary.error && (
          <Button
            title="Retry profile counts"
            secondary
            compact
            onPress={summary.retry}
          />
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {actions}
        </View>
      </View>
      {(data.is_demo || data.capabilities?.living_activity) && (
        <LivingActivitySection personId={profile.id} showLower={false} />
      )}
      {(data.is_demo || data.capabilities?.living_activity) && (
        <LivingActivityHighlights personId={profile.id} />
      )}
      {featured && !(data.is_demo || data.capabilities?.living_activity) && (
        <MotionPressable
          testID="profile-current-beacon"
          accessibilityRole="button"
          accessibilityLabel={`Open Beacon ${featured.title}`}
          onPress={() => openProfileBeacon(featured.id)}
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: 20,
            padding: 13,
            gap: 10,
            borderWidth: 1,
            borderColor: live ? colors.accent + "55" : colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: live ? colors.accent : colors.textSecondary,
              }}
            />
            <Text style={[styles.body, { fontWeight: "600", flex: 1 }]}>
              {live ? "Current Beacon" : "Next Beacon"}
            </Text>
            {live && (
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                LIVE
              </Text>
            )}
            <ChevronRight size={17} color={colors.textSecondary} />
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <ActivityBadge category={featured.category} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                numberOfLines={2}
                style={[styles.body, { fontWeight: "600" }]}
              >
                {featured.title}
              </Text>
              <Text style={styles.muted}>
                {activityWhen(featured, new Date(now))}
              </Text>
              {!!meetingLabel && meetingLabel !== featured.title && (
                <Text style={styles.muted}>{meetingLabel}</Text>
              )}
              {!!attendeeProfiles.length && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
                >
                  <View style={{ flexDirection: "row", paddingLeft: 4 }}>
                    {attendeeProfiles.map((p) => (
                      <View key={p.id} style={{ marginLeft: -4 }}>
                        <ProfileAvatar profile={p} size={23} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.muted}>
                    {attendeeProfiles.length === 1 &&
                    attendeeProfiles[0].id === featured.owner_id
                      ? "Hosting"
                      : "Taking part"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </MotionPressable>
      )}
      <View
        testID="profile-tabs"
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 4,
          borderRadius: 16,
          backgroundColor: colors.surfaceRaised,
        }}
      >
        {(["Overview", "Beacons", "About"] as const).map((value) => (
          <MotionPressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => onTabChange(value)}
            style={{
              flex: 1,
              minHeight: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: tab === value ? colors.accent : "transparent",
            }}
          >
            <Text
              style={[
                styles.body,
                {
                  color: tab === value ? colors.onAccent : colors.textSecondary,
                  fontWeight: tab === value ? "700" : "400",
                },
              ]}
            >
              {value}
            </Text>
          </MotionPressable>
        ))}
      </View>
      <Animated.View style={[{ gap: 22 }, tabStyle]}>
        <View
          style={{ display: tab === "Overview" ? "flex" : "none", gap: 22 }}
        >
          <ProfileAlbums
            personId={profile.id}
            own={own}
            active={tab === "Overview"}
          />
          {!own &&
            (contexts.length > 0 ||
              sharedInterests.length > 0 ||
              friendPeople.length > 0) && (
              <View style={{ gap: 10 }}>
                <Text style={styles.h2}>In common</Text>
                {!!sharedInterests.length && (
                  <ProfileTags values={sharedInterests.slice(0, 5)} />
                )}
                {contexts.slice(0, 2).map((context) => (
                  <MotionPressable
                    accessibilityRole="button"
                    onPress={() => openContext(context)}
                    key={`${context.entityType}:${context.id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: colors.surfaceRaised,
                      borderRadius: 16,
                      padding: 12,
                      minHeight: 66,
                    }}
                  >
                    <Users size={24} color={colors.accent} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.body, { fontWeight: "600" }]}>
                        {context.name}
                      </Text>
                      <Txt muted>
                        Shared {communityTypeLabel(context.entityType)}
                      </Txt>
                    </View>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </MotionPressable>
                ))}
                {contexts.length > 2 && (
                  <Button
                    title="See all shared communities"
                    secondary
                    compact
                    onPress={() => setDirectory("communities")}
                  />
                )}
                {!!friendPeople.length && (
                  <Button
                    title={`${friendPeople.length} mutual ${friendPeople.length === 1 ? "friend" : "friends"}`}
                    secondary
                    compact
                    onPress={() => setDirectory("friends")}
                  />
                )}
              </View>
            )}
          {(own || profile.interests.length > 0) && (
            <View style={{ gap: 10 }}>
              <View style={styles.between}>
                <Text style={styles.h2}>Interests</Text>
                <Button
                  title={own ? "Edit interests" : "More about them"}
                  compact
                  secondary
                  onPress={() =>
                    own ? edit("interests") : onTabChange("About")
                  }
                />
              </View>
              <ProfileTags values={profile.interests.slice(0, 5)} />
              {own && !profile.interests.length && (
                <Txt muted>Add the things you love making time for.</Txt>
              )}
            </View>
          )}
          {own && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>My Space</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => router.push("/library")}
                  style={{
                    flex: 1,
                    minHeight: 70,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: 16,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Library size={20} color={colors.accent} />
                  <Text style={styles.body}>My Collection</Text>
                </MotionPressable>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => router.push("/settings")}
                  style={{
                    flex: 1,
                    minHeight: 70,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: 16,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Settings size={20} color={colors.textSecondary} />
                  <Text style={styles.body}>Privacy & settings</Text>
                </MotionPressable>
              </View>
            </View>
          )}
        </View>
        <View style={{ display: tab === "Beacons" ? "flex" : "none" }}>
          <BeaconHistory personId={profile.id} />
        </View>
        <View style={{ display: tab === "About" ? "flex" : "none", gap: 20 }}>
          {own && (
            <Button
              title="Edit about you"
              secondary
              compact
              onPress={() => edit()}
            />
          )}
          {!!profile.interests.length && (
            <View style={{ gap: 10 }}>
              <Text style={styles.h2}>Interests</Text>
              <ProfileTags values={profile.interests} />
            </View>
          )}
          {!!profile.identity_tags?.length && (
            <View style={{ gap: 10 }}>
              <Text style={styles.h2}>Identity</Text>
              <ProfileTags values={profile.identity_tags} />
            </View>
          )}
          {[
            profile.home && `Lives in ${profile.home}`,
            profile.birthday_note && `Birthday · ${profile.birthday_note}`,
            profile.personality,
            profile.quote && `“${profile.quote}”`,
          ].some(Boolean) && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>A little more</Text>
              {[
                profile.home && `Lives in ${profile.home}`,
                profile.birthday_note && `Birthday · ${profile.birthday_note}`,
                profile.personality,
                profile.quote && `“${profile.quote}”`,
              ]
                .filter(Boolean)
                .map((value, i) => (
                  <Txt key={i}>{value}</Txt>
                ))}
            </View>
          )}
          {(own ||
            profile.aspiration_goals?.length > 0 ||
            !!profile.aspirations) && (
            <View style={{ gap: 12 }}>
              <View style={styles.between}>
                <Text style={styles.h2}>Making time for</Text>
                {own && (
                  <Button
                    title="Edit aspirations"
                    secondary
                    compact
                    onPress={() => edit("aspirations")}
                  />
                )}
              </View>
              {profile.aspiration_goals?.map((goal) => {
                const progress = own
                  ? getAspirationProgress(
                      goal,
                      data.activities,
                      profile.id,
                      profile.timezone || "UTC",
                    )
                  : null;
                return (
                  <View key={goal.id} style={{ gap: 6 }}>
                    <Text style={[styles.body, { fontWeight: "600" }]}>
                      {goal.title}
                    </Text>
                    <Txt muted>
                      {progress
                        ? `${progress.count} of ${goal.target_per_week} this week${progress.streak ? ` · ${progress.streak}-week streak` : ""}`
                        : `${goal.category} · ${goal.target_per_week} ${goal.target_per_week === 1 ? "Beacon" : "Beacons"} per week`}
                    </Txt>
                    {progress && (
                      <View
                        style={{
                          height: 4,
                          backgroundColor: colors.surfaceRaised,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: 4,
                            width: `${Math.min(1, progress.count / Math.max(1, goal.target_per_week)) * 100}%`,
                            backgroundColor: colors.accent,
                          }}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
              {!!profile.aspirations && <Txt>{profile.aspirations}</Txt>}
              {own &&
                !profile.aspiration_goals?.length &&
                !profile.aspirations && (
                  <Txt muted>What would you love to do more of?</Txt>
                )}
            </View>
          )}
        </View>
      </Animated.View>
      <Sheet
        title={
          directory === "friends"
            ? "Mutual friends"
            : own
              ? "Your Squads"
              : directory === "communities"
                ? "Shared communities"
                : "Shared Squads"
        }
        visible={directory !== null}
        onClose={() => setDirectory(null)}
      >
        {directory === "friends" ? (
          friendPeople.map((p) => (
            <Button
              key={p.id}
              title={p.name}
              secondary
              onPress={() => {
                setDirectory(null);
                router.push({ pathname: "/person/[id]", params: { id: p.id } });
              }}
            />
          ))
        ) : (
          <>
            {squadGroups.map((s) => (
              <Button
                key={s.id}
                title={s.name}
                secondary
                onPress={() => {
                  setDirectory(null);
                  router.push({
                    pathname: "/squad/[id]",
                    params: { id: s.id },
                  });
                }}
              />
            ))}
            {!own &&
              directory === "communities" &&
              contexts
                .filter((c) => c.entityType !== "squad")
                .map((c) => (
                  <Button
                    key={`${c.entityType}:${c.id}`}
                    title={c.name}
                    secondary
                    onPress={() => {
                      setDirectory(null);
                      openContext(c);
                    }}
                  />
                ))}
          </>
        )}
        {directory === "friends" && !friendPeople.length && (
          <Txt muted>No mutual friends to show.</Txt>
        )}
        {directory === "squads" && !squadGroups.length && !contexts.length && (
          <Txt muted>No Squads to show yet.</Txt>
        )}
      </Sheet>
    </View>
  );
}
