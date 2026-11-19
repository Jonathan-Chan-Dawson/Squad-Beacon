import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import type { Activity } from "@/src/shared/types";
import type { PremiumFeature } from "@/src/shared/premiumFeatures";
import { premiumFeatures } from "@/src/shared/premiumFeatures";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { premiumAccessPresentation } from "../premiumPresentation";
/** Describes access only; the caller retains the feature's role and action gates. */
export function PremiumFeatureHint({
  feature,
  activity,
  compact = false,
}: {
  feature: PremiumFeature;
  activity?: Pick<Activity, "id" | "owner_id">;
  compact?: boolean;
}) {
  const { data } = useBeacon();
  const { semanticColors: colors } = useTheme();
  const access = premiumAccessPresentation(data, feature, activity);
  const featureLabel = premiumFeatures[feature].label
    .replace("Agendas", "Activity schedules")
    .replace("Agenda", "Activity schedule");
  return (
    <View testID={`premium-access-${feature}`} style={{ gap: 6 }}>
      <Text
        style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}
      >
        {compact ? `${featureLabel} · ` : ""}
        {access.tierLabel} · {access.label}
        {access.simulated ? " · Demo simulation" : ""}
        {access.grace_until
          ? ` · Grace until ${new Date(access.grace_until).toLocaleDateString()}`
          : ""}
      </Text>
      {!compact && (
        <>
          <Txt muted>
            {featureLabel}. {access.detail}
          </Txt>
          {access.status === "available" && (
            <Button
              compact
              secondary
              title={
                access.available
                  ? "Membership details"
                  : "Explore BEACON+ benefits"
              }
              onPress={() => router.push("/settings/premium")}
            />
          )}
        </>
      )}
    </View>
  );
}
