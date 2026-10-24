import { validateBeaconControlValues } from "./controls";
import { durationMinutesForLabel } from "./createTiming";

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const actions = [
  "create_activity",
  "create_plan_beacon",
  "create_activity_with_invitees",
  "create_plan_beacon_with_invitees",
  "create_planning_thread",
  "add_council_proposal",
];
/** Keep native secure-storage chunks byte-safe and preserve complete emoji pairs. */
export function splitCreationStorageText(raw: string) {
  return raw.match(/[\s\S]{1,400}/gu) ?? [];
}
function validateAttempt(value: unknown, viewer: string, atomic = false) {
  if (
    !record(value) ||
    !actions.includes(String(value.action)) ||
    !record(value.payload) ||
    typeof value.requestId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(value.requestId) ||
    (atomic ? value.viewerId : value.viewer) !== viewer ||
    (value.result !== undefined &&
      (!record(value.result) || typeof value.result.id !== "string"))
  )
    throw new Error(
      "Saved publication state could not be verified. Keep the saved data and contact support before creating another Beacon.",
    );
}
export type CreationSnapshot = {
  version: 1;
  viewer: string;
  token: string;
  updatedAt: number;
  context: Record<string, string>;
  fields: Record<string, unknown>;
};

/** Bound untrusted local data before it reaches editor state. */
export function parseCreationSnapshot(
  raw: string,
  viewer: string,
): CreationSnapshot {
  if (raw.length > 262144)
    throw new Error("This saved draft is too large to restore.");
  const value = JSON.parse(raw) as CreationSnapshot;
  if (
    !record(value) ||
    value.version !== 1 ||
    value.viewer !== viewer ||
    typeof value.token !== "string" ||
    !value.token.startsWith("creation:") ||
    !Number.isFinite(value.updatedAt) ||
    !value.fields ||
    Array.isArray(value.fields) ||
    typeof value.fields !== "object" ||
    !record(value.context) ||
    Object.values(value.context).some((item) => typeof item !== "string")
  )
    throw new Error("This saved draft is unavailable for this account.");
  const scalarStrings = [
    "title",
    "description",
    "category",
    "label",
    "url",
    "starts",
    "ends",
    "when",
    "duration",
    "audience",
    "approval",
    "placeType",
    "addTo",
    "kind",
    "templateName",
    "decisionId",
    "selectedPlanId",
    "planPosition",
    "target",
    "view",
    "decisionKind",
    "decisionTitle",
  ];
  for (const key of scalarStrings)
    if (key in value.fields && typeof value.fields[key] !== "string")
      throw new Error("This saved draft contains invalid fields.");
  for (const key of ["inviteeIds", "aspirationIds", "prepAnswers"]) {
    const field = value.fields[key];
    if (
      field !== undefined &&
      (!Array.isArray(field) || field.some((item) => typeof item !== "string"))
    )
      throw new Error("This saved draft contains invalid selections.");
  }
  const pin = value.fields.pin as {
    latitude: number;
    longitude: number;
  } | null;
  if (
    pin &&
    (!Number.isFinite(pin.latitude) ||
      !Number.isFinite(pin.longitude) ||
      Math.abs(pin.latitude) > 90 ||
      Math.abs(pin.longitude) > 180)
  )
    throw new Error("This saved draft has an invalid location.");
  const enums: Record<string, string[]> = {
    category: ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"],
    audience: ["private", "friends", "list", "squad", "organization"],
    approval: ["Open joining", "Host approval"],
    placeType: ["In person", "Online"],
    addTo: ["Standalone", "Plan", "Vote / Draw"],
    kind: ["Beacon", "Squad", "Status"],
    when: ["Now", "In 30 min", "Pick time"],
  };
  for (const [key, allowed] of Object.entries(enums))
    if (key in value.fields && !allowed.includes(String(value.fields[key])))
      throw new Error("This saved draft has an unsupported choice.");
  for (const key of ["starts", "ends"])
    if (
      key in value.fields &&
      !Number.isFinite(Date.parse(String(value.fields[key])))
    )
      throw new Error("This saved draft has an invalid date.");
  for (const key of [
    "home",
    "available",
    "statusSourceDismissed",
    "reuseReviewed",
  ])
    if (key in value.fields && typeof value.fields[key] !== "boolean")
      throw new Error("This saved draft has an invalid setting.");
  if (value.fields.duration !== undefined && value.fields.duration !== "Custom")
    durationMinutesForLabel(String(value.fields.duration), "", "");
  const controls = value.fields.beaconControlDraft;
  if (controls !== undefined) {
    if (
      !record(controls) ||
      typeof controls.routeKey !== "string" ||
      !record(controls.value)
    )
      throw new Error("Saved module settings could not be restored.");
    validateBeaconControlValues(controls.value);
  }
  const association = value.fields.associationDraft;
  if (
    association !== undefined &&
    (!record(association) ||
      typeof association.routeKey !== "string" ||
      (association.value !== null &&
        (!record(association.value) ||
          !["squad", "space", "organization"].includes(
            String(association.value.entity_type),
          ) ||
          typeof association.value.entity_id !== "string")))
  )
    throw new Error("Saved community settings could not be restored.");
  const recipe = value.fields.selectedRecipe;
  if (
    recipe != null &&
    (!record(recipe) ||
      typeof recipe.title !== "string" ||
      typeof recipe.category !== "string" ||
      !Number.isFinite(recipe.minutes) ||
      (recipe.prepPrompts !== undefined && !strings(recipe.prepPrompts)))
  )
    throw new Error("Saved template settings could not be restored.");
  if (value.fields.pendingPublication != null)
    validateAttempt(value.fields.pendingPublication, viewer);
  const session = value.fields.invitationSession;
  if (session !== undefined) {
    if (
      !record(session) ||
      !strings(session.invitedIds) ||
      !strings(session.pendingIds) ||
      !record(session.errors) ||
      typeof session.creationUnverified !== "boolean" ||
      (session.createdId !== null && typeof session.createdId !== "string") ||
      (session.viewerId !== null && session.viewerId !== viewer)
    )
      throw new Error("Saved invitation recovery could not be verified.");
    if (session.atomicAttempt !== undefined)
      validateAttempt(session.atomicAttempt, viewer, true);
  }
  return value;
}

export type FrozenPublication = {
  action: string;
  payload: Record<string, unknown>;
  requestId: string;
  viewer: string;
  result?: Record<string, unknown>;
};

/** A retry always uses the first payload, even if the editor has since changed. */
export async function runFrozenPublication(
  attempt: FrozenPublication,
  viewer: string,
  checkpoint: () => Promise<void>,
  send: (
    action: string,
    payload: Record<string, unknown>,
    requestId: string,
  ) => Promise<Record<string, unknown>>,
) {
  if (attempt.viewer !== viewer)
    throw new Error("Return to the account that started publication.");
  if (attempt.result) {
    await checkpoint();
    return attempt.result;
  }
  await checkpoint();
  const result = await send(
    attempt.action,
    structuredClone(attempt.payload),
    attempt.requestId,
  );
  if (typeof result.id !== "string" || !result.id)
    throw new Error(
      "Publication could not be verified. Your pending request is saved; retry confirmation.",
    );
  if (attempt.action.endsWith("_with_invitees")) {
    const ids = attempt.payload.invitee_ids;
    if (
      !strings(ids) ||
      result.committed !== true ||
      result.event !== attempt.action ||
      !strings(result.invited_ids) ||
      result.invited_ids.length !== ids.length ||
      ids.some((id) => !(result.invited_ids as string[]).includes(id))
    )
      throw new Error(
        "Publication and invitations could not be verified. Retry the saved request to confirm.",
      );
  }
  attempt.result = result;
  await checkpoint();
  return result;
}

/** User deletion is conservative: even confirmed IDs must retain their recovery route. */
export function creationSnapshotNeedsRecovery(snapshot: CreationSnapshot) {
  const fields = snapshot.fields;
  if (fields.pendingPublication != null) return true;
  const session = fields.invitationSession;
  return (
    record(session) &&
    !!(
      session.atomicAttempt ||
      session.createdId ||
      session.creationUnverified ||
      (Array.isArray(session.pendingIds) && session.pendingIds.length)
    )
  );
}
