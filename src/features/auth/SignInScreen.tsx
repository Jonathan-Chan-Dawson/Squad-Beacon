import React, { useEffect } from "react";
import { router, useIsFocused, type Href } from "expo-router";
import { Auth, Onboard } from "./Auth";
import { consumeEntryIntent } from "./entryIntent";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { useBeacon } from "@/src/shared/store";
import { Action, Loading, Screen, Txt } from "@/src/shared/ui";

export default function SignInScreen() {
  const account = useBeacon();
  const focused = useIsFocused();
  const { state } = accountReadiness(account);
  useEffect(() => {
    if (state === "ready" && focused)
      router.replace(consumeEntryIntent() as Href);
  }, [state, focused]);
  if (!focused) return null;
  if (state === "loading" || state === "ready") return <Loading />;
  if (state === "needs-profile")
    return <Onboard key={`${account.userId}:${account.viewerEpoch}`} />;
  if (state === "unavailable")
    return (
      <Screen title="Let’s reconnect." eyebrow="CONNECTION" create={false}>
        <Txt>{account.error ?? "Retry to load your profile."}</Txt>
        <Action title="Retry" run={account.refresh} />
      </Screen>
    );
  return (
    <Auth
      onExplore={() => {
        const destination = consumeEntryIntent();
        router.replace(
          (destination.startsWith("/discover/") ? destination : "/") as Href,
        );
      }}
    />
  );
}
