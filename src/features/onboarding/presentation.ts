import type { Data } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import {
  confirmedHubActivities,
  personalHubPreview,
} from "@/src/features/beacons/hubSelectors";
import { pendingSocialCount } from "@/src/features/people/communication";
import type { OnboardingKey, ProgressStatus, SuccessKey } from "./progress";

export type ContentState =
  "error" | "loading" | "unavailable" | "filtered" | "empty" | "populated";
export function contentState(input: {
  error?: unknown;
  loading?: boolean;
  available?: boolean;
  filtered?: boolean;
  count: number;
}): ContentState {
  if (input.error) return "error";
  if (input.available === false) return "unavailable";
  if (input.loading) return "loading";
  if (input.count) return "populated";
  return input.filtered ? "filtered" : "empty";
}
export function homePresentation(
  data: Data,
  viewer: string | null,
  now: number,
  progress: ReadonlySet<OnboardingKey>,
  status: ProgressStatus,
  loading: boolean,
  error: unknown,
  firstEntrySession = false,
) {
  const available = !!viewer && data.viewer_id === viewer;
  const state = contentState({ error, loading, available, count: 0 });
  const pending = available ? pendingSocialCount(data, viewer, now) : 0;
  const friends = available && friendIds(data, viewer!).length > 0;
  if (state === "error" || state === "loading" || state === "unavailable")
    return { kind: state, pending, friends } as const;
  const commitments = personalHubPreview(
    confirmedHubActivities(data, viewer),
    now,
  );
  const existing =
    friends ||
    pending > 0 ||
    data.activities.some((a) => a.owner_id === viewer) ||
    data.plans.some((p) => p.owner_id === viewer) ||
    data.squad_members.some((m) => m.user_id === viewer);
  if (commitments.length)
    return { kind: "populated", pending, friends } as const;
  const eligible =
    status === "ready" &&
    firstEntrySession &&
    progress.has("entry.eligible.v1") &&
    !progress.has("welcome.dismissed.v1");
  return {
    kind: eligible && !existing ? "welcome" : "compact",
    pending,
    friends,
  } as const;
}
/** Called only from a confirmed local action, never from a snapshot/refresh effect. */
export function firstSuccessCandidate(
  before: Data,
  after: Data,
  viewer: string,
  action: string,
): SuccessKey | null {
  if (before.viewer_id !== viewer || after.viewer_id !== viewer) return null;
  const owned = (data: Data) =>
    data.activities.filter((a) => a.owner_id === viewer && a.mode !== "solo");
  if (
    [
      "create_activity",
      "create_activity_with_invitees",
      "create_plan_beacon",
      "create_plan_beacon_with_invitees",
    ].includes(action) &&
    !owned(before).length &&
    owned(after).length === 1
  )
    return "success.firstBeacon.v1";
  if (
    action === "accept_friend" &&
    !friendIds(before, viewer).length &&
    friendIds(after, viewer).length === 1
  )
    return "success.firstConnection.v1";
  if (
    ["end_plan_beacon", "activity_status"].includes(action) &&
    !owned(before).some((a) => a.status === "completed") &&
    owned(after).some((a) => a.status === "completed")
  )
    return "success.firstCompletion.v1";
  return null;
}
