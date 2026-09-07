import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/store";
import { Action, Button, Screen, Txt } from "@/src/ui";
export default function Invite() {
  const { username } = useLocalSearchParams<{ username: string }>(),
    { userId, act, data } = useBeacon();
  return (
    <Screen
      title="Someone saved you a spot."
      eyebrow="FRIEND INVITATION"
      create={false}
    >
      <Txt>
        Connect with @{username ?? "your friend"} on Squad Beacon. Friendship
        requires acceptance.
      </Txt>
      {userId && data.profiles.some((p) => p.id === userId) ? (
        <Action
          title="Send friend request"
          run={() => act("friend_request", { username })}
        />
      ) : (
        <Txt muted>
          Sign in and finish your profile, then reopen this invitation.
        </Txt>
      )}
      <Button title="Open Squad Beacon" onPress={() => router.replace("/")} />
    </Screen>
  );
}
