import { canChat } from "@/src/shared/browsing";
import {
  canAddBeaconNote,
  canDeleteBeaconModuleEntry,
  canEditBeaconChecklist,
  canReadBeaconActivity,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import {
  beaconCapacity,
  canAdmitBeaconParticipants,
  canAssignBeaconRole,
  canManageBeaconSettings,
  canRemoveBeaconParticipant,
  canRevokeBeaconRole,
  canSetArrivalState,
  isApprovedGoing,
  canWriteBeaconModule,
} from "@/src/features/beacons/permissions";
import {
  canSetStrictCapacity,
  validateBeaconControlValues,
  type BeaconControlValues,
} from "@/src/features/beacons/controls";
import type {
  BeaconDraft,
  Data,
  LibraryKind,
  Payload,
  PlanningThread,
} from "@/src/shared/types";
import { localDate, validateActivity } from "@/src/shared/domain";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  validateBeaconDraft,
  validateCouncilProposal,
  validatePlanningThreadDraft,
} from "@/src/features/planning/domain";
import {
  buildPlanSchedule,
  detectPlanStepOverlaps,
  validatePlanSteps,
} from "@/src/features/plans/domain";
import { makeDemo as makeNeighborhoodDemo } from "@/tests/fixtures/neighborhood";
export const DEMO_ID = "demo-you";
export function makeDemo(): Data {
  const data = makeNeighborhoodDemo(),
    createdAt = new Date().toISOString(),
    activityId = "demo-tools",
    startsAt = new Date(Date.now() + 86400000).toISOString();
  data.viewer_id = DEMO_ID;
  data.is_demo = true;
  data.activities.push({
    id: activityId,
    owner_id: DEMO_ID,
    title: "Walk planning with the crew",
    description: "A sample beacon for the shared checklist and notes.",
    category: "Social",
    mode: "squad",
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 3600000).toISOString(),
    timezone: "America/Chicago",
    approval_required: false,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "squad",
    audience_id: "boxing",
  });
  data.places.push({
    activity_id: activityId,
    label: "Route to choose",
    latitude: null,
    longitude: null,
    online_url: null,
  });
  data.rsvps.push({
    activity_id: activityId,
    user_id: "jordan",
    status: "going",
    approved: true,
  });
  data.beacon_checklist_items = [
    {
      id: "demo-checklist-water",
      activity_id: activityId,
      author_id: DEMO_ID,
      text: "Bring a water bottle",
      completed: false,
      created_at: createdAt,
    },
    {
      id: "demo-checklist-wraps",
      activity_id: activityId,
      author_id: "jordan",
      text: "Pick a route everyone likes",
      completed: false,
      created_at: createdAt,
    },
  ];
  data.beacon_notes = [
    {
      id: "demo-note-tools",
      activity_id: activityId,
      author_id: "jordan",
      body: "The lakefront route is open and easy to follow.",
      revision: 0,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];
  const pingCreatedAt = new Date().toISOString();
  data.planning_threads.push({
    id: "demo-ping-maya",
    owner_id: "maya",
    coowner_ids: [],
    kind: "ping",
    title: "A Saturday trail loop?",
    body: "I found an easy route and would love some company.",
    audience: "friends",
    audience_id: null,
    deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: "open",
    payload: {
      title: "Saturday trail loop",
      description: "An easy route and a coffee stop afterward.",
      category: "Fitness",
      mode: "squad",
      starts_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Chicago",
      approval_required: false,
      audience: "friends",
      audience_id: null,
      target_count: null,
      label: "",
      online_url: null,
      latitude: null,
      longitude: null,
      aspiration_ids: [],
    },
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: pingCreatedAt,
    resolved_at: null,
  });
  return data;
}
export function demoAction(previous: Data, action: string, p: Payload): Data {
  const d = structuredClone(previous),
    id = String(p.id ?? ""),
    uid = DEMO_ID;
  const newId = () => "demo-" + Math.random().toString(36).slice(2);
  const currentProfile = d.profiles.find((profile) => profile.id === uid)!;
  const isSquadMember = (squadId: string) =>
    d.squad_members.some(
      (member) => member.squad_id === squadId && member.user_id === uid,
    );
  const isSquadAdmin = (squadId: string) =>
    d.squad_members.some(
      (member) =>
        member.squad_id === squadId &&
        member.user_id === uid &&
        (member.role === "owner" || member.role === "admin"),
    );
  const checkAspirationIds = (ids: unknown) => {
    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      ids.some(
        (aspirationId) =>
          typeof aspirationId !== "string" ||
          !currentProfile.aspiration_goals.some((goal) => goal.id === aspirationId),
      )
    )
      throw new Error("Choose aspirations from your profile.");
    return [...new Set(ids as string[])];
  };
  const isFriend = (personId: string) =>
    d.friendships.some(
      (friendship) =>
        friendship.status === "accepted" &&
        ((friendship.sender_id === uid && friendship.recipient_id === personId) ||
          (friendship.recipient_id === uid && friendship.sender_id === personId)),
    );
  const currentControlValues = (activity: Data["activities"][number]) =>
    validateBeaconControlValues({
      capacity_limit: activity.capacity_limit ?? null,
      capacity_policy: activity.capacity_policy ?? "soft",
      manual_closed: activity.manual_closed ?? false,
      enable_chat: activity.enable_chat ?? true,
      enable_checklist: activity.enable_checklist ?? true,
      enable_journal: activity.enable_journal ?? true,
      enable_experiences: activity.enable_experiences ?? true,
      enable_focus: activity.enable_focus ?? true,
      enable_reactions: activity.enable_reactions ?? true,
      music_url: activity.music_url ?? null,
      decoration_emoji: activity.decoration_emoji ?? null,
      decoration_accent: activity.decoration_accent ?? null,
    });
  if (action === "set_beacon_controls") {
    const activity = d.activities.find((item) => item.id === (p.activity_id ?? id));
    if (!activity || !canManageBeaconSettings(d, activity, uid))
      throw new Error("Only the beacon owner or a current co-owner can change settings.");
    if (activity.status !== "scheduled")
      throw new Error("Beacon settings are read-only after the beacon ends.");
    const values: BeaconControlValues = validateBeaconControlValues({
      ...currentControlValues(activity),
      ...p,
    });
    if (!canSetStrictCapacity(d, activity, values.capacity_limit, values.capacity_policy))
      throw new Error("Capacity cannot be lowered below current accepted Going count.");
    Object.assign(activity, values);
    return d;
  }
  if (action === "set_beacon_attendance") {
    const activity = d.activities.find((item) => item.id === (p.activity_id ?? id)),
      targetId = typeof p.user_id === "string" ? p.user_id : uid,
      state = p.state;
    if (
      !activity ||
      (state !== "none" && state !== "arriving" && state !== "present") ||
      !canSetArrivalState(d, activity, uid, targetId, state as "none" | "arriving" | "present")
    )
      throw new Error("Only an eligible attendee may update their own arrival status.");
    const existing = d.beacon_attendance.find(
      (item) => item.activity_id === activity.id && item.user_id === uid,
    );
    if (existing) existing.state = state as "none" | "arriving" | "present";
    else d.beacon_attendance.push({
      activity_id: activity.id,
      user_id: uid,
      state: state as "none" | "arriving" | "present",
      updated_at: new Date().toISOString(),
    });
    return d;
  }
  if (action === "assign_beacon_role" || action === "revoke_beacon_role") {
    const activity = d.activities.find((item) => item.id === (p.activity_id ?? id)),
      targetId = typeof p.user_id === "string" ? p.user_id : "";
    if (!activity)
      throw new Error("Beacon unavailable.");
    if (action === "assign_beacon_role") {
      const role = p.role;
      if (
        (role !== "coowner" && role !== "admin") ||
        !canAssignBeaconRole(d, activity, uid, targetId, role)
      )
        throw new Error("Choose an eligible Going participant and a role you can assign.");
      const existing = d.beacon_roles.find(
        (item) => item.activity_id === activity.id && item.user_id === targetId,
      );
      if (existing) {
        existing.role = role;
        existing.assigned_by = uid;
        existing.created_at = new Date().toISOString();
      } else {
        d.beacon_roles.push({
          activity_id: activity.id,
          user_id: targetId,
          role,
          assigned_by: uid,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      if (!canRevokeBeaconRole(d, activity, uid, targetId))
        throw new Error("Your role cannot remove that beacon role.");
      d.beacon_roles = d.beacon_roles.filter(
        (item) => !(item.activity_id === activity.id && item.user_id === targetId),
      );
    }
    return d;
  }
  const planStartDateIsValid = (startDate: string, timezone: string) => {
    const today = localDate(new Date(), timezone),
      day = (value: string) => Date.parse(value + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !Number.isFinite(day(startDate)) ||
      day(startDate) < day(today) ||
      day(startDate) > day(today) + 365 * 86400000
    )
      throw new Error("Choose a plan start date within the next year.");
  };
  const planningThread = (threadId: string) =>
    d.planning_threads.find((thread) => thread.id === threadId);
  const canReadThread = (thread: PlanningThread, viewer = uid) =>
    canReadPlanningThread(d, thread, viewer);
  const canManageThread = (thread: PlanningThread) =>
    canReadThread(thread) && canManagePlanningThread(thread, uid);
  const canReadPlanningAudience = (
    ownerId: string,
    audience: PlanningThread["audience"],
    audienceId: string | null,
    viewer: string,
  ) =>
    canReadPlanningThread(
      d,
      {
        owner_id: ownerId,
        audience,
        audience_id: audienceId,
      } as PlanningThread,
      viewer,
    );
  const validatePlanningBeaconDraft = (draft: BeaconDraft) => {
    validateBeaconDraft(draft);
    checkAspirationIds(draft.aspiration_ids);
  };
  const materializePlanningBeacon = (
    ownerId: string,
    draft: BeaconDraft,
  ) => {
    validatePlanningBeaconDraft(draft);
    const activityId = newId();
    d.activities.push({
      id: activityId,
      owner_id: ownerId,
      title: draft.title,
      description: draft.description,
      target_count: draft.target_count,
      category: draft.category,
      mode: draft.mode,
      starts_at: draft.starts_at,
      ends_at: draft.ends_at,
      timezone: draft.timezone,
      approval_required: draft.approval_required,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: [...draft.aspiration_ids],
      audience: draft.audience,
      audience_id: draft.audience_id,
    });
    d.places.push({
      activity_id: activityId,
      label: draft.label,
      latitude: draft.latitude,
      longitude: draft.longitude,
      online_url: draft.online_url,
    });
    return activityId;
  };
  if (action === "create_planning_thread") {
    const kind = String(p.kind) as PlanningThread["kind"],
      audience = String(p.audience ?? "private") as PlanningThread["audience"],
      audienceId = p.audience_id == null ? null : String(p.audience_id),
      deadlineAt = String(p.deadline_at ?? ""),
      title = String(p.title ?? ""),
      body = String(p.body ?? ""),
      draft = p.payload as BeaconDraft | undefined,
      requestedId = typeof p.id === "string" && p.id ? p.id : null;
    if (!(["ping", "vote", "draw"] as string[]).includes(kind))
      throw new Error("Choose a ping, vote council, or draw council.");
    if (requestedId) {
      const existing = planningThread(requestedId);
      if (existing) {
        if (existing.owner_id === uid) return d;
        throw new Error("That planning ID is already in use.");
      }
    }
    validatePlanningThreadDraft(
      kind,
      title,
      body,
      audience,
      audienceId,
      deadlineAt,
      Date.now(),
      draft,
    );
    if (draft) validatePlanningBeaconDraft(draft);
    if (Date.parse(deadlineAt) > Date.now() + 90 * 86400000)
      throw new Error("Choose a deadline within the next 90 days.");
    const coownerIds = p.coowner_ids ?? [];
    if (
      !Array.isArray(coownerIds) ||
      coownerIds.length > 10 ||
      coownerIds.some((candidate) => typeof candidate !== "string") ||
      new Set(coownerIds).size !== coownerIds.length ||
      coownerIds.some(
        (candidate) =>
          candidate === uid ||
          !canReadPlanningAudience(uid, audience, audienceId, candidate),
      )
    )
      throw new Error("Council co-owners must be eligible visible members.");
    d.planning_threads.push({
      id: requestedId ?? newId(),
      owner_id: uid,
      coowner_ids: [...coownerIds],
      kind,
      title: title.trim(),
      body,
      audience,
      audience_id: audienceId,
      deadline_at: deadlineAt,
      status: "open",
      payload: kind === "ping" ? structuredClone(draft!) : null,
      winner_proposal_id: null,
      replaced_from_proposal_id: null,
      materialized_activity_id: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    });
    return d;
  }
  if (action === "respond_planning_ping") {
    const thread = planningThread(String(p.thread_id ?? ""));
    if (
      !thread ||
      thread.kind !== "ping" ||
      thread.status !== "open" ||
      Date.parse(thread.deadline_at) <= Date.now() ||
      !canReadThread(thread)
    )
      throw new Error("This ping is no longer open to your response.");
    const response = String(p.response) as "interested" | "maybe" | "pass",
      autoRsvp = p.auto_rsvp === true;
    if (!["interested", "maybe", "pass"].includes(response))
      throw new Error("Choose interested, maybe, or pass.");
    if (autoRsvp && response !== "interested")
      throw new Error("Automatic RSVP is available with Interested.");
    const existing = d.planning_ping_responses.find(
      (item) => item.thread_id === thread.id && item.user_id === uid,
    );
    if (existing) {
      existing.response = response;
      existing.auto_rsvp = autoRsvp;
      existing.updated_at = new Date().toISOString();
    } else {
      const now = new Date().toISOString();
      d.planning_ping_responses.push({
        thread_id: thread.id,
        user_id: uid,
        response,
        auto_rsvp: autoRsvp,
        created_at: now,
        updated_at: now,
      });
    }
    return d;
  }
  if (action === "convert_planning_ping") {
    const thread = planningThread(String(p.thread_id ?? ""));
    if (!thread || thread.kind !== "ping" || thread.owner_id !== uid)
      throw new Error("Only the ping creator can make its beacon.");
    if (thread.materialized_activity_id) return d;
    if (thread.status !== "open" || !thread.payload)
      throw new Error("This ping can no longer be converted.");
    const activityId = materializePlanningBeacon(uid, thread.payload),
      activity = d.activities.find((item) => item.id === activityId)!;
    thread.status = "resolved";
    thread.resolved_at = new Date().toISOString();
    thread.materialized_activity_id = activityId;
    for (const response of d.planning_ping_responses) {
      if (
        response.thread_id !== thread.id ||
        response.response !== "interested" ||
        !response.auto_rsvp ||
        !canReadThread(thread, response.user_id)
      )
        continue;
      d.rsvps.push({
        activity_id: activityId,
        user_id: response.user_id,
        status:
          activity.approval_required || activity.mode === "invite"
            ? "requested"
            : "going",
        approved: false,
      });
    }
    return d;
  }
  if (action === "add_council_proposal") {
    const thread = planningThread(String(p.thread_id ?? "")),
      draft = p.payload as BeaconDraft | undefined;
    if (
      !thread ||
      (thread.kind !== "vote" && thread.kind !== "draw") ||
      thread.status !== "open" ||
      Date.parse(thread.deadline_at) <= Date.now() ||
      !canReadThread(thread)
    )
      throw new Error("This council is no longer open for proposals.");
    if (d.planning_proposals.filter((item) => item.thread_id === thread.id).length >= 30)
      throw new Error("This council has reached its proposal limit.");
    if (!draft) throw new Error("Add the proposed beacon details.");
    validateCouncilProposal(thread, draft);
    validatePlanningBeaconDraft(draft);
    if (draft.audience !== thread.audience || draft.audience_id !== thread.audience_id)
      throw new Error("The proposed beacon must use this council's audience.");
    const requestedId = typeof p.id === "string" && p.id ? p.id : newId(),
      existing = d.planning_proposals.find((item) => item.id === requestedId);
    if (existing) {
      if (existing.thread_id === thread.id && existing.author_id === uid) return d;
      throw new Error("That proposal ID is already in use.");
    }
    d.planning_proposals.push({
      id: requestedId,
      thread_id: thread.id,
      author_id: uid,
      payload: structuredClone(draft),
      approved: false,
      disqualified_at: null,
      created_at: new Date().toISOString(),
      activity_id: null,
    });
    return d;
  }
  if (action === "approve_council_proposal") {
    const thread = planningThread(String(p.thread_id ?? "")),
      proposal = d.planning_proposals.find(
        (item) => item.id === p.proposal_id && item.thread_id === p.thread_id,
      ),
      approved = p.approved === true;
    if (
      !thread ||
      (thread.kind !== "vote" && thread.kind !== "draw") ||
      thread.status !== "open" ||
      Date.parse(thread.deadline_at) <= Date.now() ||
      !canManageThread(thread) ||
      !proposal ||
      !canReadPlanningAudience(thread.owner_id, thread.audience, thread.audience_id, proposal.author_id)
    )
      throw new Error("Only a current council manager can approve visible options before the deadline.");
    if (approved) {
      if (Date.parse(proposal.payload.starts_at) <= Date.now())
        throw new Error("This option start time has passed.");
      validateCouncilProposal(thread, proposal.payload);
      validatePlanningBeaconDraft(proposal.payload);
    }
    proposal.approved = approved;
    return d;
  }
  if (action === "vote_council_proposal") {
    const thread = planningThread(String(p.thread_id ?? "")),
      proposal = d.planning_proposals.find(
        (item) => item.id === p.proposal_id && item.thread_id === p.thread_id,
      );
    if (
      !thread ||
      thread.kind !== "vote" ||
      thread.status !== "open" ||
      Date.parse(thread.deadline_at) <= Date.now() ||
      !canReadThread(thread) ||
      !proposal ||
      !proposal.approved ||
      proposal.disqualified_at ||
      Date.parse(proposal.payload.starts_at) <= Date.now() ||
      !canReadPlanningAudience(thread.owner_id, thread.audience, thread.audience_id, proposal.author_id) ||
      d.blocks.some((block) =>
        (block.blocker_id === uid && block.blocked_id === proposal.author_id) ||
        (block.blocker_id === proposal.author_id && block.blocked_id === uid)
      )
    )
      throw new Error("Choose an approved option that is still visible to you.");
    const existing = d.planning_votes.find(
      (item) => item.thread_id === thread.id && item.user_id === uid,
    );
    if (existing) existing.proposal_id = proposal.id;
    else
      d.planning_votes.push({
        thread_id: thread.id,
        proposal_id: proposal.id,
        user_id: uid,
        created_at: new Date().toISOString(),
      });
    return d;
  }
  if (action === "resolve_planning_thread") {
    const thread = planningThread(String(p.thread_id ?? ""));
    if (
      !thread ||
      thread.kind === "ping" ||
      !canManageThread(thread)
    )
      throw new Error("Only a current council manager can resolve this council.");
    if (thread.status !== "open") return d;
    if (Date.parse(thread.deadline_at) > Date.now())
      throw new Error("The council deadline has not arrived.");
    const approved = d.planning_proposals.filter(
      (proposal) =>
        proposal.thread_id === thread.id &&
        proposal.approved &&
        proposal.disqualified_at == null &&
        Date.parse(proposal.payload.starts_at) > Date.now() &&
        canReadPlanningAudience(thread.owner_id, thread.audience, thread.audience_id, proposal.author_id),
    );
    if (!approved.length) {
      thread.status = d.planning_proposals.some(
        (proposal) =>
          proposal.thread_id === thread.id &&
          proposal.approved &&
          proposal.disqualified_at == null &&
          canReadPlanningAudience(thread.owner_id, thread.audience, thread.audience_id, proposal.author_id),
      )
        ? "expired"
        : "no_options";
      thread.resolved_at = new Date().toISOString();
      return d;
    }
    const ordered = [...approved].sort((first, second) => {
      const firstVotes = d.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id &&
            vote.proposal_id === first.id &&
            canReadThread(thread, vote.user_id) &&
            !d.blocks.some((block) =>
              (block.blocker_id === vote.user_id && block.blocked_id === first.author_id) ||
              (block.blocker_id === first.author_id && block.blocked_id === vote.user_id)
            ),
        ).length,
        secondVotes = d.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id &&
            vote.proposal_id === second.id &&
            canReadThread(thread, vote.user_id) &&
            !d.blocks.some((block) =>
              (block.blocker_id === vote.user_id && block.blocked_id === second.author_id) ||
              (block.blocker_id === second.author_id && block.blocked_id === vote.user_id)
            ),
        ).length;
      return secondVotes - firstVotes ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id);
    });
    const winner = thread.kind === "draw"
      ? approved[Math.floor(Math.random() * approved.length)]
      : ordered[0];
    const activityId = materializePlanningBeacon(thread.owner_id, winner.payload);
    winner.activity_id = activityId;
    thread.status = "resolved";
    thread.winner_proposal_id = winner.id;
    thread.materialized_activity_id = activityId;
    thread.resolved_at = new Date().toISOString();
    return d;
  }
  if (action === "replace_council_winner") {
    const thread = planningThread(String(p.thread_id ?? ""));
    if (
      !thread ||
      thread.kind === "ping" ||
      thread.status !== "resolved" ||
      !canManageThread(thread) ||
      p.confirm_cancel_previous !== true
    )
      throw new Error("Confirm replacing the current council winner.");
    const expectedWinnerId = String(p.expected_winner_proposal_id ?? "");
    if (expectedWinnerId === thread.replaced_from_proposal_id) return d;
    if (expectedWinnerId !== thread.winner_proposal_id)
      throw new Error("The council winner changed. Refresh before trying again.");
    const currentActivity = d.activities.find(
        (activity) => activity.id === thread.materialized_activity_id,
      ),
      previousProposal = d.planning_proposals.find(
        (proposal) => proposal.id === thread.winner_proposal_id,
      );
    if (
      !currentActivity ||
      currentActivity.status !== "scheduled" ||
      Date.parse(currentActivity.starts_at) <= Date.now() ||
      !previousProposal
    )
      throw new Error("The current winner has started or is no longer replaceable.");
    const alternatives = d.planning_proposals.filter(
      (proposal) =>
        proposal.thread_id === thread.id &&
        proposal.id !== previousProposal.id &&
        proposal.approved &&
        proposal.disqualified_at == null &&
        proposal.activity_id == null &&
        Date.parse(proposal.payload.starts_at) > Date.now() &&
        canReadPlanningAudience(thread.owner_id, thread.audience, thread.audience_id, proposal.author_id),
    );
    if (!alternatives.length)
      throw new Error("There is no other approved option that can still take place.");
    alternatives.sort((first, second) => {
      const firstVotes = d.planning_votes.filter(
          (vote) => vote.thread_id === thread.id && vote.proposal_id === first.id,
        ).length,
        secondVotes = d.planning_votes.filter(
          (vote) => vote.thread_id === thread.id && vote.proposal_id === second.id,
        ).length;
      return secondVotes - firstVotes ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id);
    });
    const replacement = thread.kind === "draw"
      ? alternatives[Math.floor(Math.random() * alternatives.length)]
      : alternatives[0];
    currentActivity.status = "cancelled";
    previousProposal.disqualified_at = new Date().toISOString();
    const activityId = materializePlanningBeacon(thread.owner_id, replacement.payload);
    replacement.activity_id = activityId;
    thread.replaced_from_proposal_id = previousProposal.id;
    thread.winner_proposal_id = replacement.id;
    thread.materialized_activity_id = activityId;
    return d;
  }
  if (action === "favorite") {
    d.favorites = d.favorites.filter(
      (f) => !(f.owner_id === uid && f.kind === p.kind && f.target_id === id),
    );
    if (p.add)
      d.favorites.push({
        owner_id: uid,
        kind: p.kind as "friend" | "squad",
        target_id: id,
      });
  }
  if (action === "save_template") {
    if (!String(p.name ?? "").trim() || !String(p.title ?? "").trim())
      throw new Error("Give your template a name and activity.");
    const minutes = Number(p.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)
      throw new Error("Choose a duration from 5 to 1440 minutes.");
    const existing = d.templates.find((t) => t.id === id && t.owner_id === uid);
    const template = {
      id: existing?.id ?? newId(),
      owner_id: uid,
      name: String(p.name).trim(),
      title: String(p.title).trim(),
      description: String(p.description ?? ""),
      category: p.category as any,
      minutes,
      label: String(p.label ?? ""),
      target_count: p.target_count == null ? null : Number(p.target_count),
      approval_required: !!p.approval_required,
    };
    if (existing) Object.assign(existing, template);
    else d.templates.push(template);
  }
  if (action === "delete_template")
    d.templates = d.templates.filter((t) => t.id !== id || t.owner_id !== uid);
  if (action === "send_message") {
    const body = String(p.body ?? "").trim();
    if (!body || body.length > 2000)
      throw new Error("Write a message of 1 to 2000 characters.");
    const a = d.activities.find((a) => a.id === p.activity_id);
    if (p.activity_id && (!a || !canChat(d, a, uid)))
      throw new Error("Join this beacon before entering its chat.");
    if (a && !canWriteBeaconModule(d, a, uid, "chat"))
      throw new Error("Chat is paused or unavailable for this beacon.");
    if (
      !p.activity_id &&
      !d.friendships.some(
        (f) =>
          f.status === "accepted" &&
          ((f.sender_id === uid && f.recipient_id === p.recipient_id) ||
            (f.recipient_id === uid && f.sender_id === p.recipient_id)),
      )
    )
      throw new Error("Connect as friends to message.");
    d.messages.push({
      id: newId(),
      author_id: uid,
      activity_id: a?.id ?? null,
      recipient_id: p.recipient_id ? String(p.recipient_id) : null,
      body,
      created_at: new Date().toISOString(),
    });
  }
  if (action === "add_checklist_item" || action === "add_beacon_note") {
    const activityId = String(p.activity_id ?? ""),
      activity = d.activities.find((item) => item.id === activityId),
      isNote = action === "add_beacon_note",
      module = isNote ? "journal" : "checklist",
      field = isNote ? "body" : "text",
      value = typeof p[field] === "string" ? p[field].trim() : "",
      maximum = isNote ? 1000 : 160;
    if (
      !activity ||
      !canWriteBeaconModule(d, activity, uid, module) ||
      !(isNote
        ? canAddBeaconNote(d, activity, uid)
        : canEditBeaconChecklist(d, activity, uid))
    )
      throw new Error("Join this beacon before using its tools.");
    if (!value || value.length > maximum)
      throw new Error(`Write ${isNote ? "1 to 1000 characters" : "1 to 160 characters"}.`);
    const rowId = typeof p.id === "string" && p.id ? p.id : newId();
    if (isNote) {
      const duplicate = d.beacon_notes.find((item) => item.id === rowId);
      if (duplicate) {
        if (
          duplicate.activity_id !== activityId ||
          duplicate.author_id !== uid ||
          duplicate.body !== value
        )
          throw new Error("This item ID is already in use.");
      } else {
        if (
          d.beacon_notes.filter((item) => item.activity_id === activityId)
            .length >= 50
        )
          throw new Error("This beacon already has 50 notes.");
      d.beacon_notes.push({
          id: rowId,
          activity_id: activityId,
          author_id: uid,
          body: value,
          revision: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      const duplicate = d.beacon_checklist_items.find(
        (item) => item.id === rowId,
      );
      if (duplicate) {
        if (
          duplicate.activity_id !== activityId ||
          duplicate.author_id !== uid ||
          duplicate.text !== value
        )
          throw new Error("This item ID is already in use.");
      } else {
        if (
          d.beacon_checklist_items.filter(
            (item) => item.activity_id === activityId,
          ).length >= 50
        )
          throw new Error("This beacon already has 50 checklist items.");
        d.beacon_checklist_items.push({
          id: rowId,
          activity_id: activityId,
          author_id: uid,
          text: value,
          completed: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }
  if (action === "toggle_checklist_item") {
    const item = d.beacon_checklist_items.find((entry) => entry.id === id),
      activity = d.activities.find((entry) => entry.id === item?.activity_id);
    if (!item || !activity || !canEditBeaconChecklist(d, activity, uid) ||
      !canWriteBeaconModule(d, activity, uid, "checklist") ||
      d.blocks.some((block) =>
        (block.blocker_id === uid && block.blocked_id === item.author_id) ||
        (block.blocked_id === uid && block.blocker_id === item.author_id)))
      throw new Error("This checklist item is unavailable.");
    if (typeof p.completed !== "boolean")
      throw new Error("Choose whether this checklist item is complete.");
    item.completed = p.completed;
  }
  if (action === "delete_checklist_item" || action === "delete_beacon_note") {
    const isNote = action === "delete_beacon_note",
      rows = isNote ? d.beacon_notes : d.beacon_checklist_items,
      item = rows.find((entry) => entry.id === id),
      activity = d.activities.find((entry) => entry.id === item?.activity_id);
    if (!item || !activity || !canDeleteBeaconModuleEntry(d, activity, item.author_id, uid) ||
      !canWriteBeaconModule(d, activity, uid, isNote ? "journal" : "checklist") ||
      (!isNote && !canEditBeaconChecklist(d, activity, uid)))
      throw new Error("This item is unavailable or cannot be deleted.");
    if (isNote)
      d.beacon_notes = d.beacon_notes.filter((entry) => entry.id !== id);
    else
      d.beacon_checklist_items = d.beacon_checklist_items.filter((entry) => entry.id !== id);
  }
  if (action === "edit_beacon_note") {
    const note = d.beacon_notes.find((entry) => entry.id === id),
      activity = d.activities.find((entry) => entry.id === note?.activity_id),
      body = typeof p.body === "string" ? p.body.trim() : "",
      expectedRevision = Number(p.expected_revision);
    if (!note || !activity || !canWriteBeaconModule(d, activity, uid, "journal"))
      throw new Error("This beacon journal is paused or unavailable.");
    if (note.author_id !== uid || !canAddBeaconNote(d, activity, uid))
      throw new Error("Only the note author can edit this shared note.");
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
      throw new Error("Refresh the note before editing it.");
    if (note.revision === expectedRevision + 1 && note.body === body) return d;
    if (note.revision !== expectedRevision)
      throw new Error("This note changed. Your draft is still here; refresh and resolve before saving.");
    if (!body || body.length > 1000)
      throw new Error("Write a note of 1 to 1000 characters.");
    note.body = body;
    note.revision += 1;
    note.updated_at = new Date().toISOString();
  }
  if (
    action === "create_library_folder" ||
    action === "rename_library_folder"
  ) {
    const kind = String(p.kind ?? "") as LibraryKind,
      name = String(p.name ?? "").trim(),
      editing = action === "rename_library_folder",
      folder = editing
        ? d.library_folders.find((item) => item.id === id && item.owner_id === uid)
        : undefined;
    if (kind !== "journal" && kind !== "checklist")
      throw new Error("Choose Journals or Checklists for this folder.");
    if (editing && (!folder || folder.kind !== kind))
      throw new Error("That private folder is unavailable.");
    if (!name || name.length > 40)
      throw new Error("Folder names must be 1 to 40 characters.");
    if (!editing) {
      const requestedId = typeof p.id === "string" && p.id ? p.id : null,
        existingId = requestedId
          ? d.library_folders.find((item) => item.id === requestedId)
          : undefined;
      if (existingId) {
        if (
          existingId.owner_id === uid &&
          existingId.kind === kind &&
          existingId.name === name
        )
          return d;
        throw new Error("This folder ID is already in use.");
      }
      const sameName = d.library_folders.find(
        (item) =>
          item.owner_id === uid &&
          item.kind === kind &&
          item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (sameName) {
        if (!requestedId) return d;
        throw new Error("You already have a folder with that name.");
      }
    } else if (
      d.library_folders.some(
        (item) =>
          item.owner_id === uid &&
          item.kind === kind &&
          item.id !== folder?.id &&
          item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      throw new Error("You already have a folder with that name.");
    }
    if (folder) {
      if (folder.name !== name) {
        folder.name = name;
        folder.updated_at = new Date().toISOString();
      }
    } else {
      if (d.library_folders.filter((item) => item.owner_id === uid && item.kind === kind).length >= 30)
        throw new Error("You can create up to 30 folders in each library.");
      const now = new Date().toISOString();
      const folderId = typeof p.id === "string" && p.id ? p.id : newId();
      d.library_folders.push({
        id: folderId,
        owner_id: uid,
        kind,
        name,
        created_at: now,
        updated_at: now,
      });
    }
  }
  if (action === "delete_library_folder") {
    const folder = d.library_folders.find(
      (item) => item.id === id && item.owner_id === uid,
    );
    if (!folder) throw new Error("That private folder is unavailable.");
    d.library_folders = d.library_folders.filter((item) => item.id !== id);
    d.library_folder_items = d.library_folder_items.filter(
      (item) => item.folder_id !== id,
    );
  }
  if (action === "move_library_item") {
    const kind = String(p.kind ?? "") as LibraryKind,
      activityId = String(p.activity_id ?? ""),
      activity = d.activities.find((item) => item.id === activityId),
      folderId = p.folder_id == null ? null : String(p.folder_id);
    if (
      !activity ||
      (kind !== "journal" && kind !== "checklist") ||
      !canUseBeaconModules(d, activity, uid)
    )
      throw new Error("This shared beacon library is unavailable.");
    const existingIndex = d.library_folder_items.findIndex(
      (item) =>
        item.owner_id === uid &&
        item.kind === kind &&
        item.activity_id === activityId,
    );
    if (folderId) {
      const folder = d.library_folders.find(
        (item) =>
          item.id === folderId && item.owner_id === uid && item.kind === kind,
      );
      if (!folder) throw new Error("Choose one of your folders in this library.");
      const assignment = {
        owner_id: uid,
        kind,
        activity_id: activityId,
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        if (d.library_folder_items[existingIndex].folder_id !== folderId)
          d.library_folder_items[existingIndex] = assignment;
      }
      else d.library_folder_items.push(assignment);
    } else if (existingIndex >= 0) {
      d.library_folder_items.splice(existingIndex, 1);
    }
  }
  if (action === "save_profile") {
    if (Object.hasOwn(p, "identity_tags")) {
      if (
        !Array.isArray(p.identity_tags) ||
        p.identity_tags.length > 50 ||
        p.identity_tags.some(
          (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 60,
        )
      )
        throw new Error("Choose up to 50 valid identity tags.");
      p.identity_tags = [...new Set((p.identity_tags as string[]).map((tag) => tag.trim()))];
    }
    if (Object.hasOwn(p, "aspiration_goals")) {
      if (!Array.isArray(p.aspiration_goals) || p.aspiration_goals.length > 20)
        throw new Error("Choose up to 20 aspirations.");
      p.aspiration_goals = p.aspiration_goals.map((item) => {
        const goal = item as Record<string, unknown>;
        const title = typeof goal.title === "string" ? goal.title.trim() : "",
          category = typeof goal.category === "string" ? goal.category.trim() : "",
          target = Number(goal.target_per_week);
        if (
          typeof goal.id !== "string" || !goal.id.trim() ||
          !title || title.length > 100 || !category || category.length > 60 ||
          !Number.isInteger(target) || target < 1 || target > 7
        )
          throw new Error("Check each aspiration and its weekly target.");
        return { id: goal.id, title, category, target_per_week: target };
      });
    }
    if (
      Object.hasOwn(p, "onboarding_survey_status") &&
      !["pending", "skipped", "completed"].includes(
        String(p.onboarding_survey_status),
      )
    )
      throw new Error("Choose a valid survey status.");
    Object.assign(currentProfile, p);
  }
  if (action === "save_plan_template") {
    const squadId = p.squad_id == null ? null : String(p.squad_id),
      title = String(p.title ?? "").trim(),
      description = String(p.description ?? "").trim(),
      timezone = String(p.timezone ?? ""),
      rawSteps = validatePlanSteps(p.steps),
      steps = squadId
        ? rawSteps.map((step) => ({ ...step, aspiration_ids: [] }))
        : rawSteps;
    if (!title || title.length > 100 || description.length > 1000)
      throw new Error("Add a template title and a description under 1000 characters.");
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    if (squadId && !isSquadAdmin(squadId))
      throw new Error("Only squad admins can edit squad plan templates.");
    const existing = d.plan_templates.find((template) => template.id === id);
    if (
      existing &&
      (existing.owner_id !== uid || existing.squad_id !== squadId) &&
      !(existing.squad_id && isSquadAdmin(existing.squad_id))
    )
      throw new Error("Template unavailable.");
    if (existing && existing.squad_id !== squadId)
      throw new Error("Template scope cannot be changed.");
    const now = new Date().toISOString(),
      template = {
        id: existing?.id ?? newId(),
        owner_id: existing?.owner_id ?? uid,
        squad_id: squadId,
        title,
        description,
        timezone,
        steps,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
    if (existing) Object.assign(existing, template);
    else d.plan_templates.push(template);
  }
  if (action === "delete_plan_template") {
    const template = d.plan_templates.find((item) => item.id === id);
    if (!template) throw new Error("Template unavailable.");
    if (
      template.squad_id
        ? !isSquadAdmin(template.squad_id)
        : template.owner_id !== uid
    )
      throw new Error("You cannot delete this template.");
    d.plan_templates = d.plan_templates.filter((item) => item.id !== id);
  }
  if (action === "create_plan") {
    const squadId = p.squad_id == null ? null : String(p.squad_id),
      title = String(p.title ?? "").trim(),
      description = String(p.description ?? "").trim(),
      timezone = String(p.timezone ?? ""),
      startDate = String(p.start_date ?? "");
    if (!title || title.length > 100 || description.length > 1000)
      throw new Error("Add a plan title and a description under 1000 characters.");
    if (squadId && !isSquadMember(squadId))
      throw new Error("Join that squad before creating a plan for it.");
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    planStartDateIsValid(startDate, timezone);
    let steps;
    if (p.template_id) {
      const template = d.plan_templates.find((item) => item.id === p.template_id);
      if (
        !template ||
        (template.squad_id
          ? template.squad_id !== squadId || !isSquadMember(template.squad_id)
          : template.owner_id !== uid)
      )
        throw new Error("That plan template is unavailable.");
      steps = validatePlanSteps(p.steps ?? template.steps);
    } else steps = validatePlanSteps(p.steps);
    steps.forEach((step) => checkAspirationIds(step.aspiration_ids ?? []));
    const scheduled = buildPlanSchedule(startDate, timezone, steps);
    if (detectPlanStepOverlaps(scheduled).length)
      throw new Error("Beacons in a plan cannot overlap. Choose a suggested time.");
    const planId = newId(),
      createdAt = new Date().toISOString();
    d.plans.push({
      id: planId,
      owner_id: uid,
      squad_id: squadId,
      title,
      description,
      timezone,
      start_date: startDate,
      status: "scheduled",
      created_at: createdAt,
    });
    for (const occurrence of scheduled) {
      const activityId = newId(),
        step = occurrence.step;
      d.activities.push({
        id: activityId,
        owner_id: uid,
        title: step.title,
        description: step.description,
        target_count: null,
        category: step.category,
        mode: squadId ? "squad" : "solo",
        starts_at: occurrence.starts_at,
        ends_at: occurrence.ends_at,
        timezone,
        approval_required: false,
        status: "scheduled",
        goal_id: null,
        habit_id: null,
        plan_id: planId,
        plan_step_index: occurrence.step_index,
        aspiration_ids: checkAspirationIds(step.aspiration_ids ?? []),
        audience: squadId ? "squad" : "private",
        audience_id: squadId,
      });
      d.places.push({
        activity_id: activityId,
        label: step.location_name,
        latitude: step.lat,
        longitude: step.lng,
        online_url: null,
      });
    }
  }
  if (action === "cancel_plan") {
    const plan = d.plans.find((item) => item.id === id && item.owner_id === uid);
    if (!plan) throw new Error("Plan unavailable.");
    plan.status = "cancelled";
    for (const activity of d.activities) {
      if (activity.plan_id === plan.id && activity.status === "scheduled")
        activity.status = "cancelled";
    }
  }
  if (action === "create_activity") {
    validateActivity(p);
    const controls = validateBeaconControlValues({
      capacity_limit: p.capacity_limit ?? null,
      capacity_policy: p.capacity_policy ?? "soft",
      manual_closed: p.manual_closed ?? false,
      enable_chat: p.enable_chat ?? true,
      enable_checklist: p.enable_checklist ?? true,
      enable_journal: p.enable_journal ?? true,
      enable_experiences: p.enable_experiences ?? true,
      enable_focus: p.enable_focus ?? true,
      enable_reactions: p.enable_reactions ?? true,
      music_url: p.music_url ?? null,
      decoration_emoji: p.decoration_emoji ?? null,
      decoration_accent: p.decoration_accent ?? null,
    });
    const aid = newId();
    d.activities.push({
      id: aid,
      owner_id: uid,
      title: String(p.title),
      available: !!p.available,
      description: String(p.description ?? ""),
      target_count: p.target_count == null ? null : Number(p.target_count),
      category: p.category as any,
      mode: p.mode as any,
      starts_at: String(p.starts_at),
      ends_at: String(p.ends_at),
      timezone: String(p.timezone),
      approval_required: !!p.approval_required,
      status: "scheduled",
      goal_id: p.goal_id as string | null,
      habit_id: p.habit_id as string | null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: checkAspirationIds(p.aspiration_ids ?? []),
      audience: p.audience as any,
      audience_id: p.audience_id as string | null,
      ...controls,
    });
    d.places.push({
      activity_id: aid,
      label: String(p.label ?? ""),
      latitude: p.latitude as number | null,
      longitude: p.longitude as number | null,
      online_url: p.online_url as string | null,
    });
  }
  if (action === "rsvp") {
    const activity = d.activities.find((item) => item.id === id),
      existing = d.rsvps.find((item) => item.activity_id === id && item.user_id === uid),
      invite = d.beacon_invitation_grants.find(
        (item) => item.activity_id === id && item.user_id === uid,
      );
    if (
      !activity ||
      activity.owner_id === uid ||
      activity.mode === "solo" ||
      activity.status !== "scheduled" ||
      Date.parse(activity.ends_at) <= Date.now() ||
      !canReadBeaconActivity(d, activity, uid)
    )
      throw new Error("This beacon is not open for joining.");
    if (p.status === "withdraw") {
      d.rsvps = d.rsvps.filter(
        (item) => !(item.activity_id === id && item.user_id === uid),
      );
      if (invite)
        d.rsvps.push({
          activity_id: id,
          user_id: uid,
          status: "invited",
          approved: true,
        });
      return d;
    }
    if (p.status !== "going" && p.status !== "interested")
      throw new Error("Choose I'm In, Request, Interested, or I'm Out.");
    if (p.status === "going") {
      if (isApprovedGoing(activity, existing) || existing?.status === "requested")
        return d;
      const requestsApproval =
        (activity.approval_required || activity.mode === "invite") &&
        !existing?.approved;
      if (
        activity.manual_closed ||
        beaconCapacity(d, activity).full
      )
        throw new Error("This beacon is closed or full.");
      d.rsvps = d.rsvps.filter(
        (item) => !(item.activity_id === id && item.user_id === uid),
      );
      d.rsvps.push({
        activity_id: id,
        user_id: uid,
        status: requestsApproval ? "requested" : "going",
        approved: existing?.approved ?? false,
      });
      return d;
    }
    d.rsvps = d.rsvps.filter(
      (item) => !(item.activity_id === id && item.user_id === uid),
    );
    d.rsvps.push({
      activity_id: id,
      user_id: uid,
      status: "interested",
      approved: existing?.approved ?? false,
    });
    return d;
  }
  if (action === "open_status") {
    const a = d.activities.find((x) => x.id === id);
    if (
      !a ||
      a.owner_id !== uid ||
      a.mode !== "solo" ||
      a.status !== "scheduled" ||
      Date.parse(a.ends_at) <= Date.now()
    )
      throw new Error("This status cannot be opened.");
    a.mode = "squad";
    a.approval_required = false;
  }
  if (action === "activity_status")
    d.activities.find((x) => x.id === id)!.status = p.status as any;
  if (action === "edit_activity") {
    validateActivity(p);
    const activity = d.activities.find((x) => x.id === id)!;
    Object.assign(activity, {
      title: p.title,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      ...(Object.hasOwn(p, "aspiration_ids")
        ? { aspiration_ids: checkAspirationIds(p.aspiration_ids) }
        : {}),
    });
  }
  if (action === "invite_activity") {
    const activity = d.activities.find((item) => item.id === id),
      targetId = typeof p.user_id === "string" ? p.user_id : "",
      existing = d.rsvps.find(
        (item) => item.activity_id === id && item.user_id === targetId,
      );
    if (
      !activity ||
      activity.mode === "solo" ||
      activity.status !== "scheduled" ||
      !canAdmitBeaconParticipants(d, activity, uid) ||
      targetId === uid ||
      !isFriend(targetId) ||
      d.blocks.some((block) =>
        (block.blocker_id === activity.owner_id && block.blocked_id === targetId) ||
        (block.blocked_id === activity.owner_id && block.blocker_id === targetId),
      )
    )
      throw new Error("Invite an accepted friend to an active beacon.");
    if (existing && ["going", "requested", "invited"].includes(existing.status))
      return d;
    d.rsvps = d.rsvps.filter(
      (item) => !(item.activity_id === id && item.user_id === targetId),
    );
    d.rsvps.push({ activity_id: id, user_id: targetId, status: "invited", approved: true });
    if (!d.beacon_invitation_grants.some(
      (item) => item.activity_id === id && item.user_id === targetId,
    ))
      d.beacon_invitation_grants.push({
        activity_id: id,
        user_id: targetId,
        invited_by: uid,
        created_at: new Date().toISOString(),
      });
  }
  if (action === "approve_rsvp") {
    const activity = d.activities.find((item) => item.id === id),
      targetId = String(p.user_id ?? ""),
      request = d.rsvps.find(
        (item) => item.activity_id === id && item.user_id === targetId,
      );
    if (!activity || !request || request.status !== "requested" ||
      !canAdmitBeaconParticipants(d, activity, uid))
      throw new Error("Only a beacon manager can approve a pending request.");
    if (activity.manual_closed || beaconCapacity(d, activity).full)
      throw new Error("This beacon is closed or full.");
    request.approved = true;
    request.status = "going";
  }
  if (action === "remove_rsvp") {
    const activity = d.activities.find((item) => item.id === id),
      targetId = String(p.user_id ?? "");
    if (!activity || !canRemoveBeaconParticipant(d, activity, uid, targetId))
      throw new Error("Your role cannot remove this participant.");
    d.rsvps = d.rsvps.filter(
      (item) => !(item.activity_id === id && item.user_id === targetId),
    );
    d.beacon_roles = d.beacon_roles.filter(
      (item) => !(item.activity_id === id && item.user_id === targetId),
    );
    d.beacon_invitation_grants = d.beacon_invitation_grants.filter(
      (item) => !(item.activity_id === id && item.user_id === targetId),
    );
  }
  if (action === "comment") {
    const activity = d.activities.find((item) => item.id === id);
    if (!activity || !canWriteBeaconModule(d, activity, uid, "experiences"))
      throw new Error("Experiences are paused or unavailable for this beacon.");
    d.comments.push({
      id: newId(),
      activity_id: id,
      author_id: uid,
      body: String(p.body),
      created_at: new Date().toISOString(),
    });
  }
  if (action === "react") {
    const activity = d.activities.find((item) => item.id === id);
    if (!activity || !canWriteBeaconModule(d, activity, uid, "reactions"))
      throw new Error("Reactions are paused or unavailable for this beacon.");
    d.reactions = d.reactions.filter(
      (x) => !(x.activity_id === id && x.user_id === uid),
    );
    d.reactions.push({ activity_id: id, user_id: uid, emoji: "🙌" });
  }
  if (action === "save_goal") {
    if (id)
      Object.assign(
        d.goals.find((x) => x.id === id)!,
        p,
      );
    else
      d.goals.push({
        id: newId(),
        owner_id: uid,
        title: String(p.title),
        description: String(p.description ?? ""),
        target_date: p.target_date as string | null,
        progress: 0,
        audience: (p.audience as any) ?? "private",
        audience_id: (p.audience_id as string | null) ?? null,
      });
  }
  if (action === "milestone") {
    if (p.milestone_id) {
      const m = d.milestones.find((x) => x.id === p.milestone_id)!;
      m.done = !m.done;
    } else
      d.milestones.push({
        id: newId(),
        goal_id: id,
        title: String(p.title),
        done: false,
      });
  }
  if (action === "save_habit")
    d.habits.push({ ...p, id: newId(), owner_id: uid } as any);
  if (action === "checkin") {
    const habit = d.habits.find((x) => x.id === id)!;
    const date = localDate(new Date(), habit.timezone);
    if (!d.checkins.some((x) => x.habit_id === id && x.local_date === date))
      d.checkins.push({
        id: newId(),
        habit_id: id,
        owner_id: uid,
        local_date: date,
      });
  }
  if (action === "create_squad") {
    const sid = newId();
    d.squads.push({
      id: sid,
      owner_id: uid,
      name: String(p.name),
      description: String(p.description ?? ""),
    });
    d.squad_members.push({ squad_id: sid, user_id: uid, role: "owner" });
  }
  if (action === "create_list")
    d.lists.push({ id: newId(), owner_id: uid, name: String(p.name) });
  if (action === "list_member") {
    d.list_members = d.list_members.filter(
      (x) => !(x.list_id === id && x.user_id === p.user_id),
    );
    if (p.add) d.list_members.push({ list_id: id, user_id: String(p.user_id) });
  }
  if (action === "friend_request") {
    const person = d.profiles.find((x) => x.username === p.username);
    if (!person)
      throw new Error(
        "No demo profile has that username. Try a real account to invite friends.",
      );
    if (
      !d.friendships.some((x) =>
        [x.sender_id, x.recipient_id].includes(person.id),
      )
    )
      d.friendships.push({
        id: newId(),
        sender_id: uid,
        recipient_id: person.id,
        status: "pending",
      });
  }
  if (action === "accept_friend")
    d.friendships.find((x) => x.id === id)!.status = "accepted";
  if (action === "invite_squad")
    d.squad_invites.push({
      id: newId(),
      squad_id: id,
      sender_id: uid,
      recipient_id: String(p.user_id),
    });
  if (action === "accept_squad") {
    const invite = d.squad_invites.find((x) => x.id === id)!;
    d.squad_members.push({
      squad_id: invite.squad_id,
      user_id: uid,
      role: "member",
    });
    d.squad_invites = d.squad_invites.filter((x) => x.id !== id);
  }
  if (action === "remove_member")
    d.squad_members = d.squad_members.filter(
      (x) => !(x.squad_id === id && x.user_id === p.user_id),
    );
  if (action === "block") {
    d.blocks.push({ blocker_id: uid, blocked_id: id });
    d.profiles = d.profiles.filter((x) => x.id !== id);
    d.activities = d.activities.filter((x) => x.owner_id !== id);
    d.comments = d.comments.filter((x) => x.author_id !== id);
    d.beacon_checklist_items = d.beacon_checklist_items.filter(
      (x) => x.author_id !== id && !d.activities.every((a) => a.id !== x.activity_id),
    );
    d.beacon_notes = d.beacon_notes.filter(
      (x) => x.author_id !== id && !d.activities.every((a) => a.id !== x.activity_id),
    );
    d.friendships = d.friendships.filter(
      (x) => ![x.sender_id, x.recipient_id].includes(id),
    );
  }
  if (action === "report")
    d.reports.push({
      id: newId(),
      reporter_id: uid,
      subject_id: id,
      reason: String(p.reason),
      created_at: new Date().toISOString(),
      resolved: false,
    });
  if (action === "read_notices")
    d.notices = d.notices.map((n) => ({
      ...n,
      read_at: new Date().toISOString(),
    }));
  if (action === "start_location")
    throw new Error(
      "Live location is available only with a connected account. Demo never shares your location.",
    );
  return d;
}
