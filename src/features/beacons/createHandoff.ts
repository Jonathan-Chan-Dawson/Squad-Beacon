import type { Data, Payload } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { canReadBeaconActivity } from "./beaconModules";

export function parseCreationInvitees(raw: unknown): { ids: string[]; error: string } {
  if (raw == null || raw === "") return { ids: [], error: "" };
  try {
    const value: unknown = JSON.parse(String(raw));
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id.trim())) throw new Error();
    return { ids: [...new Set(value as string[])], error: "" };
  } catch { return { ids: [], error: "The selected friends could not be loaded. Clear this selection before continuing." }; }
}

export function eligibleCreationInvitees(data: Data, userId: string | null) {
  if (!userId || data.viewer_id !== userId) return [];
  return friendIds(data, userId).filter((id) => id !== userId && !data.blocks.some((block) =>
    (block.blocker_id === userId && block.blocked_id === id) || (block.blocker_id === id && block.blocked_id === userId)));
}

export function validateCreationInvitees(data: Data, userId: string | null, ids: string[]) {
  if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before creating this Beacon.");
  const eligible = new Set(eligibleCreationInvitees(data, userId));
  if (ids.some((id) => !eligible.has(id))) throw new Error("A selected friend is no longer eligible. Remove unavailable friends before creating the Beacon.");
}

export function creationStatusSource(data: Data, userId: string | null, id: string | undefined, now: number) {
  if (!userId || data.viewer_id !== userId || !id) return undefined;
  return data.activities.find((activity) => activity.id === id && activity.owner_id === userId && activity.mode === "solo" &&
    activity.status === "scheduled" && Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now && canReadBeaconActivity(data, activity, userId));
}

/** Only note text/category are seeded; audience, location, timing and settings stay fresh. */
export function creationStatusSeed(data: Data, userId: string | null, id: string | undefined, now: number) {
  const status = creationStatusSource(data, userId, id, now);
  return status ? { title: status.title, description: status.description ?? "", category: status.category } : undefined;
}

export function mergeCreationStatusSeed<T extends { title: string; description: string; category: string }>(draft: T,
  seed: { title: string; description: string; category: string }, edited: { title: boolean; description: boolean; category: boolean }) {
  return { ...draft, title: edited.title ? draft.title : seed.title, description: edited.description ? draft.description : seed.description,
    category: edited.category ? draft.category : seed.category };
}

export function creationHandoffParams(context: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ["inviteeIds", "statusSourceId", "startsAt", "fromMap", "threadId", "planId", "planSession"]) {
    if (typeof context[key] === "string" && context[key]) result[key] = context[key] as string;
  }
  if (typeof context.timezone === "string") {
    try { new Intl.DateTimeFormat("en-US", { timeZone: context.timezone }); result.timezone = context.timezone; }
    catch { /* Invalid route zones retain the normal creation default. */ }
  }
  const lat = context.latitude, lng = context.longitude;
  if (typeof lat === "string" && lat.trim() && typeof lng === "string" && lng.trim() &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180) {
    result.latitude = lat;
    result.longitude = lng;
    if (typeof context.placeLabel === "string") result.placeLabel = context.placeLabel;
  }
  return result;
}

export type CreationInviteSession = {
  atomicAttempt?: { action: "create_activity_with_invitees" | "create_plan_beacon_with_invitees"; payload: Payload; requestId: string; viewerId: string };
  createdId: string | null;
  viewerId: string | null;
  creationUnverified: boolean;
  invitedIds: string[];
  pendingIds: string[];
  errors: Record<string, string>;
};
export function newCreationInviteSession(): CreationInviteSession {
  return { createdId: null, viewerId: null, creationUnverified: false, invitedIds: [], pendingIds: [], errors: {} };
}
export type CreationAction = (action: string, payload?: Payload) => Promise<Record<string, unknown>>;

/** A session retains the created ID before invitations start. Retry only sends pending invitations. */
async function performCreateAndInvite(session: CreationInviteSession, ids: string[], getData: () => Data, userId: string | null,
  create: () => Promise<Record<string, unknown>>, act: CreationAction) {
  if (session.creationUnverified) throw new Error("The Beacon was created, but its ID could not be verified. Refresh before continuing.");
  if (!session.createdId) {
    validateCreationInvitees(getData(), userId, ids);
    const result = await create();
    session.viewerId = userId;
    if (typeof result.id !== "string" || !result.id) {
      session.creationUnverified = true;
      throw new Error("The Beacon was created, but its ID could not be verified. Refresh before continuing.");
    }
    session.createdId = result.id;
    session.pendingIds = [...ids];
  }
  if (session.viewerId !== userId) throw new Error("Return to the account that created this Beacon before retrying invitations.");
  session.pendingIds = session.pendingIds.filter((id) => ids.includes(id) && !session.invitedIds.includes(id));
  for (const id of [...session.pendingIds]) {
    if (!session.pendingIds.includes(id)) continue;
    try {
      validateCreationInvitees(getData(), userId, [id]);
      const existing = getData().rsvps.find((row) => row.activity_id === session.createdId && row.user_id === id);
      if (!existing || !["going", "requested", "invited"].includes(existing.status)) {
        await act("invite_activity", { id: session.createdId, user_id: id });
      }
      session.invitedIds.push(id);
      session.pendingIds = session.pendingIds.filter((pending) => pending !== id);
      delete session.errors[id];
    } catch (failure) { session.errors[id] = failure instanceof Error ? failure.message : "Could not send this invitation. Try again."; }
  }
  return { ...session, invitedIds: [...session.invitedIds], pendingIds: [...session.pendingIds], errors: { ...session.errors } };
}

const invitationRuns = new WeakMap<CreationInviteSession, Promise<CreationInviteSession>>();
export function createAndInvite(session: CreationInviteSession, ids: string[], getData: () => Data, userId: string | null,
  create: () => Promise<Record<string, unknown>>, act: CreationAction) {
  const running = invitationRuns.get(session);
  if (running) return running;
  const result = performCreateAndInvite(session, ids, getData, userId, create, act);
  invitationRuns.set(session, result);
  void result.finally(() => invitationRuns.delete(session)).catch(() => {});
  return result;
}

export type AtomicCreationAction = "create_activity_with_invitees" | "create_plan_beacon_with_invitees";
export type AtomicCreationService = (action: string, payload?: Payload, requestId?: string) => Promise<Record<string, unknown>>;
async function performAtomicCreation(session: CreationInviteSession, ids: string[], getData: () => Data, userId: string | null,
  action: AtomicCreationAction, payload: Payload, act: AtomicCreationService, makeRequestId: () => string) {
  if (session.createdId) {
    if (session.viewerId!==userId || getData().viewer_id!==userId) throw new Error("Return to the account that created this Beacon.");
    return {...session};
  }
  if (!session.atomicAttempt) {
    validateCreationInvitees(getData(),userId,ids);
    if (ids.length<1 || ids.length>20) throw new Error("Choose from 1 to 20 friends per Beacon invitation batch.");
    session.atomicAttempt={action,payload:structuredClone({...payload,invitee_ids:[...ids],expected_actor_id:userId}),requestId:makeRequestId(),viewerId:userId!};
  }
  const attempt=session.atomicAttempt;
  if (attempt.viewerId!==userId || getData().viewer_id!==userId) throw new Error("Return to the account that started this Beacon before confirming publication.");
  session.viewerId=userId;
  try {
    const result=await act(attempt.action,attempt.payload,attempt.requestId);
    if (getData().viewer_id!==userId) throw new Error("Return to the account that started this Beacon before confirming publication.");
    const selected=attempt.payload.invitee_ids as string[];
    if (result.committed!==true || result.event!==attempt.action || typeof result.id!=="string" || !result.id || !Array.isArray(result.invited_ids) || result.invited_ids.length!==selected.length || selected.some((id)=>!(result.invited_ids as unknown[]).includes(id))) throw new Error("Publication could not be verified. Retry confirmation using the same saved draft.");
    session.createdId=result.id; session.invitedIds=[...selected]; session.pendingIds=[]; session.errors={};
    return {...session};
  } catch (failure) {
    // Only a definitive server rejection proves that the transaction did not commit.
    if ((failure as {definitive?:boolean})?.definitive===true && !(failure instanceof Error && /account changed/i.test(failure.message))) delete session.atomicAttempt;
    throw failure instanceof Error && /unknown action/i.test(failure.message) ? new Error("Publishing selected invitations needs a backend update. Your draft is still here.") : failure;
  }
}
export function atomicCreateAndInvite(session: CreationInviteSession, ids: string[], getData: () => Data, userId: string | null,
  action: AtomicCreationAction, payload: Payload, act: AtomicCreationService, makeRequestId: () => string) {
  const running=invitationRuns.get(session);
  if (running) return running;
  const result=performAtomicCreation(session,ids,getData,userId,action,payload,act,makeRequestId);
  invitationRuns.set(session,result);
  void result.finally(()=>invitationRuns.delete(session)).catch(()=>{});
  return result;
}
