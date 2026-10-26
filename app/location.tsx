import React from "react";
import { router } from "expo-router";
import { ProfileSonarCard } from "@/src/features/profile/components/ProfileSonarCard";
import { Screen } from "@/src/shared/ui";

/** Legacy Map/deep-link entry; Sonar owns every session and device operation. */
export default function LocationScreen() {
  return (
    <Screen title="Sonar" eyebrow="" create={false}>
      <ProfileSonarCard
        compact
        autoOpen
        onDismiss={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)");
        }}
      />
    </Screen>
  );
}
