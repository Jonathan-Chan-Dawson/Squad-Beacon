import { DemoSquadBoostSelector } from "@/src/features/people/screens/SquadBoostScreen";
import { SegmentedControl } from "@/src/shared/design-system";
import { FlaskConical } from "lucide-react-native";
import React from "react";
import { View } from "react-native";
import { router, type Href } from "expo-router";
import { Action, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  personalTemplateUsage,
  premiumCatalog,
  resolvePersonalEntitlements,
} from "@/src/shared/entitlements";

export function DemoTierSelector() {
  const { data, demo, setDemoTier } = useBeacon();
  const { styles, colors } = useTheme();
  if (!demo) return null;
  const labels = { free: "Free", plus: "Plus", pro: "Pro" } as const;
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <FlaskConical size={17} color={colors.primary} />
        <Txt>Simulated entitlement</Txt>
      </View>
      <SegmentedControl
        shape="panel"
        options={["Free", "Plus", "Pro"].map((label) => ({
          label,
          value: label,
          accessibilityLabel: `Demo tier: ${label}`,
        }))}
        value={labels[data.demo_premium_tier ?? "free"]}
        accessibilityLabel="Demo tier"
        onChange={(value) =>
          setDemoTier(
            value === "Pro" ? "pro" : value === "Plus" ? "plus" : "free",
          )
        }
      />
      <DemoSquadBoostSelector />
      <Txt muted>
        Demo only. No subscription, billing, or real-account permissions change.
      </Txt>
    </View>
  );
}

export function PremiumPreview({
  kind,
  onOpen,
  label,
}: {
  kind?: "Beacon" | "Plan";
  onOpen?: () => void | Promise<void>;
  label?: string;
}) {
  const { data, userId } = useBeacon();
  const e = resolvePersonalEntitlements(data, userId),
    usage = personalTemplateUsage(data, userId);
  const limit = kind === "Beacon" ? e.beaconTemplates : e.planTemplates;
  const used =
    kind === "Beacon" ? usage.beacon_templates : usage.plan_templates;
  return (
    <View style={{ gap: 4 }}>
      {kind && (
        <Txt muted>
          {used}/{limit ?? "Unlimited"} personal {kind} templates ·{" "}
          {premiumCatalog[e.tier].name}
        </Txt>
      )}
      <Action
        compact
        secondary
        title={
          label ??
          (kind ? "Template limits · Premium" : "BEACON+ · Explore Premium")
        }
        run={async () => {
          if (onOpen) await onOpen();
          else router.push("/settings/premium" as Href);
        }}
      />
      {kind && limit !== null && used >= limit && (
        <Txt muted>
          Existing templates stay available. Edit or remove one, or explore
          higher limits.
        </Txt>
      )}
      {!data.is_demo && !data.capabilities?.premium && (
        <Txt muted>Premium enforcement awaits a backend update.</Txt>
      )}
    </View>
  );
}
