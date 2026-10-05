import React, { useId, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight, CircleHelp, Vote } from "lucide-react-native";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { SocialCommunityInlinePreview } from "@/src/features/people/previews/SocialCommunityInlinePreview";
import type { SocialEntityType } from "@/src/features/social/types";
import { canInviteWithPolicy } from "@/src/features/social/domain";
import {
  BeaconProfilePreview,
  ProfilePreviewFrame,
} from "@/src/features/people/previews/ProfilePreviewFrame";
import {
  activeSquadDecision,
  canOpenSquadProfile,
  squadCurrentAndNextActivities,
  squadPlans,
  squadSizeLabel,
  visibleSquadMembers,
  visibleSquadOrganization,
} from "@/src/features/people/squadProfile";
import { useBeacon } from "@/src/shared/store";
import { Avatar, Button, Empty, Txt, useTheme } from "@/src/shared/ui";
import { visibleSquadSpace } from "@/src/features/spaces/domain";

export function SquadProfilePreview({
  squadId,
  visible,
  onClose,
  inChat = false,
}: {
  squadId: string;
  visible: boolean;
  onClose: () => void;
  inChat?: boolean;
}) {
  const pingSeed = useId();
  const [selectedCommunity, setSelectedCommunity] = useState<{
    type: SocialEntityType;
    id: string;
  } | null>(null);
  const closePreview = () => {
    setSelectedCommunity(null);
    onClose();
  };
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const authorized = canOpenSquadProfile(data, squadId, userId);
  const squad = authorized
    ? data.squads.find((item) => item.id === squadId)
    : undefined;
  const role = data.squad_members.find(
    (member) => member.squad_id === squadId && member.user_id === userId,
  )?.role;
  const canInvite = !!squad && canInviteWithPolicy(role ?? null, squad.invite_policy);
  const members = authorized
    ? visibleSquadMembers(data, squadId, userId ?? "")
    : [];
  const organization = visibleSquadOrganization(data, squadId, userId);
  const space = visibleSquadSpace(data, squadId, userId);
  const activities = squad && userId
    ? squadCurrentAndNextActivities(data, squadId, userId)
    : { current: undefined, next: undefined };
  const plan = squad && userId ? squadPlans(data, squadId, userId)[0] : undefined;
  const decision = squad && userId
    ? activeSquadDecision(data, squadId, userId)
    : undefined;

  function openRoute(path: "/create" | "/plans" | "/councils" | "/squad/[id]", params: Record<string, string>) {
    closePreview();
    setTimeout(() => router.push({ pathname: path, params }), 320);
  }

  return (
    <ProfilePreviewFrame
      key={`${squadId}:${authorized ? "active-member" : "unavailable"}:${visible ? "open" : "closed"}`}
      visible={visible}
      onClose={closePreview}
      title={squad ? "About this Squad" : "Squad preview"}
      renderBeaconPreview={(beaconId, onBack) => {
        const beacon = data.activities.find(
          (activity) =>
            activity.id === beaconId &&
            !!userId &&
            canReadBeaconActivity(data, activity, userId),
        );
        if (!beacon)
          return (
            <View style={{ gap: 12 }}>
              <Empty
                title="Beacon unavailable"
                body="It may have ended or your access may have changed."
              />
              <Button title="Back to Squad" secondary onPress={onBack} />
            </View>
          );
        return (
          <BeaconProfilePreview
            beaconId={beacon.id}
            onBack={onBack}
            backLabel={selectedCommunity ? "Back to preview" : "Back to Squad"}
            onOpenFullBeacon={(id) => {
              closePreview();
              setTimeout(
                () => router.push({ pathname: "/activity/[id]", params: { id } }),
                320,
              );
            }}
          />
        );
      }}
    >
      {(openBeacon) => {
        if (selectedCommunity) {
          return (
            <SocialCommunityInlinePreview
              key={`${selectedCommunity.type}:${selectedCommunity.id}`}
              entityType={selectedCommunity.type}
              entityId={selectedCommunity.id}
              onBack={() => setSelectedCommunity(null)}
              backLabel="Back to Squad"
              onOpenBeacon={openBeacon}
              onOpenFullProfile={(type, id, tab) => {
              closePreview();
                setTimeout(() => {
                  if (type === "organization")
                    router.push({ pathname: "/organization/[id]", params: { id, ...(tab === "activity" ? { tab: "activity" } : {}) } });
                  else if (type === "space")
                    router.push({ pathname: "/space/[id]", params: { id, ...(tab ? { tab } : {}) } });
                  else if (tab === "chat")
                    router.push({ pathname: "/squad-chat/[id]", params: { id } });
                  else
                    router.push({ pathname: "/squad/[id]", params: { id, ...(tab === "activity" ? { tab: "Activity" } : {}) } });
                }, 320);
              }}
            />
          );
        }
        if (!squad || !userId)
          return (
            <Empty
              title="Squad unavailable"
              body="Only current Squad members can open this profile."
            />
          );
        const beacons = [activities.current, activities.next].filter(
          (activity, index, all) =>
            !!activity && all.findIndex((item) => item?.id === activity.id) === index,
        );
        return (
          <View style={{ gap: 14 }}>
            <View style={styles.row}>
              <Avatar name={squad.name} size={52} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.h2} numberOfLines={1}>{squad.name}</Text>
                <Text style={styles.muted}>
                  {members.length} {members.length === 1 ? "member" : "members"} · {squadSizeLabel(members.length)}
                </Text>
              </View>
            </View>
            {squad.description ? <Txt>{squad.description}</Txt> : <Txt muted>Invite-only Squad</Txt>}

            <View style={styles.row} accessibilityLabel="Squad members">
              {members.slice(0, 5).map(({ member, profile }) => (
                <ProfileAvatar
                  key={member.user_id}
                  profile={profile}
                  size={34}
                />
              ))}
              <Text style={styles.muted}>
                {members.length} {members.length === 1 ? "member" : "members"}
              </Text>
            </View>

            {organization ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Preview Organization ${organization.name}`}
                onPress={() => setSelectedCommunity({ type: "organization", id: organization.id })}
                style={[
                  styles.row,
                  {
                    minHeight: 42,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>ORGANIZATION</Text>
              <Text style={styles.body} numberOfLines={1}>{organization.name}</Text>
                </View>
                <ArrowUpRight size={18} color={colors.green} />
              </Pressable>
            ) : null}
            {space ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Preview Space ${space.name}`}
                onPress={() => setSelectedCommunity({ type: "space", id: space.id })}
                style={[
                  styles.row,
                  {
                    minHeight: 42,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.label}>CONNECTED SPACE</Text>
                  <Text style={styles.body} numberOfLines={1}>{space.name}</Text>
                </View>
                <ArrowUpRight size={18} color={colors.green} />
              </Pressable>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ width: "48%" }}>
              <Button
                compact
                title="Ping"
                onPress={() =>
                  openRoute("/councils", {
                    squadId,
                    newPing: "yes",
                    pingSeed,
                  })
                }
              />
              </View>
              <View style={{ width: "48%" }}>
              <Button
                compact
                secondary
                title="Create Beacon"
                onPress={() =>
                  openRoute("/create", { kind: "squad", squadId })
                }
              />
              </View>
              <View style={{ width: "48%" }}>
              <Button
                compact
                secondary
                title="Plans"
                onPress={() => openRoute("/plans", { squadId })}
              />
              </View>
              {canInvite ? (
                <View style={{ width: "48%" }}>
                  <Button
                    compact
                    secondary
                    title="Invite"
                    onPress={() =>
                      openRoute("/squad/[id]", { id: squadId, tab: "members" })
                    }
                  />
                </View>
              ) : null}
            </View>

            <Button
              secondary
              title="View full Squad Profile"
              onPress={() => {
                closePreview();
                setTimeout(
                  () => router.push({ pathname: "/squad/[id]", params: { id: squadId } }),
                  320,
                );
              }}
            />

            {beacons.map((beacon) => {
              if (!beacon) return null;
              const current = activities.current?.id === beacon.id;
              return (
                <Pressable
                  key={beacon.id}
                  accessibilityRole="button"
                  testID={current ? "squad-preview-current-beacon-row" : "squad-preview-next-beacon-row"}
                  accessibilityLabel={`${current ? "Current" : "Next"} Beacon: ${beacon.title}`}
                  accessibilityHint="Opens a Beacon preview"
                  onPress={() => openBeacon(beacon.id)}
                  style={{
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                    paddingHorizontal: 7,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={styles.label}>
                      {current ? "CURRENT BEACON" : "UP NEXT"}
                    </Text>
                    <Text style={[styles.body, { fontWeight: "700" }]} numberOfLines={1}>
                      {beacon.title}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {new Date(beacon.starts_at).toLocaleString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <ArrowUpRight size={17} color={colors.green} />
                </Pressable>
              );
            })}

            {plan ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open Beacon Plan ${plan.plan.title}`}
                onPress={() => {
                  closePreview();
                  setTimeout(
                    () =>
                      router.push({
                        pathname: "/plan/[id]",
                        params: { id: plan.plan.id },
                      }),
                    320,
                  );
                }}
                style={[styles.card, { gap: 4 }]}
              >
                <Text style={styles.label}>BEACON PLAN</Text>
                <Text style={styles.body}>{plan.plan.title}</Text>
                <Text style={styles.muted}>
                  {plan.routine
                    ? `Routine · next ${plan.routine.next_occurrence_on ?? "date to be set"}`
                    : `Starts ${plan.plan.start_date}`}
                </Text>
              </Pressable>
            ) : null}

            {decision ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${decision.kind === "ping" ? "Ping" : "Vote"}: ${decision.title}`}
                onPress={() => {
                  closePreview();
                  setTimeout(
                    () => router.push({ pathname: "/council/[id]", params: { id: decision.id } }),
                    320,
                  );
                }}
                style={[styles.card, styles.row]}
              >
                {decision.kind === "ping" ? (
                  <CircleHelp size={19} color={colors.green} />
                ) : (
                  <Vote size={19} color={colors.green} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.label}>ACTIVE {decision.kind.toUpperCase()}</Text>
                  <Text style={styles.body} numberOfLines={2}>{decision.title}</Text>
                </View>
                <ArrowUpRight size={18} color={colors.green} />
              </Pressable>
            ) : null}

            {!inChat ? (
              <Button
                compact
                secondary
                title="Open Squad chat"
                onPress={() => {
                  closePreview();
                  setTimeout(
                    () => router.push({ pathname: "/squad-chat/[id]", params: { id: squadId } }),
                    320,
                  );
                }}
              />
            ) : null}
          </View>
        );
      }}
    </ProfilePreviewFrame>
  );
}
