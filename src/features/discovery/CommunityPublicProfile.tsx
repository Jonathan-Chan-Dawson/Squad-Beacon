import { openCommunityProfile } from "@/src/features/social/communityNavigation";
import React from "react";
import { Text, View } from "react-native";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import { ProfileSection } from "@/src/features/people/components/ProfilePrimitives";
import { CommunityMembershipAction } from "./BeaconCommunityRow";
import { CommunityPublicBeacons } from "./CommunityPublicBeacons";
import { CommunityPublicRelatedCommunities } from "./CommunityPublicRelatedCommunities";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import { RelationshipDisclosure } from "@/src/features/social/CommunityProfileAccess";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import { Txt, useTheme } from "@/src/shared/ui";

/** A profile built exclusively from the safe summary returned by the directory RPC. */
export function CommunityPublicProfile({
  summary,
  onSummaryChanged,
}: {
  summary: SocialDirectorySummary;
  onSummaryChanged?: () => Promise<void> | void;
}) {
  const { styles } = useTheme();
  const parentContext =
    summary.parent_type && summary.parent_id
      ? [{ parentType: summary.parent_type, parentId: summary.parent_id }]
      : [];

  return (
    <View style={{ gap: 12 }} testID="community-public-profile">
      <View style={[styles.row, { gap: 12 }]}>
        <CommunityAvatar type={summary.entity_type} size={52} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={styles.h2}>{summary.name}</Text>
          <Txt muted>
            {communityTypeLabel(summary.entity_type)} · {summary.member_count}{" "}
            {summary.member_count === 1 ? "member" : "members"}
          </Txt>
          <Txt muted>
            {summary.discoverability === "public"
              ? "Public"
              : summary.discoverability === "private"
                ? "Private"
                : "Community-only"}{" "}
            ·{" "}
            {summary.join_mode === "open"
              ? "Open to join"
              : summary.join_mode === "request"
                ? "Request to join"
                : "Invitation required"}
          </Txt>
        </View>
      </View>
      <CommunityMembershipAction
        summary={summary}
        onChanged={onSummaryChanged}
        allowCancel
      />

      {summary.description.trim() ? (
        <ProfileSection title="About">
          <Txt>{summary.description}</Txt>
        </ProfileSection>
      ) : null}

      {summary.entity_type !== "squad" ? (
        <ProfileSection title="Visible connections">
          <Txt muted>
            {summary.child_count} visible linked{" "}
            {summary.child_count === 1 ? "community" : "communities"}
          </Txt>
        </ProfileSection>
      ) : null}

      {summary.entity_type !== "squad" ? (
        <CommunityPublicRelatedCommunities summary={summary} />
      ) : null}

      {parentContext.length ? (
        <RelationshipDisclosure
          contexts={parentContext}
          current={{ type: summary.entity_type, id: summary.entity_id }}
          entityType="all"
          title="Related communities"
          onOpen={openCommunityProfile}
        />
      ) : null}

      <CommunityPublicBeacons
        type={summary.entity_type}
        entityId={summary.entity_id}
      />
    </View>
  );
}
