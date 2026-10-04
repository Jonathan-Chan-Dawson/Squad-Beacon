import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { Minus, Plus, Trash } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, Txt, useTheme } from "@/src/shared/ui";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  canJoinTeam,
  MAX_BEACON_TEAMS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAM_SIZE,
  membersForTeam,
  teamOccupancyCount,
  teamsForActivity,
} from "./models";

type ScoreboardActivity = Activity & {
  enable_scoreboard?: boolean;
  scoreboard_max_team_size?: number | null;
};

export function BeaconScoreboard({ activity }: { activity: Activity }) {
  const { colors, styles } = useTheme();
  const { data, userId, act } = useBeacon();
  const [newTeam, setNewTeam] = useState("");
  const [teamDraftId, setTeamDraftId] = useState(() => Crypto.randomUUID());
  const [size, setSize] = useState(
    String((activity as ScoreboardActivity).scoreboard_max_team_size ?? ""),
  );
  const [formActivityId, setFormActivityId] = useState(activity.id);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (formActivityId !== activity.id) {
    setFormActivityId(activity.id);
    setNewTeam("");
    setSize(
      String((activity as ScoreboardActivity).scoreboard_max_team_size ?? ""),
    );
    setTeamDraftId(Crypto.randomUUID());
    setConfirmRemove(null);
    setError("");
  }
  const currentActivity = data.activities.find(
    (item) => item.id === activity.id,
  );
  const enabledActivity = currentActivity as ScoreboardActivity | undefined;
  const eligible =
    !!userId &&
    data.viewer_id === userId &&
    !!currentActivity &&
    enabledActivity?.enable_scoreboard === true &&
    canUseBeaconModules(data, currentActivity, userId);
  const manager =
    !!userId &&
    data.viewer_id === userId &&
    !!currentActivity &&
    canManageBeacon(data, currentActivity, userId);
  const teams = eligible ? teamsForActivity(data, activity.id) : [];
  if (!eligible) return null;

  const run = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await act(action, payload);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update the scoreboard.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addTeam = async () => {
    if (!userId || !newTeam.trim()) return;
    if (
      await run("create_beacon_team", {
        id: teamDraftId,
        activity_id: activity.id,
        name: newTeam.trim(),
      })
    ) {
      setNewTeam("");
      setTeamDraftId(Crypto.randomUUID());
    }
  };

  const saveSize = async () => {
    if (!enabledActivity) return;
    const number = size.trim() ? Number(size) : null;
    await run("save_beacon_scoreboard", {
      activity_id: activity.id,
      enabled: true,
      max_team_size: number,
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Teams / Scoreboard</Text>
      <Txt muted>
        Pick teams and track the score. No brackets or tournament setup.
      </Txt>
      {manager && (
        <View style={[styles.card, { gap: 8, padding: 12 }]}>
          <Field
            label={`Maximum team size (1–${MAX_TEAM_SIZE}; optional)`}
            value={size}
            onChangeText={(value) => setSize(value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="No limit"
          />
          <Button
            title="Save team size"
            secondary
            compact
            disabled={busy}
            onPress={() => void saveSize()}
          />
        </View>
      )}
      {!teams.length && <Txt muted>No teams yet.</Txt>}
      {teams.map((team) => {
        const members = membersForTeam(data, team.id).filter((member) => {
          if (member.user_id === userId) return true;
          const rsvp = data.rsvps.find(
            (item) =>
              item.activity_id === activity.id &&
              item.user_id === member.user_id,
          );
          return !!(
            rsvp?.status === "going" &&
            (rsvp.approved ||
              !(activity.approval_required || activity.mode === "invite")) &&
            !data.blocks.some(
              (block) =>
                (block.blocker_id === member.user_id &&
                  block.blocked_id === activity.owner_id) ||
                (block.blocked_id === member.user_id &&
                  block.blocker_id === activity.owner_id),
            )
          );
        });
        const joined = members.some((member) => member.user_id === userId);
        const canJoin =
          !!userId &&
          !!enabledActivity &&
          canJoinTeam(
            data,
            enabledActivity,
            team.id,
            userId,
            enabledActivity.scoreboard_max_team_size ?? null,
          );
        return (
          <View key={team.id} style={[styles.card, { gap: 9, padding: 12 }]}>
            <View style={[styles.between, { alignItems: "center" }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h2}>{team.name}</Text>
                <Txt muted>
                  {teamOccupancyCount(data, team, activity)} member
                  {teamOccupancyCount(data, team, activity) === 1 ? "" : "s"}
                  {enabledActivity?.scoreboard_max_team_size != null
                    ? ` · max ${enabledActivity.scoreboard_max_team_size}`
                    : ""}
                </Txt>
              </View>
              <View style={[styles.row, { gap: 6 }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Subtract one point from ${team.name}`}
                  disabled={!manager || busy || team.score <= 0}
                  onPress={() =>
                    void run("adjust_beacon_team_score", {
                      team_id: team.id,
                      delta: -1,
                    })
                  }
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Minus
                    size={18}
                    color={
                      manager && team.score > 0 ? colors.green : colors.muted
                    }
                  />
                </Pressable>
                <Text
                  accessibilityLabel={`${team.name} score ${team.score}`}
                  style={[styles.h2, { minWidth: 32, textAlign: "center" }]}
                >
                  {team.score}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add one point to ${team.name}`}
                  disabled={!manager || busy}
                  onPress={() =>
                    void run("adjust_beacon_team_score", {
                      team_id: team.id,
                      delta: 1,
                    })
                  }
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus
                    size={18}
                    color={manager ? colors.green : colors.muted}
                  />
                </Pressable>
              </View>
            </View>
            {members.map((member) => {
              const profile = data.profiles.find(
                (item) => item.id === member.user_id,
              );
              const visible =
                profile && userId && canViewProfile(data, profile, userId);
              return (
                <View key={member.user_id} style={styles.row}>
                  <Txt>{visible ? profile.name : "Participant"}</Txt>
                  {member.user_id === userId && <Txt muted> · You</Txt>}
                </View>
              );
            })}
            {joined ? (
              <Button
                title="Leave team"
                secondary
                compact
                disabled={busy}
                onPress={() =>
                  void run("leave_beacon_team", { team_id: team.id })
                }
              />
            ) : (
              <Button
                title={canJoin ? "Join team" : "Team full or unavailable"}
                secondary
                compact
                disabled={!canJoin || busy}
                onPress={() =>
                  void run("join_beacon_team", { team_id: team.id })
                }
              />
            )}
            {manager &&
              (confirmRemove === team.id ? (
                <View style={[styles.row, { gap: 8 }]}>
                  <Button
                    title="Confirm remove team"
                    compact
                    disabled={busy}
                    onPress={async () => {
                      await run("remove_beacon_team", { team_id: team.id });
                      setConfirmRemove(null);
                    }}
                  />
                  <Button
                    title="Cancel"
                    secondary
                    compact
                    onPress={() => setConfirmRemove(null)}
                  />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${team.name}`}
                  onPress={() => setConfirmRemove(team.id)}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Trash size={17} color={colors.muted} />
                  <Txt muted>Remove team</Txt>
                </Pressable>
              ))}
          </View>
        );
      })}
      {manager && teams.length < MAX_BEACON_TEAMS && (
        <View style={[styles.card, { gap: 8, padding: 12 }]}>
          <Field
            label={`New team name (1–${MAX_TEAM_NAME_LENGTH})`}
            value={newTeam}
            onChangeText={(value) => {
              setNewTeam(value);
              setTeamDraftId(Crypto.randomUUID());
            }}
            maxLength={MAX_TEAM_NAME_LENGTH}
            placeholder="Team name"
          />
          <Button
            title="Create team"
            disabled={busy || !newTeam.trim()}
            onPress={() => void addTeam()}
          />
        </View>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
