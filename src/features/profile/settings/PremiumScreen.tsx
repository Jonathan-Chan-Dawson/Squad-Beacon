import { Crown, Radio, Zap, CreditCard } from "lucide-react-native";
import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import { PremiumBoostSummary } from "@/src/features/people/screens/SquadBoostScreen";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Screen, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  personalTemplateUsage,
  premiumCatalog,
  resolvePersonalEntitlements,
  type PremiumTier,
} from "@/src/shared/entitlements";
import { DemoTierSelector } from "./PremiumUI";

export default function PremiumScreen() {
  const [expandedTier, setExpandedTier] = useState<PremiumTier | null>(null);
  const { data, userId, demo } = useBeacon();
  const { styles, colors } = useTheme();
  const e = resolvePersonalEntitlements(data, userId),
    usage = personalTemplateUsage(data, userId);
  return (
    <Screen title="Premium" eyebrow="MORE ROOM FOR TOGETHER" create={false}>
      <View style={styles.card}>
        <Txt muted>{demo ? "SIMULATED MEMBERSHIP" : "YOUR MEMBERSHIP"}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Crown size={23} color={colors.primary} />
          <Text style={styles.h2}>{e.name}</Text>
        </View>
        <Txt muted>
          Personal Beacon templates: {usage.beacon_templates}/
          {e.beaconTemplates ?? "Unlimited"}
        </Txt>
        <Txt muted>
          Personal Plan templates: {usage.plan_templates}/
          {e.planTemplates ?? "Unlimited"}
        </Txt>
        <Txt muted>Included Squad Boost allowance: {e.squadBoosts}</Txt>
        {!demo && !data.capabilities?.premium && (
          <Txt muted>
            Premium enforcement is unavailable until the backend is updated.
            Existing Free tools remain available.
          </Txt>
        )}
      </View>
      <DemoTierSelector />
      <PremiumBoostSummary />
      <Text style={styles.h2}>Compare memberships</Text>
      {(["free", "plus", "pro"] as PremiumTier[]).map((tier) => {
        const plan = premiumCatalog[tier];
        const expanded = expandedTier === tier;
        const icon = tier === "pro" ? Crown : tier === "plus" ? Zap : Radio;
        return (
          <View
            key={tier}
            style={[
              styles.card,
              e.tier === tier && { borderColor: colors.primary },
            ]}
          >
            <PlanChoice
              title={plan.name}
              detail={
                e.tier === tier ? `${plan.price} · Current tier` : plan.price
              }
              icon={icon}
              expanded={expanded}
              onPress={() => setExpandedTier(expanded ? null : tier)}
            />
            {expanded && (
              <>
                <Text style={styles.label}>Beacon Tools</Text>
                <Txt muted>
                  {plan.beaconTemplates ?? "Unlimited"} saved personal Beacon
                  templates. Bring Items and unlimited checklist items included.
                  {tier !== "free" &&
                  (data.is_demo || data.capabilities?.premium_tools)
                    ? " Assignments, deadlines and reminders included."
                    : ""}
                  {tier !== "free" &&
                  (data.is_demo || data.capabilities?.advanced_beacon_tools)
                    ? " Custom focus sequences included."
                    : ""}
                </Txt>
                <Text style={styles.label}>Planning &amp; Calendar</Text>
                <Txt muted>
                  {plan.planTemplates ?? "Unlimited"} saved personal Plan
                  templates. Standard Plans, individual Beacon repeats, and
                  basic Calendar included.
                </Txt>
                <Txt muted>
                  {plan.multiBeaconRecurrence
                    ? "Recurring multi-Beacon Plans included."
                    : "Recurring multi-Beacon Plans require BEACON+."}
                </Txt>
                {tier === "pro" && (
                  <Txt muted>
                    {data.is_demo || data.capabilities?.advanced_beacon_tools
                      ? "Preparation overviews, grouped sessions and linked reflections."
                      : "Advanced tools require the backend update."}
                  </Txt>
                )}
                <Text style={styles.label}>Memories &amp; Customization</Text>
                <Txt muted>
                  {tier === "free"
                    ? "Standard galleries, covers, icons and appearance included."
                    : data.is_demo || data.capabilities?.advanced_beacon_tools
                      ? tier === "plus"
                        ? "Memory albums, highlights, rich shared Journals, saved setups and additional styles."
                        : "Plus tools, multi-Beacon Afterglow, team rotation and preparation/session layouts."
                      : "Advanced tools require the backend update."}
                </Txt>
                <Text style={styles.label}>Squad Boosts</Text>
                <Txt muted>
                  {plan.squadBoosts} included allowance ·{" "}
                  {data.is_demo || data.capabilities?.squad_boosts
                    ? "2 pooled Boosts unlock Plus; 4 unlock Pro shared benefits."
                    : "assignment requires the backend update"}
                </Txt>
              </>
            )}
          </View>
        );
      })}
      <View style={styles.card}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <CreditCard size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt>Billing management · Coming soon</Txt>
          </View>
        </View>
        <Txt muted>
          Purchases and billing management are not available yet. Prices are
          previews; no payment is collected here.
        </Txt>
      </View>
    </Screen>
  );
}
