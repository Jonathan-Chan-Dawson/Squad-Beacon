import React from "react";
import { useGlobalSearchParams, useIsFocused, usePathname } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { Action, Loading, Screen, Txt } from "@/src/shared/ui";
import { Onboard } from "./Auth";
import { LoginToUse } from "./LoginToUse";
import { SectionTutorial, type Tutorial } from "@/src/features/onboarding/SectionTutorial";

const tutorialByRoute: Partial<Record<string, Tutorial>> = {
  index: "map",
  activities: "welcome",
  squads: "squads",
  profile: "profile",
  create: "create",
};

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
  const path = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const readiness = accountReadiness(account);
  const publicRoute =
    name.startsWith("auth/") ||
    name === "legal" ||
    name === "help" ||
    name.startsWith("g/") ||
    name === "invite";
  const signedOutBrowsing =
    readiness.state === "signed-out" &&
    ["index", "activities", "two", "squads", "profile", "create", "beacon-templates", "browse-beacons", "discover/[id]"].includes(
      name,
    );
  if (publicRoute || readiness.state === "ready" || signedOutBrowsing) {
    const tutorial = tutorialByRoute[name];
    return (
      <>
        {children}
        {tutorial && !account.demo && (tutorial !== "welcome" || signedOutBrowsing) && <SectionTutorial item={tutorial} />}
      </>
    );
  }
  if (!focused) return null;
  if (readiness.state === "loading") return <Loading />;
  if (readiness.state === "signed-out") {
    return (
      <Screen title={privateTitle(name)} eyebrow="" compactHeader create={false}>
        <LoginToUse
          destination={path}
          params={Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}
          detail="Log in to open this page."
          dismissible={false}
          resumeCurrentPage
        />
      </Screen>
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

function privateTitle(name: string) {
  const titles: Record<string, string> = {
    activity: "Beacon", person: "Profile", responses: "Responses & Invitations",
    messages: "Conversation", "squad-chat": "Squad chat", "your-activity": "Your Activity",
    "plan-editor": "Create Plan", planning: "Create", "guest-claim": "Claim your responses",
  };
  const route = name.split("/")[0];
  return titles[route] ?? route.replace(/(^|-)([a-z])/g, (_, separator: string, letter: string) =>
    `${separator ? " " : ""}${letter.toUpperCase()}`);
}
