import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type { SocialDirectorySummary } from "@/src/features/social/types";

/** Compact CTA copy spells out the community type for open and request access. */
export function compactCommunityActionTitle(
  action: SocialDirectorySummary["action"],
  type: SocialDirectorySummary["entity_type"],
) {
  if (action === "join") return `Join ${communityTypeLabel(type)}`;
  if (action === "request")
    return `Request to Join ${communityTypeLabel(type)}`;
  if (action === "invited") return "Accept Invite";
  return null;
}

export function compactCommunityMembershipPresentation(
  summary: SocialDirectorySummary,
) {
  return {
    actionTitle: compactCommunityActionTitle(
      summary.action,
      summary.entity_type,
    ),
    status:
      summary.action === "joined"
        ? ("joined" as const)
        : summary.action === "requested"
          ? ("requested" as const)
          : null,
  };
}
