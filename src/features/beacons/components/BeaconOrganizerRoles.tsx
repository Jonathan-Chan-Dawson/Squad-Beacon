import React, { useState } from "react";
import { Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
import type { Activity } from "@/src/shared/types";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  canAssignBeaconRole,
  canManageBeaconSettings,
  canRevokeBeaconRole,
} from "../permissions";

/** Post-publication only: invitations never grant organizer privileges. */
export function BeaconOrganizerRoles({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const { styles } = useTheme();
  const [open, setOpen] = useState(false);
  if (
    !userId ||
    data.viewer_id !== userId ||
    !canManageBeaconSettings(data, activity, userId)
  )
    return null;
  const ids = [
    ...new Set(
      data.rsvps
        .filter((row) => row.activity_id === activity.id)
        .map((row) => row.user_id),
    ),
  ].filter(
    (id) =>
      canAssignBeaconRole(data, activity, userId, id, "admin") ||
      canRevokeBeaconRole(data, activity, userId, id),
  );
  async function change(target: string, role?: "coowner" | "admin") {
    if (
      !userId ||
      data.viewer_id !== userId ||
      !(role
        ? canAssignBeaconRole(data, activity, userId, target, role)
        : canRevokeBeaconRole(data, activity, userId, target))
    )
      throw new Error(
        "This person or role is no longer eligible. Refresh before continuing.",
      );
    await act(role ? "assign_beacon_role" : "revoke_beacon_role", {
      activity_id: activity.id,
      user_id: target,
      ...(role ? { role } : {}),
      expected_actor_id: userId,
    });
  }
  return (
    <>
      <Button title="Organizer roles" secondary onPress={() => setOpen(true)} />
      <Sheet
        title="Organizer roles"
        visible={open}
        onClose={() => setOpen(false)}
        footer={<Button title="Done" onPress={() => setOpen(false)} />}
      >
        <Txt muted>
          Only approved Going participants are eligible. Co-owners can edit
          settings; admins can manage participants. Invitations do not grant
          roles.
        </Txt>
        {!ids.length ? (
          <Txt>
            No eligible participants yet. Invite people and wait for their
            approved Going response.
          </Txt>
        ) : null}
        {ids.map((id, index) => {
          const profile = data.profiles.find((person) => person.id === id);
          const name =
            profile && canViewProfile(data, profile, userId)
              ? profile.name
              : `Participant ${index + 1}`;
          const current = data.beacon_roles.find(
            (row) => row.activity_id === activity.id && row.user_id === id,
          )?.role;
          return (
            <View key={id} style={[styles.card, { gap: 8 }]}>
              <Text style={styles.h2}>{name}</Text>
              <Txt muted>
                {current === "coowner"
                  ? "Co-owner"
                  : current === "admin"
                    ? "Admin"
                    : "Participant"}
              </Txt>
              {(["coowner", "admin"] as const).map((role) =>
                current !== role &&
                canAssignBeaconRole(data, activity, userId, id, role) ? (
                  <Action
                    key={role}
                    secondary
                    title={`Make ${name} ${role === "coowner" ? "co-owner" : "admin"}`}
                    run={() => change(id, role)}
                  />
                ) : null,
              )}
              {canRevokeBeaconRole(data, activity, userId, id) ? (
                <Action
                  secondary
                  title={`Remove ${name} organizer role`}
                  run={() => change(id)}
                />
              ) : null}
            </View>
          );
        })}
      </Sheet>
    </>
  );
}
