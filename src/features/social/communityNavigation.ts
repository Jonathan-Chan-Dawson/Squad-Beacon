import { router } from "expo-router";
import type { SocialDirectorySummary } from "./types";

export function openCommunityProfile(
  summary: Pick<SocialDirectorySummary, "entity_type" | "entity_id">,
) {
  const params = { id: summary.entity_id };
  if (summary.entity_type === "squad")
    router.push({ pathname: "/squad/[id]", params });
  else if (summary.entity_type === "space")
    router.push({ pathname: "/space/[id]", params });
  else router.push({ pathname: "/organization/[id]", params });
}
