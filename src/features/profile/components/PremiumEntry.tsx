import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { resolvePersonalEntitlements } from "@/src/shared/entitlements";
import { boostBalance } from "@/src/features/people/squadBoosts";
import { ProfileLink } from "@/src/features/people/components/ProfilePrimitives";

export function PremiumHeaderButton() {
  const { semanticColors: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="BEACON+ · Explore benefits"
      onPress={() => router.push("/settings/premium")}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 9,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Sparkles size={15} color={colors.accent} />
      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>
        BEACON+
      </Text>
    </Pressable>
  );
}

export function PersonalMembershipSummary({
  management = false,
}: {
  management?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { semanticColors: colors } = useTheme();
  if (!userId || data.viewer_id !== userId) return null;
  const e = resolvePersonalEntitlements(data, userId);
  const balance = boostBalance(data, userId);
  return (
    <View testID="personal-membership-summary" style={{ gap: 4 }}>
      {management ? (
        <Txt>{e.name}</Txt>
      ) : (
        <ProfileLink
          title={e.tier === "free" ? "Free · Explore BEACON+" : e.name}
          detail={
            e.tier === "free"
              ? "Plan more together with advanced tools and reusable setups."
              : e.tier === "pro"
                ? "Explore your advanced coordination and personalization benefits."
                : "Explore your tools, reusable setups and shared Squad benefits."
          }
          icon={<Sparkles size={20} color={colors.accent} />}
          onPress={() => router.push("/settings/premium")}
        />
      )}
      {e.source === "simulated" && (
        <Txt muted>Demo simulation · no purchase or subscription</Txt>
      )}
      {management && (
        <Txt muted>
          Your personal membership is separate from shared Squad benefits.
        </Txt>
      )}
      {e.squadBoosts > 0 && (
        <View style={{ gap: 6 }}>
          <Txt muted>
            {e.squadBoostStatus === "available"
              ? `${balance.available} of ${balance.allowance} Squad Boost slots available${balance.cooling ? ` · ${balance.cooling} waiting to become available` : ""}`
              : `${e.squadBoosts} included Squad Boost slots · Coming soon`}
          </Txt>
          {e.squadBoostStatus === "available" && (
            <Button
              compact
              secondary
              title="Manage Squad Boosts"
              onPress={() => router.push("/squad-boosts")}
            />
          )}
        </View>
      )}
    </View>
  );
}
