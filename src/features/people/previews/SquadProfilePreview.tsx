import React, { useId, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { CalendarDays, CircleHelp, Radio, UserPlus } from "lucide-react-native";
import { SocialCommunityInlinePreview } from "./SocialCommunityInlinePreview";
import {
  BeaconProfilePreview,
  ProfilePreviewFrame,
} from "./ProfilePreviewFrame";
import {
  activeSquadMembership,
  canOpenSquadProfile,
  squadCurrentAndNextActivities,
  squadSizeLabel,
  visibleSquadMembers,
  visibleSquadOrganization,
} from "@/src/features/people/squadProfile";
import {
  activeOrganizationRole,
  canReadOrganization,
} from "@/src/features/organizations/domain";
import {
  selectSquadChatPings,
  visibleSquadPingResponses,
} from "@/src/features/organizations/squadChat";
import { visibleSquadSpace } from "@/src/features/spaces/domain";
import { canInviteWithPolicy } from "@/src/features/social/domain";
import { canRespondToPlanningThread } from "@/src/features/planning/domain";
import type { SocialEntityType } from "@/src/features/social/types";
import { PlanningResponseCard } from "@/src/features/people/components/PlanningResponseCard";
import {
  CommunityBreadcrumb,
  CompactBeaconCard,
  CompactQuickAction,
} from "@/src/features/people/components/CompactCommunityParts";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Empty, useTheme } from "@/src/shared/ui";

export interface SquadProfilePreviewProps {
  squadId: string;
  visible: boolean;
  onClose: () => void;
  inChat?: boolean;
}

/** Compact preview with live canonical access checks at every hierarchy level. */
export function SquadProfilePreview({
  squadId,
  visible,
  onClose,
  inChat = false,
}: SquadProfilePreviewProps) {
  const pingSeed = useId();
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [selectedCommunity, setSelectedCommunity] = useState<{
    type: SocialEntityType;
    id: string;
  } | null>(null);
  const closePreview = () => {
    setSelectedCommunity(null);
    onClose();
  };
  const authorized = canOpenSquadProfile(data, squadId, userId);
  const squad = authorized
    ? data.squads.find((item) => item.id === squadId)
    : undefined;
  const membership = activeSquadMembership(data, squadId, userId);
  const role =
    squad?.owner_id === userId ? "owner" : (membership?.role ?? null);
  const canInvite = !!squad && canInviteWithPolicy(role, squad.invite_policy);
  const members =
    authorized && userId ? visibleSquadMembers(data, squadId, userId) : [];
  const space = visibleSquadSpace(data, squadId, userId);
  // An Organization ? Space arrow is shown only for that Space's actual readable parent.
  const organization =
    space && userId
      ? data.organization_spaces
          .filter((link) => link.space_id === space.id)
          .map((link) =>
            data.organizations.find((item) => item.id === link.organization_id),
          )
          .find(
            (item) =>
              !!item &&
              canReadOrganization(data, item.id, userId) &&
              activeOrganizationRole(item, data.organization_members, userId),
          )
      : visibleSquadOrganization(data, squadId, userId);
  const activities =
    squad && userId
      ? squadCurrentAndNextActivities(data, squadId, userId, now)
      : { current: undefined, next: undefined };
  const ping =
    squad && userId
      ? selectSquadChatPings(data, squadId, userId)
          .filter(
            (thread) =>
              thread.status === "open" && Date.parse(thread.deadline_at) > now,
          )
          .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at))[0]
      : undefined;
  const responses =
    ping && userId ? visibleSquadPingResponses(data, ping, userId) : [];
  const selected = responses.find(
    (response) => response.user_id === userId,
  )?.response;
  function openRoute(navigate: () => void) {
    closePreview();
    setTimeout(navigate, 320);
  }
  function openFullProfile(
    type: SocialEntityType,
    id: string,
    tab?: "squads" | "activity" | "chat",
  ) {
    openRoute(() => {
      if (type === "organization")
        router.push({
          pathname: "/organization/[id]",
          params: { id, ...(tab ? { tab } : {}) },
        });
      else if (type === "space")
        router.push({
          pathname: "/space/[id]",
          params: { id, ...(tab ? { tab } : {}) },
        });
      else if (tab === "chat")
        router.push({ pathname: "/squad-chat/[id]", params: { id } });
      else
        router.push({
          pathname: "/squad/[id]",
          params: { id, ...(tab === "activity" ? { tab: "Activity" } : {}) },
        });
    });
  }

  return (
    <ProfilePreviewFrame
      key={`${squadId}:${authorized}:${visible}`}
      visible={visible}
      onClose={closePreview}
      title={squad ? "About this Squad" : "Squad preview"}
      renderBeaconPreview={(beaconId, onBack) => (
        <BeaconProfilePreview
          beaconId={beaconId}
          onBack={onBack}
          backLabel={selectedCommunity ? "Back to preview" : "Back to Squad"}
          onOpenFullBeacon={(id) =>
            openRoute(() =>
              router.push({ pathname: "/activity/[id]", params: { id } }),
            )
          }
        />
      )}
    >
      {(openBeacon) =>
        selectedCommunity ? (
          <SocialCommunityInlinePreview
            key={`${selectedCommunity.type}:${selectedCommunity.id}`}
            entityType={selectedCommunity.type}
            entityId={selectedCommunity.id}
            onBack={() => setSelectedCommunity(null)}
            backLabel="Back to Squad"
            onOpenBeacon={openBeacon}
            onOpenFullProfile={openFullProfile}
          />
        ) : !squad || !userId ? (
          <Empty
            title="Squad unavailable"
            body="Only current Squad members can open this profile."
          />
        ) : (
          <View style={{ gap: 14 }}>
            <View style={styles.row}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: colors.lime,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[styles.h2, { color: colors.green }]}>
                  {squad.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.h2} numberOfLines={1}>
                  {squad.name}
                </Text>
                <Text style={styles.muted}>
                  {members.length} {members.length === 1 ? "member" : "members"}{" "}
                  · {squadSizeLabel(members.length)}
                </Text>
              </View>
            </View>
            <CommunityBreadcrumb
              items={[
                ...(organization
                  ? [
                      {
                        id: organization.id,
                        label: organization.name,
                        onPress: () =>
                          setSelectedCommunity({
                            type: "organization",
                            id: organization.id,
                          }),
                      },
                    ]
                  : []),
                ...(space
                  ? [
                      {
                        id: space.id,
                        label: space.name,
                        onPress: () =>
                          setSelectedCommunity({ type: "space", id: space.id }),
                      },
                    ]
                  : []),
                {
                  id: squad.id,
                  label: squad.name,
                  onPress: () => openFullProfile("squad", squad.id),
                },
              ]}
            />
            {membership ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 5,
                  alignItems: "flex-start",
                }}
              >
                <CompactQuickAction
                  title="Ping"
                  icon={CircleHelp}
                  onPress={() =>
                    openRoute(() =>
                      router.push({
                        pathname: "/councils",
                        params: { squadId, newPing: "yes", pingSeed },
                      }),
                    )
                  }
                />
                <CompactQuickAction
                  title="Create Beacon"
                  icon={Radio}
                  onPress={() =>
                    openRoute(() =>
                      router.push({
                        pathname: "/create",
                        params: { kind: "squad", squadId },
                      }),
                    )
                  }
                />
                <CompactQuickAction
                  title="Plans"
                  icon={CalendarDays}
                  onPress={() =>
                    openRoute(() =>
                      router.push({ pathname: "/plans", params: { squadId } }),
                    )
                  }
                />
                {canInvite ? (
                  <CompactQuickAction
                    title="Invite"
                    icon={UserPlus}
                    onPress={() =>
                      openRoute(() =>
                        router.push({
                          pathname: "/squad/[id]",
                          params: { id: squadId, tab: "members" },
                        }),
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}
            {activities.current ? (
              <CompactBeaconCard
                activity={activities.current}
                label="Current Beacon"
                live
                testID="squad-preview-current-beacon-row"
                onPress={() => openBeacon(activities.current!.id)}
              />
            ) : null}
            {activities.next ? (
              <CompactBeaconCard
                activity={activities.next}
                label="Up Next"
                testID="squad-preview-next-beacon-row"
                onPress={() => openBeacon(activities.next!.id)}
              />
            ) : null}
            {ping ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Active Ping</Text>
                <PlanningResponseCard
                  id={ping.id}
                  kind="ping"
                  title={ping.title}
                  sourceLabel={squad.name}
                  deadline={ping.deadline_at}
                  counts={[
                    {
                      label: "Interested",
                      value: responses.filter(
                        (response) => response.response === "interested",
                      ).length,
                    },
                    {
                      label: "Maybe",
                      value: responses.filter(
                        (response) => response.response === "maybe",
                      ).length,
                    },
                  ]}
                  selected={selected}
                  disabled={ping.owner_id === userId}
                  onOpen={() =>
                    openRoute(() =>
                      router.push({
                        pathname: "/council/[id]",
                        params: { id: ping.id },
                      }),
                    )
                  }
                  onRespond={async (response) => {
                    if (
                      !userId ||
                      data.viewer_id !== userId ||
                      !canOpenSquadProfile(data, squadId, userId) ||
                      !canRespondToPlanningThread(data, ping, userId) ||
                      ping.owner_id === userId
                    )
                      throw new Error("This Ping is unavailable.");
                    await act("respond_planning_ping", {
                      thread_id: ping.id,
                      response,
                      auto_rsvp: false,
                    });
                    return true;
                  }}
                />
              </View>
            ) : null}
            {!inChat ? (
              <Button
                title="Open Squad chat"
                onPress={() => openFullProfile("squad", squadId, "chat")}
              />
            ) : null}
            <Button
              secondary
              title="View full Squad profile"
              onPress={() => openFullProfile("squad", squadId)}
            />
          </View>
        )
      }
    </ProfilePreviewFrame>
  );
}

export const CompactSquadProfilePreview = SquadProfilePreview;
