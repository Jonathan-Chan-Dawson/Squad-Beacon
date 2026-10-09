import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, Radio } from "lucide-react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { friendIds } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import { startDeviceLocation, stopDeviceLocation } from "@/src/platform/device";
import { activeSonarSession, locationShareExpiry, MAX_LOCATION_SHARE_MS, sonarMinutesRemaining } from "@/src/features/maps/sessionHelpers";
import { readViewerDeviceDefaults } from "@/src/features/profile/settings/deviceDefaults";
import { Action, Button, Sheet, Txt, useTheme } from "@/src/shared/ui";

type Duration = "15 minutes" | "30 minutes" | "1 hour" | "4 hours" | "Until activity ends";
const minuteDurations = { "15 minutes": 15, "30 minutes": 30, "1 hour": 60, "4 hours": 240 } as const;

export function ProfileSonarCard() {
  const { data, userId, demo, act } = useBeacon();
  const { styles, semanticColors: colors, tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState<Duration>("15 minutes");
  const [activityId, setActivityId] = useState("");
  const [busy, setBusy] = useState(false);
  const opening = useRef(0);
  const mountedViewer = useRef<string | null>(userId);
  const latest = useRef({ data, userId });
  useEffect(() => { latest.current = { data, userId }; }, [data, userId]);
  useEffect(() => {
    mountedViewer.current = userId;
    return () => { mountedViewer.current = null; opening.current += 1; };
  }, [userId]);
  const session = data.viewer_id === userId ? activeSonarSession(data.locations, userId, now) : undefined;
  useEffect(() => {
    pulse.set(session && !reducedMotion ? withRepeat(withTiming(0.45, { duration: 900 }), -1, true) : 1);
    return () => cancelAnimation(pulse);
  }, [session, reducedMotion, pulse]);
  const accepted = userId ? friendIds(data, userId).filter((id) => !data.blocks.some((block) =>
    (block.blocker_id === userId && block.blocked_id === id) || (block.blocked_id === userId && block.blocker_id === id))) : [];
  const friends = data.profiles.filter((person) => accepted.includes(person.id));
  const recipients = (data.location_recipients ?? []).filter((id) => accepted.includes(id));
  const eligible = data.activities.filter((activity) => activity.status === "scheduled" &&
    Date.parse(activity.ends_at) > (session ? Date.parse(session.expires_at) : now) &&
    (activity.owner_id === userId || data.rsvps.some((rsvp) => rsvp.activity_id === activity.id &&
      rsvp.user_id === userId && rsvp.status === "going" && rsvp.approved)));
  const atLimit = !!session && Date.parse(session.expires_at) >= now + MAX_LOCATION_SHARE_MS;
  const picked = selected.filter((id) => friends.some((friend) => friend.id === id));

  const openConfirmation = () => {
    // Reading a preference does not request location or start a session.
    const request = ++opening.current;
    setSelected([]);
    setActivityId("");
    setDuration("15 minutes");
    setOpen(true);
    if (userId) void readViewerDeviceDefaults(userId).then((defaults) => {
      if (opening.current !== request || mountedViewer.current !== userId) return;
      const minutes = defaults.sonarDurationMinutes;
      setDuration(minutes === 30 ? "30 minutes" : minutes === 60 ? "1 hour" : minutes === 240 ? "4 hours" : "15 minutes");
    }).catch(() => {});
  };
  const close = () => { if (!busy) { opening.current += 1; setOpen(false); } };
  const accountMatches = async (viewerId: string) => {
    if (!supabase) return false;
    const { data: authentication, error } = await supabase.auth.getSession();
    return !error && authentication.session?.user.id === viewerId;
  };

  return (
    <View style={[styles.card, { gap: 12 }]} testID="profile-sonar-card">
      <View style={[styles.row, { gap: 10 }]}>
        <Radio size={24} color={colors.accent} />
        <Text style={styles.h2}>Sonar</Text>
      </View>
      <View style={[styles.row, { gap: 8 }]}>
        {session && <Animated.View accessibilityLabel="Sonar active" style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.availability.available.color }, pulseStyle]} />}
        <Text style={styles.body}>{session ? `Sharing for ${sonarMinutesRemaining(session.expires_at, now)} more minutes` : "Location sharing is off"}</Text>
      </View>
      <Txt muted>{session ? `With ${recipients.map((id) => friends.find((person) => person.id === id)?.name ?? "Selected friend").join(", ") || "selected friends"}.` : "Temporarily share your live location with friends you choose."}</Txt>
      <Txt muted>Profile visibility never shares your location.</Txt>
      <Txt muted>Temporary. Only the friends you pick. Not a safety service.</Txt>
      <Button title={session ? "Extend Sonar" : "Start Sonar"} secondary disabled={busy} onPress={openConfirmation} />
      {session && <Action title="Stop Sonar" secondary disabled={busy} run={async () => {
        setBusy(true);
        try { await stopDeviceLocation(); await act("stop_location"); }
        finally { setBusy(false); }
      }} />}
      <Sheet title="Start Sonar" visible={open} onClose={close}>
        <View testID="profile-sonar-confirmation" style={{ gap: 12 }}>
          <Text style={styles.body}>Your live location will be visible only to the accepted friends you select. Sharing ends automatically; no location history is kept.</Text>
          <Text style={styles.body}>Temporary. Only the friends you pick. Not a safety service.</Text>
          {demo && <Txt muted>The demo never shares your device location. A real account and mobile development build are required.</Txt>}
          <Text style={styles.h2}>Choose friends</Text>
          {!friends.length && <Txt muted>Add and accept a friend before starting Sonar.</Txt>}
          {friends.map((friend) => <Pressable key={friend.id} accessibilityRole="checkbox" accessibilityLabel={`Share location with ${friend.name}`}
            accessibilityState={{ checked: picked.includes(friend.id), disabled: busy }} disabled={busy}
            onPress={() => setSelected((previous) => previous.includes(friend.id) ? previous.filter((id) => id !== friend.id) : [...previous, friend.id])}
            style={[styles.row, { minHeight: 44, gap: 12 }]}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border,
              backgroundColor: picked.includes(friend.id) ? colors.accent : colors.surface, alignItems: "center", justifyContent: "center" }}>
              {picked.includes(friend.id) && <Check size={18} color={colors.onAccent} />}
            </View><Text style={styles.body}>{friend.name}</Text>
          </Pressable>)}
          <Text style={styles.h2}>Duration</Text>
          {(["15 minutes", "30 minutes", "1 hour", "4 hours", "Until activity ends"] as const).map((option) =>
            <Button key={option} title={option} secondary={duration !== option} disabled={busy} onPress={() => { opening.current += 1; setDuration(option); }} />)}
          {duration === "Until activity ends" && <>
            <Txt muted>Choose a Beacon. Sharing ends at its end, capped at four hours from now.</Txt>
            {eligible.map((activity) => <Button key={activity.id} title={activity.title} secondary={activityId !== activity.id} disabled={busy} onPress={() => setActivityId(activity.id)} />)}
            {!eligible.length && <Txt muted>No eligible Beacon ends after the current sharing expiry.</Txt>}
          </>}
          {atLimit && <Txt muted>The session has reached the four-hour limit from now.</Txt>}
          <Action title={session ? "Confirm and extend Sonar" : "Confirm and start Sonar"}
            disabled={busy || !picked.length || atLimit || (duration === "Until activity ends" && !eligible.some((activity) => activity.id === activityId))}
            run={async () => {
              const currentSnapshot = latest.current;
              if (!userId || currentSnapshot.userId !== userId || currentSnapshot.data.viewer_id !== userId || mountedViewer.current !== userId) throw new Error("Refresh your profile before starting Sonar.");
              if (demo) throw new Error("The demo never shares your device location. Use a real account and mobile development build.");
              const currentFriends = friendIds(currentSnapshot.data, userId).filter((id) => !currentSnapshot.data.blocks.some((block) =>
                (block.blocker_id === userId && block.blocked_id === id) || (block.blocked_id === userId && block.blocker_id === id)));
              const confirmedFriends = picked.filter((id) => currentFriends.includes(id));
              if (!confirmedFriends.length || confirmedFriends.length !== picked.length) throw new Error("Choose currently accepted friends before starting Sonar.");
              const current = Date.now();
              const active = activeSonarSession(currentSnapshot.data.locations, userId, current);
              const beacon = currentSnapshot.data.activities.find((activity) => activity.id === activityId && activity.status === "scheduled" &&
                (activity.owner_id === userId || currentSnapshot.data.rsvps.some((rsvp) => rsvp.activity_id === activity.id && rsvp.user_id === userId && rsvp.status === "going" && rsvp.approved)));
              const expiry = duration === "Until activity ends"
                ? locationShareExpiry(duration, current, active?.expires_at, beacon?.ends_at)
                : Math.min(Math.max(current, active ? Date.parse(active.expires_at) : current) + minuteDurations[duration] * 60000, current + MAX_LOCATION_SHARE_MS);
              if (!expiry || expiry <= Math.max(current, active ? Date.parse(active.expires_at) : current)) throw new Error("Choose a duration or Beacon that extends sharing within the four-hour limit.");
              setBusy(true);
              try {
                const result = await act("start_location", { recipients: confirmedFriends, expires_at: new Date(expiry).toISOString() });
                const stillViewer = latest.current.userId === userId && latest.current.data.viewer_id === userId && await accountMatches(userId);
                if (mountedViewer.current !== userId || !stillViewer) {
                  if (stillViewer) await act("stop_location");
                  throw new Error("Your account or screen changed before location sharing could start.");
                }
                if (typeof result.id !== "string" || !result.id || typeof result.expires_at !== "string" ||
                  !Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= Date.now()) {
                  await act("stop_location");
                  throw new Error("Location sharing did not return a valid active session. Try again.");
                }
                try {
                  await startDeviceLocation({ id: result.id, expires_at: result.expires_at });
                  if (mountedViewer.current !== userId || latest.current.userId !== userId) {
                    await stopDeviceLocation();
                    throw new Error("Your account or screen changed while device location was starting.");
                  }
                }
                catch (error) {
                  if (latest.current.userId === userId && latest.current.data.viewer_id === userId && await accountMatches(userId)) await act("stop_location");
                  throw error;
                }
                opening.current += 1;
                setOpen(false);
              } finally { setBusy(false); }
            }} />
          <Txt muted>Location updates depend on device permissions, battery settings, and app state. Old positions disappear after five minutes. Offline stop ends device updates immediately; reconnect to revoke server access before expiry.</Txt>
        </View>
      </Sheet>
    </View>
  );
}
