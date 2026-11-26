import {
  BeaconCommunityRow,
  useBeaconCommunityAssociations,
} from "./BeaconCommunityRow";
import { browseEntryReason } from "./domain";
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useAvailabilityNow } from "@/src/features/beacons/availabilityClock";
import { Button, useTheme } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/shared/design-system";
import { HomeAction } from "@/src/features/beacons/components/HomeAction";
import { beaconPreviewWhen } from "@/src/features/maps/discoveryRanking";
import { DiscoveryBeaconCard } from "./DiscoveryBeaconCard";
import { DiscoveryContextNote } from "./DiscoveryContextNote";
import { discoveryContextLabel } from "./discoveryCardPresentation";
import { mapIdentityColors } from "@/src/features/maps/markerIdentity";
import type { PublicBeaconSummary } from "./types";
import { requestSignIn } from "@/src/features/auth/navigation";

export type PublicBeaconPreviewProps = {
  summary: PublicBeaconSummary;
  adaptiveDiscovery?: boolean;
  mapPreview?: boolean;
  compact?: boolean;
  showCommunityIdentity?: boolean;
  contextLabel?: string;
  /** Accessible controls owned by a containing surface, such as Map close. */
  headerAccessory?: React.ReactNode;
  onClose(): void;
  onJoined(id: string): void;
  onDetails?: () => void;
  hideClose?: boolean;
};

type PublicResponse = "going" | "requested" | null;

export function PublicBeaconPreview({
  summary,
  mapPreview = false,
  compact = false,
  showCommunityIdentity = true,
  contextLabel,
  headerAccessory,
  onClose,
  onJoined,
  onDetails,
  hideClose = false,
}: PublicBeaconPreviewProps) {
  const { styles } = useTheme();
  const { colors } = useDesignTheme();
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useAvailabilityNow(Date.parse(summary.ends_at));
  const associations = useBeaconCommunityAssociations();
  const reason =
    contextLabel ??
    browseEntryReason(
      { kind: "public", summary },
      data,
      userId ?? "",
      now,
      associations,
    );
  const viewerKey = `${userId ?? ""}:${getViewerEpoch()}:${summary.activity_id}`;
  const [locallyConfirmed, setLocallyConfirmed] = useState<{
    key: string;
    response: Exclude<PublicResponse, null>;
  } | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");
  const latest = useRef({
    userId,
    activityId: summary.activity_id,
    viewerKey,
    act,
    getViewerEpoch,
    onJoined,
  });
  useEffect(() => {
    latest.current = {
      userId,
      activityId: summary.activity_id,
      viewerKey,
      act,
      getViewerEpoch,
      onJoined,
    };
  }, [userId, summary.activity_id, viewerKey, act, getViewerEpoch, onJoined]);

  const viewerSnapshotMatches = !!userId && data.viewer_id === userId;
  const currentRsvp = viewerSnapshotMatches
    ? data.rsvps.find(
        (row) =>
          row.activity_id === summary.activity_id && row.user_id === userId,
      )
    : undefined;
  const confirmedResponse =
    locallyConfirmed?.key === viewerKey ? locallyConfirmed.response : null;
  const serverGoing =
    viewerSnapshotMatches && summary.viewer_response === "going";
  const serverPending =
    viewerSnapshotMatches &&
    (summary.viewer_response === "requested" ||
      currentRsvp?.status === "requested");
  const going = confirmedResponse === "going" || serverGoing;
  const pending =
    !serverGoing && (confirmedResponse === "requested" || serverPending);
  const detailsAction =
    onDetails ?? (going ? () => onJoined(summary.activity_id) : undefined);
  const endTime = Date.parse(summary.ends_at);
  const startTime = Date.parse(summary.starts_at);
  const ended = Number.isFinite(endTime) && endTime <= now;
  const live =
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime <= now &&
    endTime > now;
  const full =
    summary.capacity_policy === "strict" &&
    Number.isFinite(summary.capacity_limit) &&
    summary.capacity_limit !== null &&
    summary.capacity_limit > 0 &&
    summary.accepted_seat_count >= summary.capacity_limit;
  const adaptiveWhenLabel = ended
    ? "Ended"
    : beaconPreviewWhen({ ...summary, timezone: "" }, now);
  const strictCapacityLabel =
    summary.capacity_policy === "strict" &&
    Number.isFinite(summary.capacity_limit) &&
    summary.capacity_limit !== null &&
    summary.capacity_limit > 0
      ? full
        ? "Full"
        : (() => {
            const remaining =
              Math.floor(summary.capacity_limit) -
              Math.floor(summary.accepted_seat_count);
            return remaining > 0 ? `${remaining} spots left` : "Full";
          })()
      : null;
  const visibleCommunity = associations.find(
    (row) => row.activity_id === summary.activity_id,
  )?.summary.name;
  const visibleContextLabel = discoveryContextLabel(reason, {
    timingLabel: adaptiveWhenLabel,
    strictCapacityLabel,
    communityLabel:
      showCommunityIdentity && visibleCommunity ? visibleCommunity : null,
  });
  const closed = summary.closed || ended;
  const busy = submittingKey === viewerKey;
  const actionLabel = busy
    ? "Joining…"
    : pending
      ? "Requested ✓"
      : going
        ? "Going ✓"
        : ended
          ? "Ended"
          : closed
            ? full
              ? "Full"
              : "Closed"
            : summary.requires_approval
              ? "Request to Join"
              : "Join";
  const disabled =
    busy ||
    pending ||
    going ||
    closed ||
    !Number.isFinite(endTime) ||
    endTime <= now;

  const joinPublicBeacon = async () => {
    if (disabled) return;
    if (!userId) {
      requestSignIn(`/discover/${summary.activity_id}`);
      return;
    }
    const key = viewerKey;
    const activityId = summary.activity_id;
    const viewerId = userId;
    const epoch = getViewerEpoch();
    setJoinError("");
    setSubmittingKey(key);
    try {
      const result = await act("join_public_beacon", {
        activity_id: activityId,
      });
      const current = latest.current;
      if (
        current.userId !== viewerId ||
        current.activityId !== activityId ||
        current.viewerKey !== key ||
        current.getViewerEpoch() !== epoch
      )
        return;
      if (result.status === "requested") {
        setLocallyConfirmed({ key, response: "requested" });
      } else {
        setLocallyConfirmed({ key, response: "going" });
        current.onJoined(activityId);
      }
    } catch (failure) {
      const current = latest.current;
      if (
        current.userId === viewerId &&
        current.activityId === activityId &&
        current.viewerKey === key &&
        current.getViewerEpoch() === epoch
      )
        setJoinError(
          failure instanceof Error && failure.message.trim()
            ? failure.message
            : "Could not join this Beacon. Try again.",
        );
    } finally {
      setSubmittingKey((currentKey) =>
        currentKey === key ? null : currentKey,
      );
    }
  };

  return (
    <View testID="map-public-preview" style={{ gap: 8 }}>
      <DiscoveryBeaconCard
        mapPreview={mapPreview}
        density={mapPreview ? "compact" : "standard"}
        relationshipColor={summary.viewer_response === "going" ? mapIdentityColors.joined : mapIdentityColors.other}
        mapIcon={summary.map_icon}
        activityId={summary.activity_id}
        title={summary.title}
        category={summary.category}
        whenLabel={adaptiveWhenLabel}
        isLive={live}
        locationLabel={
          summary.area_label.trim()
            ? `${summary.area_label.trim()} · approximate area`
            : "Approximate area"
        }
        goingCount={summary.accepted_seat_count}
        capacity={{
          limit: summary.capacity_limit,
          strict: summary.capacity_policy === "strict",
          full,
        }}
        headerAccessory={headerAccessory}
        primaryAction={
          ended ? null : (
            <HomeAction
              title={going && detailsAction ? "Open Beacon" : actionLabel}
              label={going && detailsAction ? "Open Beacon" : actionLabel}
              stretch
              prominent={mapPreview}
              primary={!disabled}
              disabled={disabled && !(going && detailsAction)}
              onPress={
                going && detailsAction
                  ? detailsAction
                  : () => void joinPublicBeacon()
              }
            />
          )
        }
        onDetails={detailsAction}
        context={
          visibleContextLabel || !compact ? (
            <View style={{ gap: 2 }}>
              {visibleContextLabel ? (
                <DiscoveryContextNote label={visibleContextLabel} />
              ) : null}
              {!compact ? (
                <Text style={styles.muted}>
                  {pending
                    ? "The host will review your request."
                    : going
                      ? "You’re going to this Beacon."
                      : "Join to see the meeting details and people going."}
                </Text>
              ) : null}
            </View>
          ) : null
        }
        communityContext={
          showCommunityIdentity ? (
            <BeaconCommunityRow activityId={summary.activity_id} inline />
          ) : null
        }
        feedback={
          joinError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}
            >
              {joinError}
            </Text>
          ) : null
        }
      />
      {!compact && !hideClose ? (
        <Button title="Close preview" secondary compact onPress={onClose} />
      ) : null}
    </View>
  );
}
