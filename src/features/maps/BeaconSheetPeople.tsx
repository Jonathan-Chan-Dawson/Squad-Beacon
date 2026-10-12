import React, { useState } from "react";
import { View } from "react-native";
import {
  ActivityDetailPeople,
  type SafeRsvpRow,
} from "@/components/activity-detail/ActivityDetailPeople";
import type { Activity, RSVP } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { AttendanceControls } from "@/src/features/beacons/AttendanceControls";
import {
  canAdmitBeaconParticipants,
  canRemoveBeaconParticipant,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import { Action, Button, Txt, useTheme } from "@/src/shared/ui";

export function BeaconSheetPeople({
  activity,
  onPerson,
}: {
  activity: Activity;
  onPerson(id: string): void;
}) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const { styles } = useTheme();
  const [confirmation, setConfirmation] = useState<{
    id: string;
    name: string;
    action: "deny_rsvp" | "remove_participant";
  } | null>(null);
  const canAdmit =
    !!userId && canAdmitBeaconParticipants(data, activity, userId);
  const host = data.profiles.find(
    (profile) =>
      profile.id === activity.owner_id && canViewProfile(data, profile, userId),
  );
  const rows = data.rsvps.filter(
    (row) =>
      row.activity_id === activity.id &&
      (row.user_id === userId ||
        data.profiles.some(
          (profile) =>
            profile.id === row.user_id && canViewProfile(data, profile, userId),
        )),
  );
  const safeRow = (row: RSVP): SafeRsvpRow => {
    const profile = data.profiles.find(
      (profile) =>
        profile.id === row.user_id && canViewProfile(data, profile, userId),
    );
    const arrival =
      userId &&
      canUseBeaconModules(data, activity, userId) &&
      isApprovedGoing(activity, row)
        ? data.beacon_attendance.find(
            (entry) =>
              entry.activity_id === activity.id &&
              entry.user_id === row.user_id,
          )?.state
        : undefined;
    return {
      userId: row.user_id,
      name: row.user_id === userId ? "You" : profile?.name || "Participant",
      profile,
      isSelf: row.user_id === userId,
      arrivalLabel:
        arrival === "present"
          ? "Here"
          : arrival === "arriving"
            ? "On my way"
            : undefined,
    };
  };
  const request = (id: string, action: "deny_rsvp" | "remove_participant") => {
    const row = rows.find((row) => row.user_id === id);
    if (row) setConfirmation({ id, name: safeRow(row).name, action });
  };
  const friends = userId ? friendIds(data, userId) : [];
  return (
    <View style={{ gap: 12 }}>
      <AttendanceControls activity={activity} />
      {host && (
        <View style={styles.card}>
          <Button
            title={`Hosted by ${host.name}`}
            secondary
            onPress={() => onPerson(host.id)}
          />
        </View>
      )}
      <ActivityDetailPeople
        going={rows
          .filter((row) => isApprovedGoing(activity, row))
          .map(safeRow)}
        maybe={rows.filter((row) => row.status === "interested").map(safeRow)}
        requested={rows
          .filter(
            (row) =>
              row.status === "requested" ||
              (row.status === "going" && !isApprovedGoing(activity, row)),
          )
          .map(safeRow)}
        viewerUserId={userId}
        canAdmit={canAdmit}
        onProfile={onPerson}
        onApprove={(id) =>
          act("approve_rsvp", { id: activity.id, user_id: id })
        }
        onDeny={(id) => request(id, "deny_rsvp")}
        canRemove={(id) =>
          !!userId && canRemoveBeaconParticipant(data, activity, userId, id)
        }
        onRemove={(id) => request(id, "remove_participant")}
      />
      {confirmation && (
        <View style={styles.card}>
          <Txt>
            {confirmation.action === "deny_rsvp"
              ? "Deny request from"
              : "Remove"}{" "}
            {confirmation.name}?
          </Txt>
          <Action
            title="Confirm"
            run={async () => {
              await act("remove_rsvp", {
                id: activity.id,
                user_id: confirmation.id,
              });
              setConfirmation(null);
            }}
          />
          <Button
            title="Cancel"
            secondary
            onPress={() => setConfirmation(null)}
          />
        </View>
      )}
      {rows
        .filter((row) => row.status === "invited")
        .map((row) => (
          <View key={row.user_id} style={styles.card}>
            <Button
              title={safeRow(row).name}
              secondary
              onPress={() => onPerson(row.user_id)}
            />
            <Txt muted>Invited · awaiting response</Txt>
          </View>
        ))}
      {canAdmit &&
        activity.status === "scheduled" &&
        Date.parse(activity.ends_at) > now && (
          <View style={styles.card}>
            <Txt>Invite a friend</Txt>
            {data.profiles
              .filter(
                (profile) =>
                  friends.includes(profile.id) &&
                  canViewProfile(data, profile, userId) &&
                  !rows.some((row) => row.user_id === profile.id),
              )
              .map((profile) => (
                <Action
                  key={profile.id}
                  title={`Invite ${profile.name}`}
                  secondary
                  run={() =>
                    act("invite_activity", {
                      id: activity.id,
                      user_id: profile.id,
                    })
                  }
                />
              ))}
            {!data.profiles.some(
              (profile) =>
                friends.includes(profile.id) &&
                canViewProfile(data, profile, userId) &&
                !rows.some((row) => row.user_id === profile.id),
            ) && (
              <Txt muted>
                All available friends have already been invited or responded.
              </Txt>
            )}
          </View>
        )}
    </View>
  );
}
