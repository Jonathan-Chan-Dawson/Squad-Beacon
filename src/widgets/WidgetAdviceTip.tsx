import React, { useEffect, useRef, useState } from "react";
import { isRunningInExpoGo } from "expo";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Platform, Text, View } from "react-native";
import { friendIds } from "../domain";
import { useBeacon } from "../store";
import { Button, Txt, useTheme } from "../ui";
import { useWidgetPreferences } from "./preferences";
import { isWidgetAdviceEligible } from "./adviceEligibility";

const markerPrefix = "widget_advice_v1_";

export default function WidgetAdviceTip() {
  const { data, userId, demo, loading, error } = useBeacon();
  const {
    preferences,
    ready,
    error: preferencesError,
  } = useWidgetPreferences();
  const hasFriendsOrSquad =
    !!userId &&
    (friendIds(data, userId).length > 0 ||
      data.squad_members.some((member) => member.user_id === userId));
  const eligible = isWidgetAdviceEligible({
    isIOS: Platform.OS === "ios",
    isExpoGo: isRunningInExpoGo(),
    hasRealAccount:
      !!userId &&
      !demo &&
      data.profiles.some((profile) => profile.id === userId),
    dataLoaded: !loading,
    dataErrorFree: !error,
    preferencesReady: ready,
    preferencesErrorFree: !preferencesError,
    widgetsEnabled: preferences.enabled,
    hasFriendsOrSquad,
  });

  if (!eligible || !userId) return null;
  return <EligibleWidgetAdviceTip key={userId} accountId={userId} />;
}

function EligibleWidgetAdviceTip({ accountId }: { accountId: string }) {
  const { styles } = useTheme();
  const [visible, setVisible] = useState(false);
  const attempt = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    if (!attempt.current) {
      attempt.current = (async () => {
        const key = `${markerPrefix}${accountId}`;
        const seen = await SecureStore.getItemAsync(key);
        if (seen !== null) return false;
        await SecureStore.setItemAsync(key, "seen");
        return true;
      })().catch(() => false);
    }
    void attempt.current.then((shouldShow) => {
      if (active && shouldShow) setVisible(true);
    });
    return () => {
      active = false;
    };
  }, [accountId]);

  if (!visible) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>A little more of your people, at a glance</Text>
      <Txt muted>
        Set up an optional Home Screen widget for friend status or a circle. It
        stays off until you turn it on, and starts with discreet details.
      </Txt>
      <Button
        title="Set up widgets"
        onPress={() => {
          setVisible(false);
          router.push("/widgets" as Href);
        }}
      />
      <Button title="Not now" secondary onPress={() => setVisible(false)} />
    </View>
  );
}
