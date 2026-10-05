import type {
  Discoverability,
  InvitePolicy,
  JoinMode,
  SocialMembershipStatus,
  SocialRole,
} from "./types";

export const SOCIAL_ROLE_RANK: Record<SocialRole, number> = {
  member: 1,
  elder: 2,
  admin: 3,
  coowner: 4,
  owner: 5,
};

export function canInviteWithPolicy(
  role: SocialRole | null,
  policy: InvitePolicy | null | undefined,
): boolean {
  if (!role) return false;
  const minimumRole =
    policy === "members" ? "member" : policy === "elders" ? "elder" : "admin";
  return SOCIAL_ROLE_RANK[role] >= SOCIAL_ROLE_RANK[minimumRole];
}

export function socialDirectoryAction(
  membershipStatus: SocialMembershipStatus | null | undefined,
  joinMode: JoinMode,
): "joined" | "invited" | "requested" | "join" | "request" | "invite_required" {
  if (membershipStatus === "active") return "joined";
  if (membershipStatus === "invited") return "invited";
  if (membershipStatus === "requested") return "requested";
  if (joinMode === "open") return "join";
  if (joinMode === "request") return "request";
  return "invite_required";
}

export function isSocialDirectoryVisible(
  discoverability: Discoverability,
  isEligibleCommunityMember: boolean,
): boolean {
  return discoverability === "public" ||
    (discoverability === "community" && isEligibleCommunityMember);
}
