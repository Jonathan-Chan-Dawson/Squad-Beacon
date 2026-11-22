import {
  BeaconCommunityRow,
  useBeaconCommunityAssociations,
} from "@/src/features/discovery/BeaconCommunityRow";
import { browseEntryReason } from "@/src/features/discovery/domain";
import { discoveryContextLabel } from "@/src/features/discovery/discoveryCardPresentation";
import { BeaconFeedCard } from "@/src/features/beacons/components/BeaconFeedCard";
import { activityFeedCardProps } from "@/src/features/beacons/screens/activityFeedCard";
import { readablePlanForActivity } from "@/src/features/beacons/screens/discoveryPlan";
import {
  canReadBeaconActivity,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { DiscoveryContextNote } from "@/src/features/discovery/DiscoveryContextNote";
import { router } from "expo-router";
import { shareBeaconInvitation } from "@/src/features/sharing/shareBeacon";
import React from "react";
import { View } from "react-native";
import { MapTooltipClose } from "./MapTooltipShell";
import type { MapContextFilter } from "./contextFilters";
import type { MapBeaconFeature } from "./mapBeaconFeatures";

export function MapTooltip({
  beaconId,
  onShowContext,
  onDetails,
  onOpenPeople,
  onMessage,
  onClose,
}: {
  onShowContext?: (filter: MapContextFilter) => void;
  beaconId: string | null;
  personId: string | null;
  pinned: boolean;
  onOpenPeople?: () => void;
  onPerson?: (id: string) => void;
  onDetails(): void;
  onFeature?: (feature: MapBeaconFeature) => void;
  onMessage(): void;
  onClose(): void;
}) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const communityAssociations = useBeaconCommunityAssociations();
  const activity = data.activities.find((row) => row.id === beaconId);
  if (
    !activity ||
    !userId ||
    data.viewer_id !== userId ||
    !canReadBeaconActivity(data, activity, userId)
  )
    return null;

  const community = communityAssociations.find(row => row.activity_id === activity.id && row.priority === 0)?.summary;
  const reason = browseEntryReason(
    { kind: "activity", activity },
    data,
    userId,
    now,
    communityAssociations,
  );
  const plan = readablePlanForActivity(data, activity, userId);
  const planContext = plan
    ? {
        title: plan.title,
        stepIndex: activity.plan_step_index,
        onShowOnMap: onShowContext
          ? () => onShowContext({ kind: "plan", id: plan.id })
          : undefined,
        onPress: () =>
          router.push({ pathname: "/plan/[id]", params: { id: plan.id } }),
      }
    : undefined;
  const feedProps = activityFeedCardProps(data, activity, userId, now, {
    onOpen: onDetails,
    onMap: onDetails,
    onRSVP: async (status) => {
      await act("rsvp", { id: activity.id, status });
    },
    onChangeRSVP: onDetails,
    onSave: async () => {
      await act("save_beacon", {
        activity_id: activity.id,
        saved: !data.beacon_favorites.some(
          (favorite) =>
            favorite.owner_id === userId &&
            favorite.activity_id === activity.id,
        ),
      });
    },
    onShare: async () => {
      await shareBeaconInvitation(data, userId, activity);
    },
  });
  const strictCapacityLabel =
    activity.capacity_policy === "strict" &&
    activity.capacity_limit != null &&
    activity.capacity_limit > 0 &&
    (feedProps.isFull || (feedProps.capacityRemaining ?? 0) > 0)
      ? feedProps.isFull
        ? "Full"
        : `${feedProps.capacityRemaining} spots left`
      : undefined;
  const visibleReason = discoveryContextLabel(reason, {
    timingLabel: feedProps.whenLabel,
    strictCapacityLabel,
    communityLabel: communityAssociations.some(
      (row) =>
        row.activity_id === activity.id &&
        row.summary.membership_status === "active",
    )
      ? "associated community"
      : undefined,
  });

  return (
    <View testID="map-tooltip-card">
      <BeaconFeedCard
        compact
        mapPreview
        mapIcon={activity.map_icon}
        mapCommunityName={community?.name}
        mapCommunityKey={community?.entity_id}
        mapCommunityType={community?.entity_type}
        presentation="discovery"
        adaptiveDiscovery
        detailsLabel="See overview"
        headerAccessory={
          <MapTooltipClose label="Close map preview" onClose={onClose} />
        }
        planContext={planContext}
        compactFooter={
          visibleReason ||
          communityAssociations.some(
            (row) => row.activity_id === activity.id,
          ) ? (
            <View style={{ gap: 4 }}>
              {visibleReason ? (
                <DiscoveryContextNote label={visibleReason} />
              ) : null}
              <BeaconCommunityRow activityId={activity.id} compact tooltip />
            </View>
          ) : null
        }
        {...feedProps}
        onMap={undefined}
        onChat={
          canUseBeaconModules(data, activity, userId) &&
          activity.enable_chat !== false
            ? onMessage
            : feedProps.onChat
        }
        onOpenPeople={onOpenPeople}
      />
    </View>
  );
}
