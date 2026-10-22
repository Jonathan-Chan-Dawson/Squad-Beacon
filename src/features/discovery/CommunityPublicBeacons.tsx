import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type { SocialEntityType } from "@/src/features/social/types";
import { ProfileSection } from "@/src/features/people/components/ProfilePrimitives";
import { Button, Empty, Txt } from "@/src/shared/ui";
import { BeaconCommunitiesProvider } from "./BeaconCommunityRow";
import { PublicBeaconPreview } from "./PublicBeaconPreview";
import { useCommunityPublicBeacons } from "./useCommunityPublicBeacons";

/** Compact, scoped public Beacon cards for a community profile. */
export function CommunityPublicBeacons({
  type,
  entityId,
  excludeActivityIds = [],
}: {
  type: SocialEntityType;
  entityId: string;
  excludeActivityIds?: readonly string[];
}) {
  const result = useCommunityPublicBeacons(type, entityId);
  const excluded = new Set(excludeActivityIds);
  const rows = result.rows.filter((row) => !excluded.has(row.activity_id));

  if (!result.ready) {
    return (
      <ProfileSection title="Public Beacons">
        <Txt muted>Loading public Beacons...</Txt>
      </ProfileSection>
    );
  }

  if (result.error) {
    return (
      <ProfileSection title="Public Beacons">
        <Empty
          title="Public Beacons are unavailable"
          body="Try loading this community’s public Beacons again."
        />
        <Button title="Try again" secondary compact onPress={result.refresh} />
      </ProfileSection>
    );
  }

  if (!rows.length && !result.hasMore) return null;

  return (
    <ProfileSection title="Public Beacons">
      {rows.length ? (
        <BeaconCommunitiesProvider
          activityIds={rows.map((row) => row.activity_id)}
        >
          <View style={{ gap: 10 }}>
            {rows.map((summary) => (
              <PublicBeaconPreview
                key={summary.activity_id}
                summary={summary}
                compact
                showCommunityIdentity={false}
                onClose={() => {}}
                onJoined={(id) => {
                  result.refresh();
                  router.push({ pathname: "/activity/[id]", params: { id } });
                }}
              />
            ))}
          </View>
        </BeaconCommunitiesProvider>
      ) : (
        <Txt muted>Loading more public Beacons...</Txt>
      )}
      {result.loadingMoreError ? (
        <Txt muted>More public Beacons could not load. Try again.</Txt>
      ) : null}
      {result.hasMore ? (
        <Button
          title={
            result.loadingMore
              ? "Loading..."
              : result.loadingMoreError
                ? "Try again"
                : "Load more"
          }
          secondary
          compact
          disabled={result.loadingMore}
          onPress={() => void result.loadMore()}
        />
      ) : null}
    </ProfileSection>
  );
}
