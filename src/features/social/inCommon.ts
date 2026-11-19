import type { Activity, Data, Profile, SquadIconKey } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import type { SocialEntityType } from "./types";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  canOpenSquadProfile,
  visibleSquadMembers,
} from "@/src/features/people/squadProfile";
import { activeSpaceRole, canReadSpace } from "@/src/features/spaces/domain";
import {
  activeOrganizationRole,
  canReadOrganizationMembers,
} from "@/src/features/organizations/domain";
export type CommonItem = { id: string; name: string; detail: string } & (
  | { kind: "person"; profile: Profile }
  | { kind: "community"; entityType: SocialEntityType; iconKey?: SquadIconKey }
  | { kind: "beacon"; activity: Activity }
);
export type CommonGroup = { id: string; title: string; items: CommonItem[] };
/** Conservative overlap: current authorized members only, never directory/invitation inference. */
export function selectCommunityInCommon(
  data: Data,
  viewerId: string | null,
  type: SocialEntityType,
  id: string,
): CommonGroup[] {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const blocked = (personId: string) =>
    data.blocks.some(
      (b) =>
        (b.blocker_id === viewerId && b.blocked_id === personId) ||
        (b.blocker_id === personId && b.blocked_id === viewerId),
    );
  const spaceMember = (spaceId: string, personId: string) => {
    const space = data.spaces.find((s) => s.id === spaceId);
    return (
      !!space &&
      !space.archived_at &&
      canReadSpace(data, spaceId, viewerId) &&
      !!activeSpaceRole(space, data.space_members, personId) &&
      !data.space_bans.some(
        (b) => b.space_id === spaceId && b.user_id === personId,
      ) &&
      !data.blocks.some(
        (b) =>
          (b.blocker_id === space.owner_id && b.blocked_id === personId) ||
          (b.blocker_id === personId && b.blocked_id === space.owner_id),
      )
    );
  };
  const networkMember = (networkId: string, personId: string) => {
    const network = data.organizations.find((n) => n.id === networkId);
    return (
      !!network &&
      !network.archived_at &&
      canReadOrganizationMembers(data, networkId, viewerId) &&
      !!activeOrganizationRole(network, data.organization_members, personId) &&
      !data.organization_bans.some(
        (b) => b.organization_id === networkId && b.user_id === personId,
      ) &&
      !data.blocks.some(
        (b) =>
          (b.blocker_id === network.owner_id && b.blocked_id === personId) ||
          (b.blocker_id === personId && b.blocked_id === network.owner_id),
      )
    );
  };
  const targetVisible =
    type === "squad"
      ? canOpenSquadProfile(data, id, viewerId)
      : type === "space"
        ? spaceMember(id, viewerId)
        : networkMember(id, viewerId);
  if (!targetVisible) return [];
  const squadMembers =
    type === "squad"
      ? new Set(
          visibleSquadMembers(data, id, viewerId).map((r) => r.member.user_id),
        )
      : null;
  const friends = new Set(friendIds(data, viewerId));
  const people: CommonItem[] = data.profiles
    .filter(
      (p) =>
        p.id !== viewerId &&
        friends.has(p.id) &&
        !blocked(p.id) &&
        canViewProfile(data, p, viewerId) &&
        (type === "squad"
          ? squadMembers!.has(p.id) &&
            !data.squad_bans.some(
              (b) => b.squad_id === id && b.user_id === p.id,
            ) &&
            !data.blocks.some((b) => {
              const owner = data.squads.find((s) => s.id === id)?.owner_id;
              return (
                (b.blocker_id === owner && b.blocked_id === p.id) ||
                (b.blocker_id === p.id && b.blocked_id === owner)
              );
            })
          : type === "space"
            ? spaceMember(id, p.id)
            : networkMember(id, p.id)),
    )
    .map((profile) => ({
      kind: "person",
      id: profile.id,
      name: profile.name,
      detail: "Friend · Member here",
      profile,
    }));
  const groups: CommonGroup[] = [
    { id: "friends", title: "Friends here", items: people },
  ];
  if (type === "space") {
    const linked = new Set(
      data.space_squads.filter((l) => l.space_id === id).map((l) => l.squad_id),
    );
    groups.push({
      id: "squads",
      title: "Squads in common",
      items: data.squads
        .filter(
          (s) => linked.has(s.id) && canOpenSquadProfile(data, s.id, viewerId),
        )
        .map((s) => ({
          kind: "community",
          entityType: "squad",
          id: s.id,
          name: s.name,
          iconKey: s.icon_key,
          detail: "Your Squad · Linked to this Organization",
        })),
    });
  }
  if (type === "organization") {
    const linked = new Set(
      data.organization_spaces
        .filter((l) => l.organization_id === id)
        .map((l) => l.space_id),
    );
    groups.push({
      id: "organizations",
      title: "Organizations in common",
      items: data.spaces
        .filter((s) => linked.has(s.id) && spaceMember(s.id, viewerId))
        .map((s) => ({
          kind: "community",
          entityType: "space",
          id: s.id,
          name: s.name,
          detail: "Your Organization · Linked to this Network",
        })),
    });
  }
  const associated = new Set(
    data.activity_social_links
      .filter((link) => link.entity_type === type && link.entity_id === id)
      .map((link) => link.activity_id),
  );
  const activityById = new Map(data.activities.map((a) => [a.id, a]));
  const joined = new Set(
    data.rsvps
      .filter((r) => {
        const activity = activityById.get(r.activity_id);
        return (
          r.user_id === viewerId && activity && isApprovedGoing(activity, r)
        );
      })
      .map((r) => r.activity_id),
  );
  const sharedBeacons: CommonItem[] = data.activities
    .filter(
      (a) =>
        canReadBeaconActivity(data, a, viewerId) &&
        (a.owner_id === viewerId || joined.has(a.id)) &&
        ((a.audience === type && a.audience_id === id) || associated.has(a.id)),
    )
    .map((activity) => ({
      kind: "beacon",
      id: activity.id,
      name: activity.title,
      detail: "Shared Beacon · Hosting or approved Going",
      activity,
    }));
  groups.push({ id: "beacons", title: "Shared Beacons", items: sharedBeacons });
  return groups
    .filter((g) => g.items.length)
    .map((g) => ({
      ...g,
      items: [...new Map(g.items.map((i) => [i.id, i])).values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }));
}
