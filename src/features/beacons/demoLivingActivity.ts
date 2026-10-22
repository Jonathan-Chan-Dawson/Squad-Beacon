import type { Activity, Data, Payload, Presence } from "@/src/shared/types";
import {
  activeAt,
  currentActivity,
  isActivityNote,
  ownActivityNote,
} from "./livingActivity";
import { eligibleCurrentBeacons } from "./currentStatusBeacon";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";

export function applyDemoLivingActivity(
  previous: Data,
  owner: string,
  action: string,
  payload: Payload,
): Data | null {
  if (
    ![
      "save_activity_note",
      "end_activity_note",
      "update_presence",
      "reconcile_current_activity",
    ].includes(action)
  )
    return null;
  if (previous.viewer_id !== owner)
    throw new Error("Your account changed. Refresh to continue.");
  if (payload.expected_actor_id && payload.expected_actor_id !== owner)
    throw new Error("Your account changed.");
  const data = structuredClone(previous);
  const now = Date.now();
  data.presence ??= [];
  let presence = data.presence.find((p) => p.owner_id === owner);
  if (!presence) {
    const status = data.activities.find(
      (a) =>
        a.owner_id === owner &&
        a.mode === "solo" &&
        !isActivityNote(a) &&
        activeAt(a, now),
    );
    presence = {
      owner_id: owner,
      sharing: status?.status_sharing !== false,
      availability:
        status?.available === true
          ? "available"
          : status?.available === false
            ? "busy"
            : null,
      availability_until: status?.ends_at,
      show_current_beacon: status?.status_show_current_beacon ?? false,
      current_beacon_id: status?.status_current_beacon_id ?? null,
      current_audience: status?.audience ?? "friends",
      current_audience_id: status?.audience_id ?? null,
      current_activity: null,
    };
    data.presence.push(presence);
  }
  if (action === "update_presence") {
    if (Object.hasOwn(payload, "availability")) {
      if (
        payload.availability !== null &&
        payload.availability !== "available" &&
        payload.availability !== "busy"
      )
        throw new Error("Choose valid availability.");
      presence.availability = payload.availability;
      presence.availability_until = String(
        payload.availability_until ?? new Date(now + 3600000).toISOString(),
      );
    }
    if (payload.availability_audience) {
      const audience = payload.availability_audience as Activity["audience"];
      if (
        !["friends", "private"].includes(audience) &&
        !eligibleDefaultTargets(data, owner, audience).some(
          (t) => t.id === payload.availability_audience_id,
        )
      )
        throw new Error("Choose an eligible audience.");
      presence.availability_audience = audience;
      presence.availability_audience_id = payload.availability_audience_id as
        string | null;
    }
    if (payload.current_audience) {
      const audience = payload.current_audience as Activity["audience"];
      if (
        !["friends", "private"].includes(audience) &&
        !eligibleDefaultTargets(data, owner, audience).some(
          (t) => t.id === payload.current_audience_id,
        )
      )
        throw new Error("Choose an eligible sharing audience.");
      presence.current_audience = audience;
      presence.current_audience_id = payload.current_audience_id as
        string | null;
    }
    if (typeof payload.sharing === "boolean")
      presence.sharing = payload.sharing;
    if (typeof payload.show_current_beacon === "boolean")
      presence.show_current_beacon = payload.show_current_beacon;
    if (Object.hasOwn(payload, "current_beacon_id")) {
      if (
        presence.show_current_beacon &&
        payload.current_beacon_id !== null &&
        !eligibleCurrentBeacons(data, owner, now).some(
          (a) =>
            payload.current_beacon_id === null ||
            a.id === payload.current_beacon_id,
        )
      )
        throw new Error("Choose an eligible live Beacon.");
      presence.current_beacon_id = payload.current_beacon_id as string | null;
    }
  }
  if (action === "save_activity_note") {
    if (currentActivity(data, owner, owner, now)?.type === "beacon")
      throw new Error("Manage your Current Beacon first.");
    const source = payload.id
      ? data.activities.find(
          (a) =>
            a.id === payload.id &&
            a.owner_id === owner &&
            isActivityNote(a) &&
            activeAt(a, now),
        )
      : undefined;
    if (payload.id && !source)
      throw new Error("This Activity Note ended. Start a new activity.");
    if (!source && ownActivityNote(data, owner, now))
      throw new Error("Edit or end your current Activity Note first.");
    const title = String(payload.title ?? "").trim(),
      description = String(payload.description ?? ""),
      ends = Date.parse(String(payload.ends_at));
    if (
      !title ||
      title.length > 120 ||
      description.length > 2000 ||
      !Number.isFinite(ends) ||
      ends <= now ||
      ends > now + 86400000
    )
      throw new Error("Choose a title and a valid end time within 24 hours.");
    const category = payload.category as Activity["category"];
    if (
      !["Fitness", "Study", "Gaming", "Creative", "Social", "Other"].includes(
        category,
      )
    )
      throw new Error("Choose a category.");
    const audience = (payload.audience ?? "friends") as Activity["audience"];
    if (
      !["friends", "private"].includes(audience) &&
      !eligibleDefaultTargets(data, owner, audience).some(
        (t) => t.id === payload.audience_id,
      )
    )
      throw new Error("Choose an eligible audience.");
    const note: Activity = {
      ...(source ?? data.activities[0]),
      id: source?.id ?? `note-${Math.random().toString(36).slice(2)}`,
      owner_id: owner,
      title,
      description,
      category,
      mode: "solo",
      solo_purpose: "activity_note",
      status: "scheduled",
      starts_at: source?.starts_at ?? new Date(now).toISOString(),
      ends_at: new Date(ends).toISOString(),
      timezone: String(payload.timezone ?? "UTC"),
      audience,
      audience_id: (payload.audience_id as string | null) ?? null,
      decoration_emoji: (payload.decoration_emoji as string) ?? null,
      available: undefined,
      status_attachment: null,
      status_current_beacon: null,
      status_show_current_beacon: false,
      status_current_beacon_id: null,
      status_sharing: true,
      status_note_hidden: false,
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step: null,
      plan_step_index: null,
      aspiration_ids: [],
      approval_required: false,
      enable_chat: false,
      enable_comments: false,
      enable_reactions: false,
    };
    data.activities = data.activities
      .filter((a) => a.id !== note.id)
      .concat(note);
    data.places = data.places
      .filter((p) => p.activity_id !== note.id)
      .concat({
        activity_id: note.id,
        label: String(payload.label ?? ""),
        latitude: null,
        longitude: null,
        online_url: null,
      });
  }
  if (action === "end_activity_note") {
    const note = data.activities.find(
      (a) => a.id === payload.id && a.owner_id === owner && isActivityNote(a),
    );
    if (!note) throw new Error("Choose your own Activity Note.");
    note.status = "completed";
    note.ends_at = new Date(
      Math.max(
        Date.parse(note.starts_at) + 1,
        Math.min(Date.parse(note.ends_at), now),
      ),
    ).toISOString();
  }
  reconcileDemoCurrent(data, owner, presence, now);
  return data;
}
export function reconcileDemoCurrent(
  data: Data,
  owner: string,
  presence: Presence,
  now: number,
) {
  if (!presence.show_current_beacon) return;
  const selected = eligibleCurrentBeacons(data, owner, now).find(
    (a) => !presence.current_beacon_id || a.id === presence.current_beacon_id,
  );
  if (!selected) return;
  for (const note of data.activities.filter(
    (a) => a.owner_id === owner && isActivityNote(a) && activeAt(a, now),
  )) {
    note.status = "completed";
    note.superseded_at = new Date(now).toISOString();
    note.ends_at = new Date(
      Math.max(
        Date.parse(note.starts_at) + 1,
        Math.min(Date.parse(note.ends_at), now),
      ),
    ).toISOString();
  }
}
