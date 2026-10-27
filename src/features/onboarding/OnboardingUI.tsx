import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { Info, X } from "lucide-react-native";
import { EmptyState, useDesignTheme } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { Button } from "@/src/shared/ui";
import { BeaconIllustration, type IllustrationKey } from "./illustrations";
import { getCopy, type CopyKey } from "./copy";
import { useOnboarding } from "./runtime";
import type { OnboardingKey } from "./progress";

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
  const { mark, status, retry, consumeWelcome } = useOnboarding();
  const { colors, tokens } = useDesignTheme();
  const focused = useIsFocused();
  // Keep this visit's introduction stable while persisting that it was seen.
  const [intro, setIntro] = useState(welcome);
  const [previousWelcome, setPreviousWelcome] = useState(welcome);
  if (previousWelcome !== welcome) {
    setPreviousWelcome(welcome);
    if (welcome) setIntro(true);
    else if (!focused) setIntro(false);
  }
  useEffect(() => {
    if (intro && focused) {
      void mark("welcome.seen.v1");
      consumeWelcome();
    }
  }, [intro, focused, mark, consumeWelcome]);
  useFocusEffect(React.useCallback(() => () => setIntro(false), []));
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
          onPress={() => {
            setIntro(false);
            void mark("welcome.dismissed.v1");
          }}
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
        <SemanticEmpty
          name="welcome.newAccount"
          density="hero"
          illustration="welcome"
          action={{
            label: "Explore Beacons",
            onPress: () => router.push("/browse-beacons"),
          }}
          secondaryActions={[
            {
              label: "Find People",
              onPress: () => router.push("/find-friends"),
            },
            {
              label: "Create Beacon",
              onPress: () =>
                router.push({
                  pathname: "/create",
                  params: { kind: "beacon" },
                }),
            },
          ]}
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
export function ContextTip({ name }: { name: keyof typeof tipCopy }) {
  const { keys, status, mark } = useOnboarding();
  const { colors, tokens } = useDesignTheme();
  const key: OnboardingKey = `tip.${name}.v1`;
  if (status !== "ready" || keys.has(key)) return null;
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
  const { colors, tokens } = useDesignTheme();
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(dismissSuccess, 7000);
    return () => clearTimeout(timer);
  }, [success, dismissSuccess]);
  if (!success) return null;
  const key = success.replace(/\.v1$/, "") as CopyKey;
  const content = getCopy(key, tone, "success", quips);
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="first-success"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 100,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.card,
        padding: 12,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.textPrimary, ...tokens.type.titleSmall }}>
        {content.title}
      </Text>
      <Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>
        {content.quip ?? content.body}
      </Text>
      <Button compact secondary title="Got it" onPress={dismissSuccess} />
    </View>
  );
}
