import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import {
  ProfileExperience,
  type ProfileTab,
} from "@/src/features/profile/components/ProfileExperience";
import { Skeleton } from "@/src/shared/design-system";
import { ConfirmDialog, QuickChoiceDialog } from "@/src/shared/Dialogs";
import { useBeacon } from "@/src/shared/store";
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
import { useNow } from "@/src/shared/useNow";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  MapPin,
  MessageCircle,
  Settings,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

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
  const returnMenu = useRef<"friend" | "safety" | null>(null);
  const closeToMenu = (menu: "friend" | "safety") => {
    returnMenu.current = menu;
    setPanel(null);
  };
  const resumeMenu = () => {
    const menu = returnMenu.current;
    returnMenu.current = null;
    if (menu) setPanel(menu);
  };
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
      <QuickChoiceDialog
        title="Safety & Privacy"
        visible={panel === "safety"}
        onClose={() => setPanel(null)}
        description="Choose how you connect and what you share with this person."
        items={[
          {
            label: "Your privacy settings",
            onPress: () => router.push("/settings/privacy"),
          },
          { label: "Report account", onPress: () => setPanel("report") },
          {
            label: "Block account",
            destructive: true,
            onPress: () => setPanel("block"),
          },
        ]}
      />
      <QuickChoiceDialog
        title="Friendship"
        visible={panel === "friend" && selection.canMessage}
        onClose={() => setPanel(null)}
        description={"You and " + name + " are friends."}
        items={[
          {
            label: "Remove friendship",
            destructive: true,
            onPress: () => setPanel("remove"),
          },
        ]}
      />
      <ConfirmDialog
        title="Remove friendship?"
        visible={panel === "remove" && selection.canMessage}
        onClose={() => closeToMenu("friend")}
        onDismiss={resumeMenu}
        onConfirm={async () => {
          await act("remove_friend", { user_id: id });
          setPanel(null);
        }}
        confirmLabel={"Confirm remove friendship"}
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive
      >
        <Txt>
          This ends direct messaging and sharing through your friendship.
        </Txt>
      </ConfirmDialog>
      <Sheet
        title="Report account"
        visible={panel === "report"}
        onClose={() => closeToMenu("safety")}
        onDismiss={resumeMenu}
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
      <ConfirmDialog
        title={`Block ${name}?`}
        visible={panel === "block"}
        onClose={() => closeToMenu("safety")}
        onDismiss={resumeMenu}
        onConfirm={async () => {
          await act("block", { id });
          setPanel(null);
          router.replace("/(tabs)/squads");
        }}
        confirmLabel={"Confirm block"}
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive
      >
        <Txt>
          This ends your friendship and direct sharing. Their comments and
          location will be hidden, including in shared Squads.
        </Txt>
      </ConfirmDialog>
    </Screen>
  );
}
