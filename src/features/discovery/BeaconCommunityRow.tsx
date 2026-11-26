import { openCommunityProfile } from "@/src/features/social/communityNavigation";
import React, { createContext, useContext, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Sheet, useTheme } from "@/src/shared/ui";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import { performDirectoryAction } from "@/src/features/social/directoryActions";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import type { BeaconCommunityAssociation } from "./beaconCommunities";
import { useBeaconCommunities } from "./useBeaconCommunities";

const Communities = createContext<{
  rows: BeaconCommunityAssociation[];
  refresh: () => void;
} | null>(null);

export function useBeaconCommunityAssociations() {
  return useContext(Communities)?.rows ?? [];
}

export function BeaconCommunitiesProvider({
  activityIds = [],
  rows,
  onRefresh,
  children,
}: {
  activityIds?: readonly string[];
  rows?: BeaconCommunityAssociation[];
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const loaded = useBeaconCommunities(rows ? [] : activityIds);
  return (
    <Communities.Provider
      value={{
        rows: rows ?? loaded.rows,
        refresh: onRefresh ?? loaded.refresh,
      }}
    >
      {children}
    </Communities.Provider>
  );
}

export function CommunityMembershipAction({
  summary,
  onChanged,
  allowCancel = false,
}: {
  summary: SocialDirectorySummary;
  onChanged?: () => Promise<void> | void;
  allowCancel?: boolean;
}) {
  const { styles } = useTheme();
  const { current, run } = useCommunityMembership(summary, onChanged);
  if (
    current.action === "joined" ||
    (current.action === "requested" && !allowCancel)
  )
    return (
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {current.action === "joined" ? "Joined" : "Requested"}
      </Text>
    );
  if (current.action === "invite_required") return null;
  const title =
    current.action === "requested"
      ? "Cancel request"
      : current.action === "request"
        ? "Request to Join"
        : current.action === "invited"
          ? "Accept Invite"
          : "Join";
  return (
    <Action
      title={title}
      accessibilityLabel={`${title} ${communityTypeLabel(current.entity_type)} ${current.name}`}
      secondary
      compact
      run={run}
    />
  );
}

function useCommunityMembership(
  summary: SocialDirectorySummary,
  onChanged?: () => Promise<void> | void,
) {
  const { data, userId, loadCommunitySummary, getViewerEpoch, act } =
    useBeacon();
  const epoch = getViewerEpoch();
  const key = `${summary.entity_type}:${summary.entity_id}`;
  const [confirmed, setConfirmed] = useState<{
    key: string;
    viewerId: string;
    viewerEpoch: number;
    value: SocialDirectorySummary;
  } | null>(null);
  const current =
    confirmed?.key === key &&
    confirmed.viewerId === userId &&
    confirmed.viewerEpoch === epoch
      ? confirmed.value
      : summary;
  const busy = useRef(false);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    const actionEpoch = getViewerEpoch();
    const isCurrentViewer = () =>
      !!userId && data.viewer_id === userId && actionEpoch === getViewerEpoch();
    const clearConfirmed = () => {
      if (!isCurrentViewer()) return;
      setConfirmed((value) => (value?.key === key ? null : value));
    };
    try {
      const fresh = await loadCommunitySummary(
        summary.entity_type,
        summary.entity_id,
      );
      if (!userId || !isCurrentViewer())
        throw new Error(
          "This community is no longer available. Refresh to continue.",
        );
      if (!fresh) {
        clearConfirmed();
        await onChanged?.();
        throw new Error(
          "This community is no longer available. Refresh to continue.",
        );
      }

      const canAct =
        current.action === "requested"
          ? fresh.action === "requested"
          : fresh.action === "join" ||
            fresh.action === "request" ||
            fresh.action === "invited";
      if (canAct) await performDirectoryAction(fresh, data, userId, act);
      if (!isCurrentViewer()) return;

      const confirmedSummary = await loadCommunitySummary(
        summary.entity_type,
        summary.entity_id,
      );
      if (!isCurrentViewer()) return;
      if (!confirmedSummary) {
        clearConfirmed();
        await onChanged?.();
        throw new Error(
          "This community is no longer available. Refresh to continue.",
        );
      }
      setConfirmed({
        key,
        viewerId: userId,
        viewerEpoch: actionEpoch,
        value: confirmedSummary,
      });
      await onChanged?.();
    } finally {
      busy.current = false;
    }
  };

  return { current, run };
}

function CommunityIdentity({
  summary,
  onOpen,
  onChanged,
}: {
  summary: SocialDirectorySummary;
  onOpen: () => void;
  onChanged?: () => void;
}) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${communityTypeLabel(summary.entity_type)} ${summary.name}`}
        onPress={onOpen}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
        }}
      >
        <CommunityAvatar type={summary.entity_type} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.body} numberOfLines={1}>
            Associated with {summary.name}
          </Text>
          <Text style={styles.muted}>
            {communityTypeLabel(summary.entity_type)} · View
          </Text>
        </View>
      </Pressable>
      <View style={{ alignSelf: "flex-start" }}>
        <CommunityMembershipAction summary={summary} onChanged={onChanged} />
      </View>
    </View>
  );
}

/** A safe association enriches a card; an unavailable enrichment never hides it. */
export function BeaconCommunityRow({
  activityId,
  associations,
  inline = false,
}: {
  activityId: string;
  associations?: BeaconCommunityAssociation[];
  inline?: boolean;
}) {
  const inherited = useContext(Communities);
  const loaded = useBeaconCommunities(
    inherited || associations ? [] : [activityId],
  );
  const [relatedSelection, setRelatedSelection] = useState<string | null>(null);
  const { data, userId, viewerEpoch } = useBeacon();
  const { colors } = useTheme();
  const selectionKey = `${userId}:${viewerEpoch}:${activityId}`;
  const relatedOpen = relatedSelection === selectionKey;
  const source = associations ?? inherited?.rows ?? loaded.rows;
  const rows = source.filter((row) => row.activity_id === activityId);
  const refresh = inherited?.refresh ?? loaded.refresh;
  const primary = rows[0];
  if (!primary) return null;
  return (
    <View
      testID="beacon-community-row"
      style={{ gap: 4 }}
      key={`${userId}:${viewerEpoch}:${activityId}`}
    >
      {inline ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${communityTypeLabel(primary.summary.entity_type)} ${primary.summary.name}`}
            onPress={() => openCommunityProfile(primary.summary)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 44,
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <CommunityAvatar
              type={primary.summary.entity_type}
              iconKey={
                primary.summary.entity_type === "squad" &&
                userId &&
                data.viewer_id === userId
                  ? data.squads.find(
                      (squad) => squad.id === primary.summary.entity_id,
                    )?.icon_key
                  : undefined
              }
              size={20}
            />
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}
            >
              {primary.summary.name}
            </Text>
            <ChevronRight size={13} color={colors.muted} />
          </Pressable>
          {rows.length > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show Related Communities, ${rows.length - 1} more`}
              onPress={() => setRelatedSelection(selectionKey)}
              style={{
                minHeight: 44,
                minWidth: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                +{rows.length - 1}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <CommunityIdentity
          key={`${userId}:${viewerEpoch}:${primary.summary.entity_type}:${primary.summary.entity_id}`}
          summary={primary.summary}
          onOpen={() => openCommunityProfile(primary.summary)}
          onChanged={refresh}
        />
      )}
      {!inline && rows.length > 1 ? (
        <Button
          title="Related Communities"
          secondary
          compact
          onPress={() => setRelatedSelection(selectionKey)}
        />
      ) : null}
      <Sheet
        title="Related Communities"
        visible={relatedOpen}
        onClose={() => setRelatedSelection(null)}
      >
        {rows.slice(1).map(({ summary }) => (
          <CommunityIdentity
            key={`${summary.entity_type}:${summary.entity_id}`}
            summary={summary}
            onChanged={refresh}
            onOpen={() => {
              setRelatedSelection(null);
              openCommunityProfile(summary);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}
