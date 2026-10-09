import React from "react";
import { View, Text } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, useTheme } from "@/src/shared/ui";
import { beaconCapacity } from "@/src/features/beacons/permissions";
import type { Activity } from "@/src/shared/types";
import { uiHaptics } from "@/src/shared/design-system";
export function BeaconResponse({
  activity: a,
  compact = false,
}: {
  activity: Activity;
  compact?: boolean;
}) {
  const { styles } = useTheme();

  const { data, userId, act } = useBeacon();
  const now = useNow();
  const rsvp = data.rsvps.find(
    (r) => r.activity_id === a.id && r.user_id === userId,
  );
  async function respond(status: "going" | "interested" | "withdraw") {
    await act("rsvp", { id: a.id, status });
    if (status !== "withdraw") uiHaptics.success();
  }
  if (
    a.owner_id === userId ||
    a.mode === "solo" ||
    a.status !== "scheduled" ||
    Date.parse(a.ends_at) <= now
  )
    return null;
  const pending = rsvp?.status === "requested";
  const approval =
    (a.approval_required || a.mode === "invite") && !rsvp?.approved;
  if (compact) {
    const pending = rsvp?.status === "requested";
    const going = rsvp?.status === "going";
    const capacity = beaconCapacity(data, a);
    const closed = capacity.closed && !pending && !going;
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Action
            title={
              pending
                ? "Pending"
                : going
                  ? "I'm Out"
                  : capacity.full
                    ? "Full"
                    : closed
                      ? "Closed"
                  : approval
                    ? "Request"
                    : "I'm In"
            }
            disabled={pending || closed}
            secondary={pending || going || closed}
            run={() => respond(going ? "withdraw" : "going")}
          />
        </View>
        {pending ? (
          <View style={{ width: 112 }}>
            <Action
              title="Cancel request"
              secondary
              compact
              run={() => respond("withdraw")}
            />
          </View>
        ) : !going && !closed ? (
          <View style={{ width: 86 }}>
            <Action
              title="Maybe"
              disabled={rsvp?.status === "interested"}
              secondary
              compact
              run={() => respond("interested")}
            />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {rsvp && (
        <Text accessibilityLiveRegion="polite" style={styles.label}>
          {pending
            ? "Pending"
            : rsvp.status === "going"
              ? "You're in. See you there!"
              : rsvp.status === "interested"
                ? "You're considering it. No pressure."
                : "You're invited. One tap and you're in."}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Action
            title={
              pending
                ? "Pending"
                : rsvp?.status === "going"
                  ? "I'm In"
                  : approval
                    ? "Request"
                    : "I'm In"
            }
            disabled={pending || rsvp?.status === "going"}
            secondary={rsvp?.status === "going"}
            run={() => respond("going")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            title="Maybe"
            secondary={rsvp?.status !== "interested"}
            run={() => respond("interested")}
          />
        </View>
        {rsvp && (
          <View style={{ flex: 1 }}>
            <Action
              title="I'm Out"
              secondary
              run={() => respond("withdraw")}
            />
          </View>
        )}
      </View>
    </View>
  );
}
export function BeaconMomentum({ activity: a }: { activity: Activity }) {
  const { styles } = useTheme();

  const { data } = useBeacon();
  const responses = data.rsvps.filter((r) => r.activity_id === a.id);
  const going = responses.filter(
    (r) => r.status === "going" && r.user_id !== a.owner_id,
  );
  const maybe = responses.filter((r) => r.status === "interested");
  const names = going
    .slice(0, 2)
    .map(
      (r) =>
        data.profiles.find((p) => p.id === r.user_id)?.name.split(" ")[0] ??
        "A friend",
    );
  if (a.mode === "solo")
    return (
      <Text style={styles.muted}>
        A little update from{" "}
        {data.profiles.find((p) => p.id === a.owner_id)?.name.split(" ")[0] ??
          "your friend"}
      </Text>
    );
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>
        {going.length + 1} going
        {maybe.length ? ` \u00b7 ${maybe.length} considering` : ""}
      </Text>
      {!!a.target_count && (
        <Text style={styles.label}>
          {going.length + 1 >= a.target_count
            ? "The crew is ready!"
            : `Need ${a.target_count - going.length - 1} more to make it happen`}
        </Text>
      )}
      <Text style={styles.muted}>
        {names.length
          ? `${names.join(" & ")}${going.length > 2 ? ` + ${going.length - 2} more` : ""} ${going.length === 1 ? "is" : "are"} in.`
          : "The host is in. Bring a little company."}
      </Text>
    </View>
  );
}
