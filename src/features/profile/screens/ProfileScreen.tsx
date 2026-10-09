import React, { useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { BookOpen, ChevronRight, ListChecks, QrCode, Settings, ShieldCheck } from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Skeleton, useReducedMotion } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { featuredActivity, friendIds, activityWhen } from "@/src/shared/domain";
import { canReadBeaconActivity, canReadBeaconModuleEntry } from "@/src/features/beacons/beaconModules";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { getAspirationProgress } from "@/src/features/profile/aspirations";
import { InviteQR } from "@/src/features/people/InviteQR";
import { ProfileVisibilityContent } from "./ProfilePrivacySettings";
import { ProfileSonarCard } from "../components/ProfileSonarCard";
import { ProfileAvailability } from "../components/ProfileAvailability";
import { ProfileMemories } from "../components/ProfileMemories";
import { Button, IconButton, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";
import type { Profile } from "@/src/shared/types";
import { INTEREST_CATALOG } from "@/src/shared/interestCatalog";

export default function ProfileScreen() {
  const { data, userId, loading, refresh } = useBeacon();
  const profile = data.viewer_id === userId ? data.profiles.find((item) => item.id === userId) : undefined;
  return profile ? <ProfileContent key={profile.id} profile={profile} /> :
    <Screen title="Profile" eyebrow="YOUR SPACE" create={false}>
      {loading ? <View style={{ gap: 16 }} accessibilityLabel="Loading profile">
        <Skeleton width={96} height={96} borderRadius={48} /><Skeleton height={28} width="60%" /><Skeleton height={80} /><Skeleton height={160} />
      </View> : <><Txt muted>Your profile is unavailable right now.</Txt><Button title="Retry profile" onPress={() => { void refresh(); }} /></>}
    </Screen>;
}

function ProfileContent({ profile }: { profile: Profile }) {
  const { styles, semanticColors: colors, tokens } = useTheme();
  const { data, userId } = useBeacon();
  const reducedMotion = useReducedMotion();
  const entrance = (index: number) => reducedMotion ? undefined : FadeInDown.duration(tokens.motion.entranceDuration).delay(Math.min(index, tokens.motion.listStaggerCount) * tokens.motion.listStagger);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const friends = userId ? friendIds(data, userId).filter((id) => !data.blocks.some((block) =>
    (block.blocker_id === userId && block.blocked_id === id) || (block.blocked_id === userId && block.blocker_id === id))) : [];
  const squads = data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, userId));
  const ownActivities = data.activities.filter((activity) => activity.owner_id === userId && !!userId && canReadBeaconActivity(data, activity, userId));
  const featured = featuredActivity(profile, data.activities);
  const readableFeatured = featured && userId && canReadBeaconActivity(data, featured, userId) ? featured : undefined;
  const journals = data.beacon_notes.filter((note) => {
    const activity = data.activities.find((item) => item.id === note.activity_id);
    return note.author_id === userId && activity && userId && canReadBeaconModuleEntry(data, activity, note.author_id, userId);
  }).length;
  const checklists = data.library_saved_checklists.filter((item) => item.owner_id === userId).length;
  const requests = data.friendships.filter((friendship) => friendship.recipient_id === userId && friendship.status === "pending" &&
    !data.blocks.some((block) => (block.blocker_id === userId && block.blocked_id === friendship.sender_id) ||
      (block.blocked_id === userId && block.blocker_id === friendship.sender_id))).length;
  const invites = data.squad_invites.filter((invite) => invite.recipient_id === userId).length;
  const lists = data.lists.filter((list) => list.owner_id === userId).length;
  const edit = (section?: "interests" | "aspirations") => router.push(("/profile/edit" + (section ? "?section=" + section : "")) as Href);
  const link = "squadbeacon://invite?username=" + encodeURIComponent(profile.username);
  const goals = profile.aspiration_goals ?? [];
  const about = [profile.home && "Lives in " + profile.home, profile.birthday_note && "Birthday · " + profile.birthday_note,
    profile.aspirations, profile.personality, profile.quote && "“" + profile.quote + "”"].filter(Boolean);
  const interestCategories = ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"] as const;
  const widgetsAvailable = Platform.OS === "ios" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

  return <Screen title="Profile" eyebrow="YOUR SPACE" create={false} headerAction={
    <IconButton label="Settings" onPress={() => router.push("/settings")}><Settings size={22} color={colors.textPrimary} /></IconButton>
  }>
    <Animated.View entering={entrance(0)} style={[styles.card, { overflow: "hidden", gap: 16 }]} testID="profile-identity">
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" pointerEvents="none">
        <Defs><LinearGradient id="profile-identity-gradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.10} /><Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#profile-identity-gradient)" />
      </Svg>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Pressable testID="profile-avatar" accessibilityRole="button" accessibilityLabel="Edit profile photo"
          onPress={() => edit()} style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <ProfileAvatar profile={profile} size={96} />
        </Pressable>
        <Text style={[tokens.type.title, { color: colors.textPrimary }]}>{profile.name}</Text>
        <Txt muted>@{profile.username}</Txt>
        <Text numberOfLines={2} style={[styles.body, { textAlign: "center" }]}>{profile.bio || "Tell your people a little about yourself."}</Text>
      </View>
      <View style={[styles.row, { justifyContent: "space-around" }]} accessibilityLabel="Your profile counts">
        {[["Beacons", ownActivities.length], ["Friends", friends.length], ["Squads", squads.length]].map(([label, count]) =>
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={"Open your " + String(label).toLowerCase()}
            onPress={() => label === "Beacons" ? router.push("/(tabs)/activities") : label === "Friends"
              ? router.push({ pathname: "/(tabs)/squads", params: { peopleLists: "yes" } } as Href) : router.push("/(tabs)/squads")}
            style={{ alignItems: "center", justifyContent: "center", minWidth: 64, minHeight: 44, gap: 4 }}>
            <Text style={[styles.h2, { fontVariant: ["tabular-nums"] }]}>{count}</Text><Txt muted>{label}</Txt></Pressable>)}
      </View>
      <Button title="Edit profile" onPress={() => edit()} />
      <View style={[styles.row, { gap: 8 }]}>
        <View style={{ flex: 1 }}><Button title="Share profile" secondary onPress={() => setShareOpen(true)} /></View>
        <IconButton label="Show profile invitation QR code" onPress={() => setShareOpen(true)}><QrCode size={22} color={colors.textPrimary} /></IconButton>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile visibility" onPress={() => setVisibilityOpen(true)}
        style={[styles.row, { minHeight: 44, gap: 8 }]}>
        <ShieldCheck size={20} color={colors.textSecondary} />
        <Text style={[styles.body, { flex: 1 }]}>Profile visibility: {profile.profile_visibility === "custom" ? "Custom" : profile.profile_visibility === "friends" ? "Friends" : "Public"}</Text>
        <ChevronRight size={20} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>

    <Animated.View entering={entrance(1)}><ProfileAvailability /></Animated.View>
    {readableFeatured && <View style={[styles.card, { gap: 8 }]}>
      <View style={[styles.between, { flexWrap: "wrap", gap: 8 }]}><Text style={styles.h2}>{"What I'm up to"}</Text>
        <Button title="Edit featured Beacon" secondary compact onPress={() => edit()} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={"Open Beacon " + readableFeatured.title}
        onPress={() => router.push(("/activity/" + readableFeatured.id) as Href)} style={{ minHeight: 44, gap: 4 }}>
        <Text style={styles.body}>{readableFeatured.title}</Text><Txt muted>{activityWhen(readableFeatured)} · {readableFeatured.category}</Txt>
      </Pressable>
    </View>}

    <Animated.View entering={entrance(2)} style={[styles.card, { gap: 12 }]}>
      <View style={[styles.between, { flexWrap: "wrap", gap: 8 }]}><Text style={styles.h2}>Interests</Text><Button title="Edit interests" secondary compact onPress={() => edit("interests")} /></View>
      {!profile.interests.length && <Txt muted>Add the things you enjoy.</Txt>}
      <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
        {profile.interests.map((interest) => {
          const group = INTEREST_CATALOG.find((category) => category.subcategories.some((subcategory) => subcategory.interests.some((item) => interest === item || interest.endsWith(": " + item))));
          const mapped = group?.name === "Sports" || group?.name === "Outdoors" ? "Fitness" : group?.name === "Music" || group?.name === "Arts" ? "Creative" : group?.name === "Education" ? "Study" : group?.name;
          const category = interestCategories.find((item) => item === mapped) ?? "Other";
          const token = tokens.categories[category];
          return <View key={interest} style={{ borderRadius: 999, backgroundColor: token.tint, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={[styles.body, { color: colors.textPrimary }]}>{interest}</Text></View>;
        })}
      </View>
      {!!profile.identity_tags?.length && <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
        {profile.identity_tags.map((tag) => <Text key={tag} style={styles.body}>{tag}</Text>)}
      </View>}
    </Animated.View>

    <Animated.View entering={entrance(3)} style={[styles.card, { gap: 12 }]}>
      <View style={[styles.between, { flexWrap: "wrap", gap: 8 }]}><Text style={styles.h2}>Aspirations</Text><Button title="Edit aspirations" secondary compact onPress={() => edit("aspirations")} /></View>
      <Txt muted>Finished Beacons linked to an aspiration count toward its weekly target.</Txt>
      {!goals.length && <Txt muted>Add something you want to do more of.</Txt>}
      {goals.map((goal) => {
        const progress = getAspirationProgress(goal, data.activities, profile.id, profile.timezone || "UTC");
        const ratio = Math.min(1, progress.count / Math.max(1, goal.target_per_week));
        const circumference = 2 * Math.PI * 23;
        return <View key={goal.id} style={[styles.row, { gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceRaised }]}>
          <View accessibilityLabel={goal.title + ": " + progress.count + " of " + goal.target_per_week + " this week"} style={{ width: 56, height: 56 }}>
            <Svg width={56} height={56}><Circle cx={28} cy={28} r={23} fill="none" stroke={colors.border} strokeWidth={5} />
              <Circle cx={28} cy={28} r={23} fill="none" stroke={colors.accent} strokeWidth={5} strokeLinecap="round"
                strokeDasharray={[circumference * ratio, circumference]} rotation={-90} origin="28,28" /></Svg>
            <Text style={[styles.body, { position: "absolute", top: 17, width: 56, textAlign: "center" }]}>{progress.count}</Text>
          </View><View style={{ flex: 1, gap: 4 }}><Text style={styles.body}>{goal.title}</Text>
            <Txt muted>{progress.count} of {goal.target_per_week} this week{progress.streak > 0 ? " · " + progress.streak + "-week streak" : ""}</Txt></View>
        </View>;
      })}
    </Animated.View>

    {!!about.length && <View style={[styles.card, { gap: 8 }]}><Text style={styles.h2}>About me</Text>{about.map((value, index) => <Txt key={index}>{value}</Txt>)}</View>}
    <Animated.View entering={entrance(4)}><ProfileSonarCard /></Animated.View>
    <Animated.View entering={entrance(5)}><ProfileMemories /></Animated.View>

    <View style={[styles.card, { gap: 12 }]}>
      <Text style={styles.h2}>Your library</Text>
      <View style={[styles.row, { alignItems: "stretch", gap: 12 }]}>
        {[{ label: "Journals", count: journals, kind: "journal", Icon: BookOpen }, { label: "Lists", count: checklists, kind: "checklist", Icon: ListChecks }].map(({ label, count, kind, Icon }) =>
          <Pressable key={kind} accessibilityRole="button" accessibilityLabel={label + ", " + count}
            onPress={() => router.push({ pathname: "/library", params: { kind } } as Href)}
            style={{ flex: 1, minHeight: 112, padding: 16, borderRadius: 16, backgroundColor: colors.surfaceRaised, gap: 8 }}>
            <Icon size={24} color={colors.textPrimary} /><Text style={styles.body}>{label}</Text><Txt muted>{count} saved</Txt>
          </Pressable>)}
      </View>
    </View>
    <View style={[styles.card, { gap: 8 }]}>
      <Text style={styles.h2}>Friends & lists</Text>
      <Text style={styles.body}>{requests} friend requests · {invites} Squad invitations · {lists} private lists</Text>
      <Button title="Open Friends & Lists" secondary onPress={() => router.push({ pathname: "/(tabs)/squads", params: { peopleLists: "yes" } } as Href)} />
    </View>
    {widgetsAvailable && <View style={[styles.card, { gap: 8 }]}><Text style={styles.h2}>Widget Studio</Text>
      <Txt muted>Choose a Friends Now or circle summary for your Home Screen.</Txt>
      <Button title="Open Widget Studio" secondary onPress={() => router.push("/widgets")} /></View>}
    {data.is_moderator && <Button title="Moderation inbox" secondary onPress={() => router.push("/moderation")} />}

    <Sheet title="Share profile" visible={shareOpen} onClose={() => setShareOpen(false)}>
      <InviteQR username={profile.username} /><Txt muted>Invite someone to connect with @{profile.username}.</Txt>
      <Button title="Share invitation link" onPress={() => { void Share.share({ message: link, url: link }); }} />
    </Sheet>
    <Sheet title="Profile visibility" visible={visibilityOpen} onClose={() => setVisibilityOpen(false)}>
      <ProfileVisibilityContent onSaved={() => setVisibilityOpen(false)} />
    </Sheet>
  </Screen>;
}
