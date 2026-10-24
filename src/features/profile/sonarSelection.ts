import type { Data } from "@/src/shared/types";
import { selectListPeople } from "@/src/features/people/privateLists";
import {
  activeSonarSession,
  locationShareExpiry,
  MAX_LOCATION_SHARE_MS,
} from "@/src/features/maps/sessionHelpers";

export type SonarDuration =
  "15 minutes" | "30 minutes" | "1 hour" | "4 hours" | "Until activity ends";
export function sonarSelectionRequest(
  data: Data,
  viewer: string,
  selected: string[],
  duration: SonarDuration,
  activityId: string,
  operation: "start" | "save" | "extend",
  expectedSessionId: string | null,
  now = Date.now(),
) {
  if (data.viewer_id !== viewer)
    throw new Error("Your account changed. Reopen Sonar.");
  const eligible = selectListPeople(data, viewer);
  if (
    !selected.length ||
    selected.length > 50 ||
    new Set(selected).size !== selected.length ||
    selected.some((id) => !eligible.has(id))
  )
    throw new Error(
      "Review your selection: choose 1–50 currently accepted friends and remove unavailable people.",
    );
  const active = activeSonarSession(data.locations, viewer, now);
  if (
    (active?.id ?? null) !== expectedSessionId ||
    (operation !== "start" && !active)
  )
    throw new Error(
      "Your Sonar session changed or ended. Close this menu and review it again.",
    );
  const beacon = data.activities.find(
    (a) =>
      a.id === activityId &&
      a.status === "scheduled" &&
      (a.owner_id === viewer ||
        data.rsvps.some(
          (r) =>
            r.activity_id === a.id &&
            r.user_id === viewer &&
            r.status === "going" &&
            r.approved,
        )),
  );
  const base = active ? Date.parse(active.expires_at) : now;
  const minutes = {
    "15 minutes": 15,
    "30 minutes": 30,
    "1 hour": 60,
    "4 hours": 240,
  };
  const expiry =
    operation === "save"
      ? base
      : duration === "Until activity ends"
        ? locationShareExpiry(
            duration,
            now,
            active?.expires_at,
            beacon?.ends_at,
          )
        : Math.min(
            Math.max(now, base) + minutes[duration] * 60000,
            now + MAX_LOCATION_SHARE_MS,
          );
  if (!expiry || expiry <= now || (operation !== "save" && expiry <= base))
    throw new Error(
      `Choose a duration or Beacon that extends sharing within the ${MAX_LOCATION_SHARE_MS / 3600000}-hour limit.`,
    );
  return {
    recipients: [...selected],
    expires_at: new Date(expiry).toISOString(),
  };
}
