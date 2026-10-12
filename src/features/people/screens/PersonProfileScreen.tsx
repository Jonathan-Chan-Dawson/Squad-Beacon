import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  MapPin,
  MessageCircle,
  Settings,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import {
  selectPersonPreview,
  selectSharedProfileContexts,
} from "@/src/features/people/previews/personPreview";
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import { communityTypeLabel } from "@/src/features/people/components/CommunityCard";
import { useNow } from "@/src/shared/useNow";
import { useBeacon } from "@/src/shared/store";
import { activityWhen } from "@/src/shared/domain";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import {
  Action,
  Button,
  Empty,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

export default function PersonProfileScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(routeId) ? routeId[0] : routeId;
  const { styles, colors } = useTheme();
  const { data, act, userId } = useBeacon();
  const now = useNow();
  const selection = selectPersonPreview(data, id, userId, now);
  const person = selection.profile;
  const connections = selectSharedProfileContexts(data, id, userId);
  const connectable =
    userId &&
    data.viewer_id === userId &&
    !data.blocks.some(
      (row) =>
        (row.blocker_id === userId && row.blocked_id === id) ||
        (row.blocker_id === id && row.blocked_id === userId),
    )
      ? data.profiles.find((row) => row.id === id)
      : undefined;
  const isSelf = id === userId;
  const [panel, setPanel] = useState<
    | "safety"
    | "report"
    | "block"
    | "friend"
    | "remove"
    | "beacons"
    | "connections"
    | null
  >(null);
  const [reason, setReason] = useState("");
  const [starBusy, setStarBusy] = useState(false);
  const [starError, setStarError] = useState("");
  const request = data.friendships.find(
    (row) =>
      row.status === "pending" &&
      ((row.sender_id === userId && row.recipient_id === id) ||
        (row.sender_id === id && row.recipient_id === userId)),
  );
  const history =
    person && userId
      ? data.activities
          .filter(
            (activity) =>
              activity.owner_id === id &&
              activity.status === "completed" &&
              canReadBeaconActivity(data, activity, userId),
          )
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      : [];

  if (!person && !connectable && !selection.canMessage)
    return (
      <Screen title="Profile unavailable" eyebrow="" create={false}>
        <Empty
          title="This profile isn't available"
          body="Profile details follow their sharing choices and your current connection."
        />
      </Screen>
    );

  async function toggleStar() {
    if (starBusy || !selection.canMessage) return;
    setStarBusy(true);
    setStarError("");
    try {
      await act("favorite", { id, kind: "friend", add: !selection.starred });
    } catch (error) {
      setStarError(
        error instanceof Error ? error.message : "Could not update favorite.",
      );
    } finally {
      setStarBusy(false);
    }
  }
  const name =
    person?.name ?? (selection.canMessage ? "Friend" : "Private profile");
  const beacon = selection.beacon;
  const openConnection = (context: (typeof connections)[number]) => {
    setPanel(null);
    if (context.entityType === "organization")
      router.push({
        pathname: "/organization/[id]",
        params: { id: context.id },
      });
    else if (context.entityType === "space")
      router.push({ pathname: "/space/[id]", params: { id: context.id } });
    else router.push({ pathname: "/squad/[id]", params: { id: context.id } });
  };
  const openBeacon = (beaconId: string) =>
    router.push({ pathname: "/activity/[id]", params: { id: beaconId } });
  return (
    <Screen
      title="Profile"
      eyebrow=""
      create={false}
      showDemoNotice={false}
      headerAction={
        isSelf ? (
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Settings size={20} color={colors.green} />
          </IconButton>
        ) : undefined
      }
    >
      <View style={{ gap: 14 }} testID="person-profile-identity">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ProfileAvatar
            profile={person}
            size={72}
            status={selection.availability}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text accessibilityRole="header" style={styles.title}>
              {name}
            </Text>
            {person ? (
              <Txt muted>@{person.username}</Txt>
            ) : (
              <Txt muted>Profile details are private.</Txt>
            )}
          </View>
          {selection.canMessage ? (
            <IconButton
              label={selection.starred ? "Unstar" : "Star"}
              selected={selection.starred}
              disabled={starBusy}
              onPress={() => void toggleStar()}
            >
              <Star
                size={19}
                color={colors.green}
                fill={selection.starred ? colors.green : "transparent"}
              />
            </IconButton>
          ) : null}
        </View>
        {person?.bio ? <Txt>{person.bio}</Txt> : null}
        {selection.availability !== "unknown" ? (
          <Text style={[styles.muted, { color: colors.green }]}>
            {selection.availability === "available"
              ? "Available now"
              : selection.availability === "ending-soon"
                ? "Wrapping up soon"
                : "Not available right now"}
          </Text>
        ) : null}
        <ProfileActions>
          {isSelf ? (
            <Button
              compact
              title="Edit profile"
              onPress={() => router.push("/profile/edit")}
            />
          ) : selection.canMessage ? (
            <>
              <Button
                compact
                title="Message"
                icon={<MessageCircle size={17} color={colors.ink} />}
                onPress={() =>
                  router.push({ pathname: "/messages/[id]", params: { id } })
                }
              />
              <Button
                compact
                secondary
                title="Friends"
                onPress={() => setPanel("friend")}
              />
            </>
          ) : connectable ? (
            <Action
              compact
              title={
                request
                  ? request.sender_id === userId
                    ? "Requested"
                    : "Accept friend"
                  : "Add friend"
              }
              disabled={request?.sender_id === userId}
              run={() =>
                request
                  ? act("accept_friend", { id: request.id })
                  : act("friend_request", { username: connectable.username })
              }
            />
          ) : null}
          {selection.canViewMap ? (
            <Button
              compact
              secondary
              title="Map"
              icon={<MapPin size={16} color={colors.green} />}
              onPress={() =>
                router.push({ pathname: "/(tabs)", params: { person: id } })
              }
            />
          ) : null}
        </ProfileActions>
        {starError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {starError}
          </Text>
        ) : null}
      </View>
      {beacon ? (
        <ProfileSection
          title={
            Date.parse(beacon.starts_at) <= now
              ? "Current Beacon"
              : "Next Beacon"
          }
        >
          <ProfileLink
            title={beacon.title}
            detail={activityWhen(beacon, new Date(now))}
            icon={<ActivityBadge category={beacon.category} size={38} />}
            onPress={() => openBeacon(beacon.id)}
          />
        </ProfileSection>
      ) : null}
      {connections.length ? (
        <ProfileSection
          title="In common"
          action={
            connections.length > 2 ? (
              <Button
                compact
                secondary
                title="See all connections"
                onPress={() => setPanel("connections")}
              />
            ) : undefined
          }
        >
          {connections.slice(0, 2).map((context) => (
            <ProfileLink
              key={`${context.entityType}:${context.id}`}
              title={context.name}
              detail={`Shared ${communityTypeLabel(context.entityType)}`}
              onPress={() => openConnection(context)}
            />
          ))}
        </ProfileSection>
      ) : null}
      {person && (person.interests.length || person.identity_tags?.length) ? (
        <ProfileSection title="Interests & identity">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[
              ...new Set([
                ...person.interests,
                ...(person.identity_tags ?? []),
              ]),
            ].map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </ProfileSection>
      ) : null}
      {person &&
      [
        person.home,
        person.birthday_note,
        person.aspirations,
        person.personality,
        person.quote,
      ].some(Boolean) ? (
        <ProfileSection title="About">
          {[
            person.home,
            person.birthday_note,
            person.aspirations,
            person.personality,
            person.quote,
          ]
            .filter(Boolean)
            .map((value, index) => (
              <Txt key={index}>{value}</Txt>
            ))}
        </ProfileSection>
      ) : null}
      {person?.aspiration_goals?.length ? (
        <ProfileSection title="Making time for">
          {person.aspiration_goals.map((goal) => (
            <View key={goal.id} style={{ gap: 3 }}>
              <Txt>{goal.title}</Txt>
              <Txt muted>
                {goal.category} · {goal.target_per_week} Beacons per week
              </Txt>
            </View>
          ))}
        </ProfileSection>
      ) : null}
      {history.length ? (
        <ProfileSection
          title="Past Beacons"
          action={
            history.length > 2 ? (
              <Button
                compact
                secondary
                title="See all Beacons"
                onPress={() => setPanel("beacons")}
              />
            ) : undefined
          }
        >
          {history.slice(0, 2).map((activity) => (
            <ProfileLink
              key={activity.id}
              title={activity.title}
              detail={activityWhen(activity, new Date(now))}
              onPress={() => openBeacon(activity.id)}
            />
          ))}
        </ProfileSection>
      ) : null}
      {!isSelf ? (
        <ProfileLink
          title="Safety & Privacy"
          icon={<ShieldCheck size={18} color={colors.muted} />}
          onPress={() => setPanel("safety")}
        />
      ) : null}
      <Sheet
        title="Safety & Privacy"
        visible={panel === "safety"}
        onClose={() => setPanel(null)}
      >
        <Txt muted>
          Choose how you connect and what you share with this person.
        </Txt>
        <ProfileLink
          title="Your privacy settings"
          onPress={() => {
            setPanel(null);
            router.push("/settings/privacy");
          }}
        />
        <ProfileLink
          title="Report account"
          onPress={() => setPanel("report")}
        />
        <ProfileLink title="Block account" onPress={() => setPanel("block")} />
      </Sheet>
      <Sheet
        title="Friendship"
        visible={panel === "friend" && selection.canMessage}
        onClose={() => setPanel(null)}
      >
        <Txt>You and {name} are friends.</Txt>
        <ProfileLink
          title="Remove friendship"
          onPress={() => setPanel("remove")}
        />
      </Sheet>
      <Sheet
        title="Remove friendship?"
        visible={panel === "remove" && selection.canMessage}
        onClose={() => setPanel("friend")}
      >
        <Txt>
          This ends direct messaging and sharing through your friendship.
        </Txt>
        <Action
          title="Confirm remove friendship"
          run={async () => {
            await act("remove_friend", { user_id: id });
            setPanel(null);
          }}
        />
      </Sheet>
      <Sheet
        title="Report account"
        visible={panel === "report"}
        onClose={() => setPanel("safety")}
      >
        <Field
          label="What happened?"
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <Action
          title="Send report"
          run={async () => {
            if (reason.trim().length < 5)
              throw new Error("Please include a little more detail.");
            await act("report", { id, reason });
            setPanel(null);
          }}
        />
      </Sheet>
      <Sheet
        title={`Block ${name}?`}
        visible={panel === "block"}
        onClose={() => setPanel("safety")}
      >
        <Txt>
          This ends your friendship and direct sharing. Their comments and
          location will be hidden, including in shared Squads.
        </Txt>
        <Action
          title="Confirm block"
          run={async () => {
            await act("block", { id });
            setPanel(null);
            router.replace("/(tabs)/squads");
          }}
        />
      </Sheet>
      <Sheet
        title="Shared connections"
        visible={panel === "connections" && !!person}
        onClose={() => setPanel(null)}
      >
        {connections.map((context) => (
          <ProfileLink
            key={`${context.entityType}:${context.id}`}
            title={context.name}
            detail={communityTypeLabel(context.entityType)}
            onPress={() => openConnection(context)}
          />
        ))}
      </Sheet>
      <Sheet
        title="Past Beacons"
        visible={panel === "beacons" && !!person}
        onClose={() => setPanel(null)}
      >
        {history.map((activity) => (
          <ProfileLink
            key={activity.id}
            title={activity.title}
            detail={activityWhen(activity, new Date(now))}
            onPress={() => {
              setPanel(null);
              openBeacon(activity.id);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
