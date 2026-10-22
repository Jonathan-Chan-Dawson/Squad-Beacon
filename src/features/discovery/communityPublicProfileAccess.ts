import type { SocialDirectorySummary } from "@/src/features/social/types";

export type CommunityProfileMode =
  "loading" | "unavailable" | "summary" | "member";

/** Member-only profile areas require both a canonical active status and the
 * member record needed to render those areas. A safe summary can stand alone. */
export function communityProfileMode(
  summary: SocialDirectorySummary | null,
  hasMemberRecord: boolean,
  loading: boolean,
): CommunityProfileMode {
  if (!summary) return loading ? "loading" : "unavailable";
  return summary.membership_status === "active" && hasMemberRecord
    ? "member"
    : "summary";
}
