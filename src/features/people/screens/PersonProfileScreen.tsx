import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  ProfileExperience,
  type ProfileTab,
} from "@/src/features/profile/components/ProfileExperience";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  MapPin,
  MessageCircle,
  Settings,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { ProfileLink } from "@/src/features/people/components/ProfilePrimitives";
import { useNow } from "@/src/shared/useNow";
import { useBeacon } from "@/src/shared/store";
import { Skeleton } from "@/src/shared/design-system";
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
  const { styles, colors, semanticColors } = useTheme();
  const { data, act, userId, loading, refresh } = useBeacon();
  const now = useNow();
  const [tab, setTab] = useState<ProfileTab>("Overview");
  const selection = selectPersonPreview(data, id, userId, now);
  const person = selection.profile;
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
    "safety" | "report" | "block" | "friend" | "remove" | null
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
  if (isSelf) return <Redirect href="/(tabs)/profile" />;

  if (!person && !connectable && !selection.canMessage)
    return (
      <Screen title="Profile unavailable" eyebrow="" create={false}>
        {loading ? (
          <View accessibilityLabel="Loading profile" style={{ gap: 18 }}>
            <Skeleton width={96} height={96} borderRadius={48} />
            <Skeleton height={54} />
            <Skeleton height={140} />
            <Skeleton height={246} />
          </View>
        ) : (
          <>
            <Empty
              title="This profile isn't available"
              body="Profile details follow their sharing choices and your current connection."
            />
            <Button
              title="Retry profile"
              secondary
              onPress={() => void refresh()}
            />
          </>
        )}
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
  return (
    <Screen
      title="Profile"
      eyebrow=""
      create={false}
      showDemoNotice={false}
      compactHeader
      scrollStateKey={`${userId}:${id}:${tab}`}
      headerAction={
        isSelf ? (
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Settings size={20} color={colors.green} />
          </IconButton>
        ) : (
          <IconButton
            label="Safety & Privacy"
            onPress={() => setPanel("safety")}
          >
            <ShieldCheck size={21} color={colors.muted} />
          </IconButton>
        )
      }
    >
      {person ? (
        <ProfileExperience
          key={person.id}
          profile={person}
          tab={tab}
          onTabChange={setTab}
          actions={
            <>
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
                    icon={
                      <MessageCircle
                        size={17}
                        color={semanticColors.onAccent}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/messages/[id]",
                        params: { id },
                      })
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
                      : act("friend_request", {
                          username: connectable.username,
                        })
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
            </>
          }
          accessory={
            selection.canMessage ? (
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
            ) : undefined
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={styles.title}>{name}</Text>
          <Txt muted>Profile details are private.</Txt>
          {
            <>
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
                    icon={
                      <MessageCircle
                        size={17}
                        color={semanticColors.onAccent}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/messages/[id]",
                        params: { id },
                      })
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
                      : act("friend_request", {
                          username: connectable.username,
                        })
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
            </>
          }
        </View>
      )}
      {starError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {starError}
        </Text>
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
    </Screen>
  );
}
