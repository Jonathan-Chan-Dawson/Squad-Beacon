import React from "react";
import { router, useIsFocused } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { Action, Loading, Screen, Txt } from "@/src/shared/ui";
import { Auth, Onboard } from "./Auth";
import { clearEntryIntent } from "./entryIntent";

/** Mount the navigator first; gate its screens before personal code can mount. */
export function AccountGate({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const account = useBeacon();
  const focused = useIsFocused();
  const readiness = accountReadiness(account);
  const publicRoute =
    name.startsWith("auth/") ||
    name === "legal" ||
    name.startsWith("g/") ||
    name === "invite";
  const signedOutBrowsing =
    readiness.state === "signed-out" &&
    ["index", "activities", "two", "browse-beacons", "discover/[id]"].includes(
      name,
    );
  if (publicRoute || readiness.state === "ready" || signedOutBrowsing)
    return <>{children}</>;
  if (!focused) return null;
  if (readiness.state === "loading") return <Loading />;
  if (readiness.state === "signed-out") {
    return (
      <Auth
        onExplore={() => {
          clearEntryIntent();
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
      />
    );
  }
  if (readiness.state === "needs-profile")
    return <Onboard key={`${account.userId}:${account.viewerEpoch}`} />;
  return (
    <Screen title="Let’s reconnect." eyebrow="CONNECTION" create={false}>
      <Txt>
        {account.error ??
          "Your account is not ready yet. Retry to load your profile."}
      </Txt>
      <Action title="Retry" run={account.refresh} />
    </Screen>
  );
}
