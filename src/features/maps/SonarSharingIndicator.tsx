import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Radio, Users } from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Action, Button, Sheet, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canViewProfile } from "@/src/features/profile/privacy";
import { stopDeviceLocation } from "@/src/platform/device";
import type { LocationSession } from "@/src/shared/types";
import { sonarLocationIsFresh, sonarMinutesRemaining } from "@/src/features/maps/sessionHelpers";

function remainingLabel(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m left` : `${hours}h left`;
  }
  return `${minutes} min left`;
}

export function SonarSharingIndicator({
  session,
  onExtend,
}: {
  session: LocationSession | undefined;
  onExtend: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!session || reducedMotion) {
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion, session]);

  if (!session || !userId || data.viewer_id !== userId) return null;
  const recipientIds = data.location_recipients ?? [];
  const recipients = recipientIds
    .map((id) => data.profiles.find((profile) => profile.id === id))
    .filter((profile): profile is NonNullable<typeof profile> => !!profile && canViewProfile(data, profile, userId));
  const minutes = sonarMinutesRemaining(session.expires_at, now);
  const locationFresh = sonarLocationIsFresh(session, now);

  return (
    <>
      <Pressable
        testID="sonar-sharing-indicator"
        accessibilityRole="button"
        accessibilityLabel={`Sharing with ${recipientIds.length} people, ${remainingLabel(minutes)}`}
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, borderRadius: 22, borderWidth: 1, borderColor: "#42A96C77", backgroundColor: colors.white + "E8" }}
      >
        <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
          {!reducedMotion ? (
            <Animated.View style={{ position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#36A866", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }] }} />
          ) : null}
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#26944F" }} />
        </View>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>
          Sharing with {recipientIds.length} · {remainingLabel(minutes)}
        </Text>
      </Pressable>
      <Sheet title="Sonar sharing" visible={open} onClose={() => setOpen(false)} maxHeightPercent={62}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Radio size={20} color="#26944F" />
            <Text style={styles.h2}>Your live location is shared</Text>
          </View>
          <Text style={styles.muted}>{remainingLabel(minutes)} · Ends {new Date(session.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
          {!locationFresh ? <Text accessibilityLiveRegion="polite" style={styles.muted}>The sharing session is still active, but its last location point is over five minutes old and is no longer visible to friends.</Text> : null}
          <Text style={styles.label}>WHO CAN SEE YOU</Text>
          {recipients.length ? recipients.map((profile) => (
            <View key={profile.id} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Users size={16} color={colors.green} />
              <Text style={styles.body}>{profile.name}</Text>
            </View>
          )) : (
            <Text style={styles.muted}>{recipientIds.length ? "Your selected friends can see your location." : "No recipients are currently listed."}</Text>
          )}
          <Text style={styles.muted}>Location sharing ends automatically. You can stop it at any time.</Text>
          <Button title="Extend sharing" secondary onPress={() => { setOpen(false); onExtend(); }} />
          <Action
            title="Stop sharing"
            secondary
            run={async () => {
              await stopDeviceLocation();
              await act("stop_location");
              setOpen(false);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}
