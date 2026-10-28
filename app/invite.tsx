import React, { useSyncExternalStore } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Loading, Screen, Txt } from "@/src/shared/ui";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { Auth, Onboard } from "@/src/features/auth/Auth";
const subscribe = () => () => {};
export default function Invite() {
  const { username, entry } = useLocalSearchParams<{
    username: string;
    entry?: string;
  }>();
  const account = useBeacon();
  const { act } = account;
  const validUsername =
    typeof username === "string" && /^[a-z0-9_]{3,24}$/i.test(username);
  const readiness = accountReadiness(account);
  // Static exports cannot know incoming query parameters. Keep the first web
  // render identical to the exported page before showing the public preview.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return <Loading />;
  if (validUsername && entry === "1" && readiness.state !== "ready") {
    if (readiness.state === "loading") return <Loading />;
    if (readiness.state === "signed-out") return <Auth />;
    if (readiness.state === "needs-profile")
      return <Onboard key={`${account.userId}:${account.viewerEpoch}`} />;
    return (
      <Screen title="Let’s reconnect." eyebrow="INVITATION" create={false}>
        <Txt>
          {account.error ??
            "Your account could not be loaded. Retry to continue this invitation."}
        </Txt>
        <Action title="Retry" run={account.refresh} />
      </Screen>
    );
  }
  return (
    <Screen
      title="Someone saved you a spot."
      eyebrow="FRIEND INVITATION"
      create={false}
    >
      <Txt>
        {validUsername
          ? `Connect with @${username} on Squad Beacon. Friendship requires acceptance.`
          : "This invitation is incomplete. Ask your friend for a fresh link."}
      </Txt>
      {validUsername && readiness.state === "ready" ? (
        <Action
          title="Send friend request"
          run={() => act("friend_request", { username })}
        />
      ) : validUsername ? (
        <Button
          title="Sign in to continue"
          onPress={() =>
            router.replace({
              pathname: "/invite",
              params: { username, entry: "1" },
            })
          }
        />
      ) : null}
      <Button title="Open Squad Beacon" onPress={() => router.replace("/")} />
    </Screen>
  );
}
