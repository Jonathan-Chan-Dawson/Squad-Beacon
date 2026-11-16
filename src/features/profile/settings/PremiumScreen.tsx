import React from "react";
import { Text, View } from "react-native";
import {
  CalendarDays,
  Check,
  CreditCard,
  Images,
  Minus,
  Radio,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { PremiumBoostSummary } from "@/src/features/people/screens/SquadBoostScreen";
import { Screen, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  personalTemplateUsage,
  premiumCatalog,
  resolvePersonalEntitlements,
  type PremiumTier,
} from "@/src/shared/entitlements";
import { DemoTierSelector } from "./PremiumUI";

type Benefit = {
  name: string;
  values: [boolean | string, boolean | string, boolean | string];
  supported?: boolean;
};
type BenefitGroup = { title: string; icon: LucideIcon; rows: Benefit[] };
const tiers: PremiumTier[] = ["free", "plus", "pro"];

export default function PremiumScreen() {
  const { data, userId, demo } = useBeacon();
  const { styles, colors } = useTheme();
  const entitlement = resolvePersonalEntitlements(data, userId);
  const usage = personalTemplateUsage(data, userId);
  const toolsAvailable = !!(data.is_demo || data.capabilities?.premium_tools);
  const advancedAvailable = !!(
    data.is_demo || data.capabilities?.advanced_beacon_tools
  );
  const sections: BenefitGroup[] = [
    {
      title: "Beacon Tools",
      icon: Radio,
      rows: [
        {
          name: "Personal Beacon templates",
          values: tiers.map((t) =>
            String(premiumCatalog[t].beaconTemplates ?? "∞"),
          ) as Benefit["values"],
        },
        { name: "Checklist items", values: ["∞", "∞", "∞"] },
        { name: "Bring Items", values: [true, true, true] },
        {
          name: "Assignments, due dates & reminders",
          values: [false, true, true],
          supported: toolsAvailable,
        },
        {
          name: "Custom focus & saved presets",
          values: [false, true, true],
          supported: advancedAvailable,
        },
        {
          name: "Grouped focus & private summaries",
          values: [false, false, true],
          supported: advancedAvailable,
        },
      ],
    },
    {
      title: "Planning & Calendar",
      icon: CalendarDays,
      rows: [
        {
          name: "Personal Plan templates",
          values: tiers.map((t) =>
            String(premiumCatalog[t].planTemplates ?? "∞"),
          ) as Benefit["values"],
        },
        { name: "Standard Plans & Calendar", values: [true, true, true] },
        { name: "Single-Beacon repeats", values: [true, true, true] },
        { name: "Multi-Beacon repeats", values: [false, true, true] },
        {
          name: "Preparation overview",
          values: [false, false, true],
          supported: toolsAvailable,
        },
        {
          name: "Team rotation & Council readiness",
          values: [false, false, true],
          supported: advancedAvailable,
        },
      ],
    },
    {
      title: "Memories & Customization",
      icon: Images,
      rows: [
        { name: "Galleries, covers & icons", values: [true, true, true] },
        {
          name: "Albums & highlights",
          values: [false, true, true],
          supported: advancedAvailable,
        },
        {
          name: "Rich Journals & tags",
          values: [false, true, true],
          supported: advancedAvailable,
        },
        {
          name: "Additional palettes & styles",
          values: [false, true, true],
          supported: advancedAvailable,
        },
        {
          name: "Multi-Beacon Afterglow",
          values: [false, false, true],
          supported: advancedAvailable,
        },
        {
          name: "Linked reflections & layouts",
          values: [false, false, true],
          supported: advancedAvailable,
        },
      ],
    },
    {
      title: "Squad Boosts",
      icon: Sparkles,
      rows: [
        {
          name: "Included Boosts",
          values: tiers.map((t) =>
            String(premiumCatalog[t].squadBoosts),
          ) as Benefit["values"],
        },
      ],
    },
  ];
  const divider = {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 24,
    gap: 14,
  };
  const labelStyle = { flex: 1.9, minWidth: 0, paddingRight: 8 };
  const cellStyle = {
    flex: 1,
    minWidth: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <Screen title="Premium" eyebrow="MORE ROOM FOR TOGETHER" create={false}>
      <Txt muted>Compare what comes with Free, BEACON+ and Pro.</Txt>
      <View testID="premium-comparison" style={{ gap: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            paddingVertical: 18,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={labelStyle}>
            <Text style={styles.label}>Membership</Text>
            <Txt muted>Monthly</Txt>
          </View>
          {tiers.map((tier, index) => (
            <View key={tier} style={[cellStyle, { gap: 5 }]}>
              <Text style={[styles.label, { color: colors.primary }]}>
                {["Free", "Plus", "Pro"][index]}
              </Text>
              <Text style={[styles.body, { fontSize: 13 }]}>
                {["$0", "$4.99", "$9.99"][index]}
              </Text>
            </View>
          ))}
        </View>
        {sections.map(({ title, icon: Icon, rows }) => (
          <View key={title}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingTop: 24,
                paddingBottom: 10,
              }}
            >
              <Icon size={18} color={colors.primary} />
              <Text style={styles.label}>{title}</Text>
            </View>
            {rows.map(({ name, values, supported }) => (
              <View
                key={name}
                testID={`premium-benefit-${name}`}
                style={{
                  flexDirection: "row",
                  alignItems: "stretch",
                  minHeight: 52,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={labelStyle}>
                  <Text style={[styles.body, { fontSize: 13, lineHeight: 19 }]}>
                    {name}
                  </Text>
                </View>
                {values.map((value, index) => {
                  const pending = value === true && supported === false;
                  const label = pending
                    ? "After backend update"
                    : value === true
                      ? "Included"
                      : value === false
                        ? "Not included"
                        : value === "∞"
                          ? "Unlimited"
                          : value;
                  return (
                    <View
                      key={tiers[index]}
                      accessible
                      accessibilityLabel={`${["Free", "Plus", "Pro"][index]} · ${name} · ${label}`}
                      style={cellStyle}
                    >
                      {pending ? (
                        <Text
                          style={[
                            styles.body,
                            { fontSize: 11, color: colors.muted },
                          ]}
                        >
                          Soon
                        </Text>
                      ) : typeof value === "string" ? (
                        <Text style={[styles.label, { color: colors.primary }]}>
                          {value}
                        </Text>
                      ) : value ? (
                        <Check size={18} color={colors.primary} />
                      ) : (
                        <Minus size={16} color={colors.muted} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
      <Txt muted>
        ∞ Unlimited · Pro pricing is proposed. Prices shown per month.
      </Txt>
      <Txt muted>Pool 2 Boosts for shared Plus benefits or 4 for Pro.</Txt>
      <View style={divider}>
        <Text style={styles.h2}>Your membership</Text>
        <Txt muted>
          {demo ? "SIMULATED MEMBERSHIP" : "CURRENT MEMBERSHIP"} ·{" "}
          {entitlement.name}
        </Txt>
        <Txt muted>
          Personal Beacon templates: {usage.beacon_templates}/
          {entitlement.beaconTemplates ?? "Unlimited"}
        </Txt>
        <Txt muted>
          Personal Plan templates: {usage.plan_templates}/
          {entitlement.planTemplates ?? "Unlimited"}
        </Txt>
        {!demo && !data.capabilities?.premium && (
          <Txt muted>
            Premium enforcement is unavailable until the backend is updated.
          </Txt>
        )}
        <PremiumBoostSummary />
      </View>
      <View style={divider}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <CreditCard size={18} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Txt>Billing management · Coming soon</Txt>
          </View>
        </View>
        <Txt muted>
          Prices are previews. Purchases and billing management are coming soon.
        </Txt>
      </View>
      {demo && (
        <View style={divider}>
          <DemoTierSelector />
        </View>
      )}
    </Screen>
  );
}
