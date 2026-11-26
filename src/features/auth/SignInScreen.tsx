import React, { useEffect } from "react";
import { router, useIsFocused, useLocalSearchParams, type Href } from "expo-router";
import { Auth, Onboard } from "./Auth";
import { consumeEntryIntent } from "./entryIntent";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { useBeacon } from "@/src/shared/store";
import { Action, Loading, Screen, Txt } from "@/src/shared/ui";
import { guestEntryReason } from "./guestEntry";

export default function SignInScreen() {
  const account = useBeacon();
  const focused = useIsFocused();
  const { mode, reason, resume } = useLocalSearchParams<{ mode?: string; reason?: string; resume?: string }>();
  const { state } = accountReadiness(account);
  useEffect(() => {
    if (state !== "ready" || !focused) return;
    const destination = consumeEntryIntent();
    if (resume === "yes" && router.canGoBack()) router.back();
    else router.replace(destination as Href);
  }, [state, focused, resume]);
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
      initialMode={mode === "create" ? "Create account" : "Sign in"}
      reason={guestEntryReason(reason)}
      onExplore={() => {
        const destination = consumeEntryIntent();
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(
          (destination.startsWith("/discover/") ? destination : "/") as Href,
        );
      }}
    />
  );
}
