import type { Data, Payload } from "@/src/shared/types";
import { canReadBeaconActivity } from "./beaconModules";
import { beaconCapacity, isApprovedGoing } from "./permissions";

export type ParticipationIntent =
  "join" | "maybe" | "decline" | "leave" | "cancel_request" | "remove_maybe";
export function participationPayload(
  id: string,
  intent: ParticipationIntent,
): Payload {
  return {
    id,
    status:
      intent === "join"
        ? "going"
        : intent === "maybe"
          ? "interested"
          : intent === "decline"
            ? "declined"
            : "withdraw",
    ...(["leave", "cancel_request", "remove_maybe"].includes(intent)
      ? { intent }
      : {}),
  };
}
/** Viewer-specific response, lifecycle, and access stay independent. */
export function beaconParticipation(
  data: Data,
  viewer: string | null,
  id: string,
  now = Date.now(),
) {
  const activity = data.activities.find((row) => row.id === id);
  if (
    !viewer ||
    data.viewer_id !== viewer ||
    !activity ||
    !canReadBeaconActivity(data, activity, viewer)
  )
    return null;
  const row = data.rsvps.find(
    (entry) => entry.activity_id === id && entry.user_id === viewer,
  );
  const invited = data.beacon_invitation_grants.some(
    (entry) => entry.activity_id === id && entry.user_id === viewer,
  );
  const hosting = activity.owner_id === viewer;
  const going = isApprovedGoing(activity, row);
  const pending =
    row?.status === "requested" || (row?.status === "going" && !going);
  const unknown =
    !!row &&
    !["going", "requested", "interested", "invited", "declined"].includes(
      row.status,
    );
  const capacity = beaconCapacity(data, activity);
  const ended =
    activity.status === "completed" || Date.parse(activity.ends_at) <= now;
  const cancelled = activity.status === "cancelled";
  const active = !ended && !cancelled && activity.status === "scheduled";
  const live = active && Date.parse(activity.starts_at) <= now;
  const mutable = active && !hosting && activity.mode !== "solo" && !unknown;
  const request =
    (activity.approval_required || activity.mode === "invite") &&
    !row?.approved;
  const canDecline =
    (data.is_demo === true || data.capabilities?.rsvp_decline === true) &&
    invited;
  const allowed: ParticipationIntent[] = [];
  if (mutable) {
    if (!going && !pending && !capacity.closed) allowed.push("join");
    if (row?.status !== "interested" && !pending) allowed.push("maybe");
    if (
      canDecline &&
      (row?.status === "invited" || row?.status === "interested")
    )
      allowed.push("decline");
    if (going) allowed.push("leave");
    if (pending) allowed.push("cancel_request");
    if (row?.status === "interested" && !invited) allowed.push("remove_maybe");
  }
  const response = hosting
    ? "hosting"
    : unknown
      ? "unknown"
      : going
        ? "going"
        : pending
          ? "requested"
          : (row?.status ?? "unanswered");
  const primary = hosting
    ? "Open Beacon"
    : cancelled
      ? "Cancelled"
      : ended
        ? "Ended"
        : activity.mode === "solo"
          ? "Solo activity"
          : unknown
            ? "Refresh response"
            : going
              ? "Going ✓"
              : pending
                ? "Requested ✓"
                : row?.status === "interested"
                  ? "Maybe ✓"
                  : row?.status === "declined"
                    ? "Can’t Go ✓"
                    : capacity.full
                      ? "Full"
                      : capacity.closed
                        ? "Closed"
                        : row?.status === "invited"
                          ? "I’m In"
                          : request
                            ? "Request to Join"
                            : "Join";
  const reasons: string[] = [];
  if (going) {
    if (capacity.strict && capacity.limit != null)
      reasons.push("Your confirmed spot will be released.");
    if (
      data.beacon_roles.some(
        (entry) => entry.activity_id === id && entry.user_id === viewer,
      )
    )
      reasons.push(
        "Your Beacon role will be inactive while you are not Going.",
      );
    if (
      data.beacon_checklist_items.some(
        (entry) =>
          entry.activity_id === id &&
          entry.assignee_id === viewer &&
          !entry.completed,
      )
    )
      reasons.push("You have outstanding assigned checklist items.");
    if (
      data.beacon_attendance.some(
        (entry) =>
          entry.activity_id === id &&
          entry.user_id === viewer &&
          entry.state !== "none",
      )
    )
      reasons.push(
        "You have an active arrival/check-in record. Your attendance history will be preserved.",
      );
    if (live) reasons.push("This Beacon is happening now.");
    if (activity.plan_id)
      reasons.push(
        "Only this Beacon stop changes; other Plan stops keep their responses.",
      );
  }
  return {
    activity,
    row,
    invited,
    hosting,
    going,
    pending,
    unknown,
    capacity,
    ended,
    cancelled,
    active,
    live,
    request,
    response,
    primary,
    allowed,
    reasons,
    invitationPair: mutable && row?.status === "invited" && canDecline,
    choices:
      mutable &&
      (going ||
        pending ||
        row?.status === "interested" ||
        row?.status === "declined"),
  };
}
