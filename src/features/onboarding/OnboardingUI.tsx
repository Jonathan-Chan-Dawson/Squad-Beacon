import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Info, X } from "lucide-react-native";
import { EmptyState, Toast, useDesignTheme } from "@/src/shared/design-system";
import { actionNoticeMessage } from "@/src/shared/actionNotice";
import { useBeacon } from "@/src/shared/store";
import { Button } from "@/src/shared/ui";
import { BeaconIllustration, type IllustrationKey } from "./illustrations";
import { getCopy, type CopyKey } from "./copy";
import { useOnboarding } from "./runtime";
import type { OnboardingKey } from "./progress";

export function WelcomeCard({ onExplore, onTour, onDismiss }: {
  onExplore: () => void;
  onTour: () => void;
  onDismiss: () => void;
}) {
  return (
    <EmptyState
      density="section"
      alignment="start"
      title="Make a plan. Bring your people."
      body="Find something to do nearby, or get your crew together."
      icon={<BeaconIllustration name="welcome" size={52} />}
      action={{ label: "Explore Beacons", onPress: onExplore }}
      secondaryActions={[
        { label: "Show me around", onPress: onTour },
        { label: "Not now", onPress: onDismiss },
      ]}
    />
  );
}

export function SemanticEmpty({
  name,
  illustration,
  density = "section",
  action,
  secondaryActions,
  personality = false,
}: {
  name: CopyKey;
  illustration?: IllustrationKey;
  density?: "hero" | "section" | "inline";
  action?: { label: string; onPress: () => void };
  secondaryActions?: { label: string; onPress: () => void }[];
  personality?: boolean;
}) {
  const { tone, quips } = useOnboarding();
  const { userId } = useBeacon();
  const content = getCopy(name, tone, userId ?? "beacon", personality && quips);
  return (
    <EmptyState
      density={density}
      title={content.title}
      body={content.body + (content.quip ? `\n${content.quip}` : "")}
      icon={
        illustration ? (
          <BeaconIllustration
            name={illustration}
            size={density === "hero" ? 120 : 36}
          />
        ) : undefined
      }
      action={action}
      secondaryActions={secondaryActions}
    />
  );
}
export function HomeInvitation({
  welcome,
  friends,
}: {
  welcome: boolean;
  friends: boolean;
}) {
  const { mark, status, retry } = useOnboarding();
  const { colors, tokens } = useDesignTheme();
  const intro = welcome;
  return (
    <View
      testID={intro ? "onboarding-welcome" : "onboarding-returning"}
      style={{
        position: "relative",
        borderRadius: tokens.radius.card,
        backgroundColor: colors.surface,
        padding: intro ? 4 : 8,
      }}
    >
      {intro ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome"
          onPress={() => void mark("welcome.dismissed.v1")}
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      {intro ? (
        <WelcomeCard
          onExplore={() => router.push("/browse-beacons")}
          onTour={() => router.push({ pathname: "/help", params: { tour: "yes" } })}
          onDismiss={() => void mark("welcome.dismissed.v1")}
        />
      ) : (
        <ReturningInvitation friends={friends} />
      )}
      {status === "error" ? (
        <Text
          style={{
            color: colors.textSecondary,
            ...tokens.type.caption,
            padding: 8,
          }}
        >
          Tips are saved for this visit. Account progress is temporarily
          unavailable.
        </Text>
      ) : null}
      {status === "error" ? (
        <Button secondary compact title="Retry saving tips" onPress={retry} />
      ) : null}
    </View>
  );
}
function ReturningInvitation({ friends }: { friends: boolean }) {
  const { tone, quips } = useOnboarding();
  const { userId } = useBeacon();
  const content = getCopy("empty.upcoming", tone, userId ?? "beacon", quips);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 4,
        padding: 4,
      }}
    >
      <View style={{ paddingTop: 8 }}>
        <BeaconIllustration name="emptyUpcoming" size={36} />
      </View>
      <EmptyState
        density="inline"
        alignment="start"
        style={{ flex: 1 }}
        title={content.title}
        body={content.quip ?? content.body}
        secondaryActions={
          friends
            ? [
                {
                  label: "Plan with friends",
                  onPress: () => router.push("/friends"),
                },
                {
                  label: "Explore Beacons",
                  onPress: () => router.push("/browse-beacons"),
                },
              ]
            : [
                {
                  label: "Explore Beacons",
                  onPress: () => router.push("/browse-beacons"),
                },
              ]
        }
      />
    </View>
  );
}
export const tipCopy = {
  ping: "A Ping checks who's interested before you commit to a plan.",
  vote: "Compare options together. Only eligible votes count.",
  plan: "Link multiple Beacons into one outing.",
  visibility: "Visibility controls who can see it. Invitations are separate.",
  sonar:
    "Location sharing is optional, temporary and limited to your chosen people.",
  routine: "Repeat a Plan or Beacon on a schedule.",
} as const;
let showedSessionTip = false;

export function ContextTip({ name, proactive = false }: { name: keyof typeof tipCopy; proactive?: boolean }) {
  const { keys, status, mark, firstEntrySession } = useOnboarding();
  const { demo } = useBeacon();
  const { colors, tokens } = useDesignTheme();
  const [showTip, setShowTip] = useState(false);
  const key: OnboardingKey = `tip.${name}.v1`;
  const eligible = status === "ready" && !keys.has(key);
  useFocusEffect(useCallback(() => {
    if (!proactive || !eligible || (!demo && firstEntrySession)) return;
    if (!demo && showedSessionTip) return;
    if (!demo) showedSessionTip = true;
    setShowTip(true);
  }, [demo, eligible, firstEntrySession, proactive]));

  if (!proactive) {
    return <Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>{tipCopy[name]}</Text>;
  }
  if (!eligible || !showTip || (!demo && firstEntrySession)) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Info size={16} color={colors.textSecondary} />
      <Text
        style={{
          flex: 1,
          color: colors.textSecondary,
          ...tokens.type.secondary,
        }}
      >
        {tipCopy[name]}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${name} tip`}
        onPress={() => void mark(key)}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
export function FirstSuccessNotice() {
  const { success, dismissSuccess, tone, quips } = useOnboarding();
  const { actionNotice, dismissActionNotice } = useBeacon();
  const dismiss = useCallback(() => {
    dismissActionNotice();
    dismissSuccess();
  }, [dismissActionNotice, dismissSuccess]);
  const message = actionNotice
    ? actionNoticeMessage(actionNotice.kind, quips, actionNotice.id)
    : success
      ? getCopy(success.replace(/\.v1$/, "") as CopyKey, tone, "success", quips).title
      : null;
  if (!message) return null;
  return (
    <View
      pointerEvents="box-none"
      testID="first-success"
      style={{
        position: "absolute",
        alignSelf: "center",
        width: "92%",
        maxWidth: 420,
        bottom: 100,
        zIndex: 50,
      }}
    >
      <Toast key={actionNotice?.id ?? success} visible message={message} tone="success" onDismiss={dismiss} />
    </View>
  );
}
