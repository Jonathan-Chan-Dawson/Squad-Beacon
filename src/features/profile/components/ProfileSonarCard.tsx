import { sonarSelectionRequest, type SonarDuration } from "../sonarSelection";
import { SocialSelector } from "@/src/features/people/components/SocialSelector";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight, Radio } from "lucide-react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { friendIds } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import { startDeviceLocation, stopDeviceLocation } from "@/src/platform/device";
import {
  activeSonarSession,
  MAX_LOCATION_SHARE_MS,
  sonarMinutesRemaining,
} from "@/src/features/maps/sessionHelpers";
import { readViewerDeviceDefaults } from "@/src/features/profile/settings/deviceDefaults";
import { HomeAction } from "@/src/features/beacons/components/HomeAction";
import { Action, Button, Sheet, Txt, useTheme } from "@/src/shared/ui";

type Duration = SonarDuration;

function ProfileSonarControl({
  compact = false,
  row = false,
}: {
  compact?: boolean;
  row?: boolean;
}) {
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
  const [sharingError, setSharingError] = useState("");
  const submitting = useRef(false);
  const opening = useRef(0);
  const openedSessionId = useRef<string | null>(null);
  const mountedViewer = useRef<string | null>(userId);
  const latest = useRef({ data, userId });
  useEffect(() => {
    latest.current = { data, userId };
  }, [data, userId]);
  useEffect(() => {
    mountedViewer.current = userId;
    return () => {
      mountedViewer.current = null;
      opening.current += 1;
    };
  }, [userId]);
  const session =
    data.viewer_id === userId
      ? activeSonarSession(data.locations, userId, now)
      : undefined;
  useEffect(() => {
    pulse.set(
      session && !reducedMotion && !row
        ? withRepeat(withTiming(0.45, { duration: 900 }), -1, true)
        : 1,
    );
    return () => cancelAnimation(pulse);
  }, [session, reducedMotion, pulse, row]);
  const accepted = userId
    ? friendIds(data, userId).filter(
        (id) =>
          !data.blocks.some(
            (block) =>
              (block.blocker_id === userId && block.blocked_id === id) ||
              (block.blocked_id === userId && block.blocker_id === id),
          ),
      )
    : [];
  const friends = data.profiles.filter((person) =>
    accepted.includes(person.id),
  );
  const recipients = (data.location_recipients ?? []).filter((id) =>
    accepted.includes(id),
  );
  const eligible = data.activities.filter(
    (activity) =>
      activity.status === "scheduled" &&
      Date.parse(activity.ends_at) >
        (session ? Date.parse(session.expires_at) : now) &&
      (activity.owner_id === userId ||
        data.rsvps.some(
          (rsvp) =>
            rsvp.activity_id === activity.id &&
            rsvp.user_id === userId &&
            rsvp.status === "going" &&
            rsvp.approved,
        )),
  );
  const atLimit =
    !!session && Date.parse(session.expires_at) >= now + MAX_LOCATION_SHARE_MS;
  const picked = selected.filter((id) =>
    friends.some((friend) => friend.id === id),
  );

  const openConfirmation = () => {
    // Reading a preference does not request location or start a session.
    const request = ++opening.current;
    openedSessionId.current = session?.id ?? null;
    setSelected(session ? [...(data.location_recipients ?? [])] : []);
    setSharingError("");
    setActivityId("");
    setDuration("15 minutes");
    setOpen(true);
    if (userId)
      void readViewerDeviceDefaults(userId)
        .then((defaults) => {
          if (opening.current !== request || mountedViewer.current !== userId)
            return;
          const minutes = defaults.sonarDurationMinutes;
          setDuration(
            minutes === 30
              ? "30 minutes"
              : minutes === 60
                ? "1 hour"
                : minutes === 240
                  ? "4 hours"
                  : "15 minutes",
          );
        })
        .catch(() => {});
  };
  const close = () => {
    if (!busy) {
      opening.current += 1;
      setOpen(false);
    }
  };
  const accountMatches = async (viewerId: string) => {
    if (!supabase) return false;
    const { data: authentication, error } = await supabase.auth.getSession();
    return !error && authentication.session?.user.id === viewerId;
  };

  const confirmSharing = async (extend: boolean) => {
    const currentSnapshot = latest.current;
    if (
      !userId ||
      currentSnapshot.userId !== userId ||
      currentSnapshot.data.viewer_id !== userId ||
      mountedViewer.current !== userId
    )
      throw new Error("Refresh your profile before starting Sonar.");
    if (demo)
      throw new Error(
        "The demo never shares your device location. Use a real account and mobile development build.",
      );
    const request = sonarSelectionRequest(
      currentSnapshot.data,
      userId,
      selected,
      duration,
      activityId,
      openedSessionId.current ? (extend ? "extend" : "save") : "start",
      openedSessionId.current,
    );
    setBusy(true);
    try {
      const result = await act("start_location", {
        ...request,
        expected_actor_id: userId,
      });
      const stillViewer =
        latest.current.userId === userId &&
        latest.current.data.viewer_id === userId &&
        (await accountMatches(userId));
      if (mountedViewer.current !== userId || !stillViewer) {
        if (stillViewer) await act("stop_location");
        throw new Error(
          "Your account or screen changed before location sharing could start.",
        );
      }
      if (
        typeof result.id !== "string" ||
        !result.id ||
        typeof result.expires_at !== "string" ||
        !Number.isFinite(Date.parse(result.expires_at)) ||
        Date.parse(result.expires_at) <= Date.now()
      ) {
        await act("stop_location");
        throw new Error(
          "Location sharing did not return a valid active session. Try again.",
        );
      }
      try {
        await startDeviceLocation({
          id: result.id,
          expires_at: result.expires_at,
        });
        if (
          mountedViewer.current !== userId ||
          latest.current.userId !== userId
        ) {
          await stopDeviceLocation();
          throw new Error(
            "Your account or screen changed while device location was starting.",
          );
        }
      } catch (error) {
        if (
          latest.current.userId === userId &&
          latest.current.data.viewer_id === userId &&
          (await accountMatches(userId))
        )
          await act("stop_location");
        throw error;
      }
      opening.current += 1;
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (extend: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSharingError("");
    try {
      await confirmSharing(extend);
    } catch (failure) {
      setSharingError(
        failure instanceof Error
          ? failure.message
          : "Could not update Sonar. Try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <View
      style={compact ? { gap: 0 } : [styles.card, { gap: 12 }]}
      testID={compact ? "home-sonar-control" : "profile-sonar-card"}
    >
      {row ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session ? "Manage active Sonar" : "Open Sonar"}
          disabled={busy}
          onPress={openConfirmation}
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Radio
            size={18}
            color={session ? colors.accent : colors.textSecondary}
          />
          <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14 }}>
            Sonar
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {session
              ? `Active · ${sonarMinutesRemaining(session.expires_at, now)}m`
              : "Off"}
          </Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
      ) : compact ? (
        <HomeAction
          title={
            session
              ? `Sonar · ${sonarMinutesRemaining(session.expires_at, now)}m`
              : "Sonar"
          }
          label={session ? "Manage active Sonar" : "Open Sonar"}
          plain
          selected={!!session}
          disabled={busy}
          onPress={openConfirmation}
          icon={
            <Radio
              size={14}
              color={session ? colors.accent : colors.textSecondary}
            />
          }
        />
      ) : (
        <>
          <View style={[styles.row, { gap: 10 }]}>
            <Radio size={24} color={colors.accent} />
            <Text style={styles.h2}>Sonar</Text>
          </View>
          <View style={[styles.row, { gap: 8 }]}>
            {session && (
              <Animated.View
                accessibilityLabel="Sonar active"
                style={[
                  {
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: tokens.availability.available.color,
                  },
                  pulseStyle,
                ]}
              />
            )}
            <Text style={styles.body}>
              {session
                ? `Sharing for ${sonarMinutesRemaining(session.expires_at, now)} more minutes`
                : "Location sharing is off"}
            </Text>
          </View>
          <Txt muted>
            {session
              ? `With ${recipients.map((id) => friends.find((person) => person.id === id)?.name ?? "Selected friend").join(", ") || "selected friends"}.`
              : "Temporarily share your live location with friends you choose."}
          </Txt>
          <Txt muted>Profile visibility never shares your location.</Txt>
          <Txt muted>
            Temporary. Only the friends you pick. Not a safety service.
          </Txt>
          <Button
            title={session ? "Extend Sonar" : "Start Sonar"}
            secondary
            disabled={busy}
            onPress={openConfirmation}
          />
          {session && (
            <Action
              title="Stop Sonar"
              secondary
              disabled={busy}
              run={async () => {
                setBusy(true);
                try {
                  await stopDeviceLocation();
                  await act("stop_location");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </>
      )}
      <Sheet
        title={session ? "Manage Sonar" : "Start Sonar"}
        visible={open}
        onClose={close}
        footer={
          <View style={{ gap: 8 }}>
            {!!sharingError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {sharingError}
              </Text>
            )}
            <Button
              title={`${session ? "Save people" : "Start Sonar"} · ${picked.length} ${picked.length === 1 ? "person" : "people"}`}
              disabled={
                busy ||
                !picked.length ||
                selected.length > 50 ||
                picked.length !== selected.length ||
                (!session &&
                  duration === "Until activity ends" &&
                  !eligible.some((a) => a.id === activityId))
              }
              onPress={() => void submit(!session)}
            />
            {session && (
              <Button
                secondary
                title="Extend Sonar"
                disabled={
                  busy ||
                  !picked.length ||
                  selected.length > 50 ||
                  picked.length !== selected.length ||
                  atLimit ||
                  (duration === "Until activity ends" &&
                    !eligible.some((a) => a.id === activityId))
                }
                onPress={() => void submit(true)}
              />
            )}
          </View>
        }
      >
        <View testID="profile-sonar-confirmation" style={{ gap: 12 }}>
          {session ? (
            <Action
              title="Stop Sonar"
              secondary
              disabled={busy}
              run={async () => {
                setBusy(true);
                try {
                  await stopDeviceLocation();
                  await act("stop_location");
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
          <Text style={styles.body}>
            Choose which friends can temporarily see your live location.
          </Text>
          {session && (
            <Txt muted>
              Active · {sonarMinutesRemaining(session.expires_at, now)}m
              remaining. Save people keeps the current end time.
            </Txt>
          )}
          <SocialSelector
            groupBehavior="filterFriends"
            supportedKinds={["friend"]}
            selected={selected.map((id) => ({ kind: "friend", id }))}
            onChange={(rows) =>
              setSelected(
                rows.filter((r) => r.kind === "friend").map((r) => r.id),
              )
            }
            disabled={busy}
          />
          {picked.length !== selected.length && (
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="alert" style={styles.error}>
                Some selected people are no longer eligible. Review your
                selection before sharing.
              </Text>
              <Button
                secondary
                title="Remove unavailable selections"
                onPress={() => setSelected(picked)}
                disabled={busy}
              />
            </View>
          )}
          <Text style={styles.h2}>{session ? "Extend by" : "Duration"}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {(
              [
                "15 minutes",
                "30 minutes",
                "1 hour",
                "4 hours",
                "Until activity ends",
              ] as const
            ).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{
                  selected: duration === option,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => {
                  opening.current += 1;
                  setDuration(option);
                }}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                  borderBottomWidth: 2,
                  borderBottomColor:
                    duration === option ? colors.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    color:
                      duration === option
                        ? colors.accent
                        : colors.textSecondary,
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {duration === "Until activity ends" && (
            <>
              <Txt muted>
                Choose a Beacon. Sharing ends at its end, capped at{" "}
                {MAX_LOCATION_SHARE_MS / 3600000} hours from now.
              </Txt>
              {eligible.map((activity) => (
                <Button
                  key={activity.id}
                  title={activity.title}
                  secondary={activityId !== activity.id}
                  disabled={busy}
                  onPress={() => setActivityId(activity.id)}
                />
              ))}
              {!eligible.length && (
                <Txt muted>
                  No eligible Beacon ends after the current sharing expiry.
                </Txt>
              )}
            </>
          )}
          {atLimit && (
            <Txt muted>
              The session has reached the {MAX_LOCATION_SHARE_MS / 3600000}-hour
              limit from now.
            </Txt>
          )}
          {demo && (
            <Txt muted>
              The demo never shares your device location. A real account and
              mobile development build are required.
            </Txt>
          )}
          <Txt muted>
            Location updates depend on device permissions, battery settings, and
            app state. Old positions disappear after five minutes. Offline stop
            ends device updates immediately; reconnect to revoke server access
            before expiry.
          </Txt>
        </View>
      </Sheet>
    </View>
  );
}

export function ProfileSonarCard(
  props: React.ComponentProps<typeof ProfileSonarControl>,
) {
  const { userId } = useBeacon();
  return <ProfileSonarControl key={userId ?? "signed-out"} {...props} />;
}
