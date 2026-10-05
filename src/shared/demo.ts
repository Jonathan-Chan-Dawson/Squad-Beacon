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
  beaconControlValuesFromActivity,
  canSetStrictCapacity,
  defaultBeaconControlValues,
  validateBeaconControlValues,
  type BeaconControlValues,
} from "@/src/features/beacons/controls";
import { applyDemoModuleCollectionAction } from "@/src/features/beacons/moduleCollections";
import { applyDemoBeaconMediaTeamAction } from "@/src/features/beacons/models";
import {
  makeRoutineDemo,
  applyPlanRoutineDemo,
  type PlanRoutineDemoAction,
} from "@/src/features/plans/routines";
import type {
  BeaconDraft,
  Data,
  LibraryKind,
  Payload,
  PlanningThread,
  Squad,
} from "@/src/shared/types";
import type { Space } from "@/src/features/spaces/types";
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
import {
  activeOrganizationRole,
  canChangeOrganizationMemberRole,
  canInviteOrganizationRole,
  canLeaveOrganization,
  canManageOrganization,
  canManageOrganizationMember,
  canManageOrganizationSquads,
} from "@/src/features/organizations/domain";
import type {
  GroupMessageScope,
  Organization,
  OrganizationMemberRole,
} from "@/src/features/organizations/types";
import { canInviteWithPolicy, SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import type { ActivitySocialLink, InvitePolicy, SocialMemberRole, SocialRole } from "@/src/features/social/types";
import { makeDemo as makeNeighborhoodDemo } from "@/tests/fixtures/neighborhood";
export const DEMO_ID = "demo-you";
export function makeDemo(): Data {
  const data = makeNeighborhoodDemo(),
    createdAt = new Date().toISOString(),
    activityId = "demo-tools",
    startsAt = new Date(Date.now() + 86400000).toISOString();
  const now = Date.now();
  data.viewer_id = DEMO_ID;
  data.is_demo = true;
  const organizationId = "org-lakefront-collective";
  data.organizations = [
    {
      id: organizationId,
      owner_id: "maya",
      name: "Lakefront Collective",
      description:
        "Friends making room for movement, good food, and small adventures.",
      created_at: new Date(now - 60 * 86400000).toISOString(),
      member_count: 4,
      discoverability: "public",
      join_mode: "open",
      invite_policy: "elders",
    },
  ];
  data.organization_members = [
    {
      organization_id: organizationId,
      user_id: DEMO_ID,
      role: "elder",
      status: "active",
      invited_by: "maya",
      created_at: new Date(now - 45 * 86400000).toISOString(),
    },
    {
      organization_id: organizationId,
      user_id: "jordan",
      role: "admin",
      status: "active",
      invited_by: "maya",
      created_at: new Date(now - 42 * 86400000).toISOString(),
    },
    {
      organization_id: organizationId,
      user_id: "sam",
      role: "member",
      status: "active",
      invited_by: "jordan",
      created_at: new Date(now - 35 * 86400000).toISOString(),
    },
  ];
  data.organization_squads = ["boxing", "weekend"].map((squad_id) => ({
    organization_id: organizationId,
    squad_id,
    added_by: "maya",
    created_at: new Date(now - 30 * 86400000).toISOString(),
  }));
  const spaceId = "space-neighborhood-studio";
  data.spaces = [
    {
      id: spaceId,
      owner_id: DEMO_ID,
      name: "Neighborhood Studio",
      description: "A small independent space for practice and shared routines.",
      created_at: new Date(now - 24 * 86400000).toISOString(),
      space_type: "interest",
      discoverability: "private",
      join_mode: "invite",
      invite_policy: "admins",
    },
  ];
  data.space_members = [
    {
      space_id: spaceId,
      user_id: DEMO_ID,
      role: "owner",
      status: "active",
      invited_by: null,
      created_at: new Date(now - 24 * 86400000).toISOString(),
    },
    {
      space_id: spaceId,
      user_id: "jordan",
      role: "member",
      status: "active",
      invited_by: DEMO_ID,
      created_at: new Date(now - 20 * 86400000).toISOString(),
    },
  ];
  data.space_squads = [
    {
      space_id: spaceId,
      squad_id: "boxing",
      added_by: DEMO_ID,
      created_at: new Date(now - 18 * 86400000).toISOString(),
    },
  ];
  data.organization_spaces = [
    {
      organization_id: organizationId,
      space_id: spaceId,
      added_by: DEMO_ID,
      created_at: new Date(now - 18 * 86400000).toISOString(),
    },
  ];
  data.group_messages = [
    {
      id: "org-chat-1",
      scope: "organization",
      scope_id: organizationId,
      organization_id: organizationId,
      squad_id: null,
      author_id: "maya",
      body: "Saturday trail loop is on. Anyone want to bring snacks?",
      created_at: new Date(now - 26 * 60000).toISOString(),
    },
    {
      id: "org-chat-2",
      scope: "organization",
      scope_id: organizationId,
      organization_id: organizationId,
      squad_id: null,
      author_id: DEMO_ID,
      body: "I can bring fruit and a thermos.",
      created_at: new Date(now - 18 * 60000).toISOString(),
    },
    {
      id: "squad-chat-1",
      scope: "squad",
      scope_id: "boxing",
      organization_id: null,
      squad_id: "boxing",
      author_id: "jordan",
      body: "Tuesday rounds are back at six.",
      created_at: new Date(now - 70 * 60000).toISOString(),
    },
  ];
  data.group_message_reads = [
    {
      scope: "organization",
      scope_id: organizationId,
      organization_id: organizationId,
      squad_id: null,
      user_id: DEMO_ID,
      last_read_at: new Date(now - 10 * 60000).toISOString(),
    },
    {
      scope: "squad",
      scope_id: "boxing",
      organization_id: null,
      squad_id: "boxing",
      user_id: DEMO_ID,
      last_read_at: new Date(now - 90 * 60000).toISOString(),
    },
  ];
  data.activities.push({
    id: "org-beacon-lakefront-walk",
    owner_id: "maya",
    title: "Lakefront trail loop",
    description: "Easy pace, coffee after if the weather holds.",
    category: "Fitness",
    mode: "squad",
    starts_at: new Date(now + 2 * 86400000).toISOString(),
    ends_at: new Date(now + 2 * 86400000 + 90 * 60000).toISOString(),
    timezone: "America/Chicago",
    approval_required: false,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "organization",
    audience_id: organizationId,
  });
  data.places.push({
    activity_id: "org-beacon-lakefront-walk",
    label: "Montrose Harbor",
    latitude: 41.963,
    longitude: -87.639,
    online_url: null,
  });
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
    enable_chat: true,
    enable_checklist: true,
    enable_journal: true,
    enable_experiences: true,
    enable_focus: true,
    enable_reactions: true,
    enable_comments: true,
    enable_scoreboard: false,
    enable_music: false,
    checklist_edit_policy: "participants",
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
      section_id: null,
      assignee_id: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "demo-checklist-wraps",
      activity_id: activityId,
      author_id: "jordan",
      text: "Pick a route everyone likes",
      completed: false,
      section_id: null,
      assignee_id: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];
  data.beacon_notes = [
    {
      id: "demo-note-tools",
      activity_id: activityId,
      author_id: "jordan",
      section_heading: "Route notes",
      body: "The lakefront route is open and easy to follow.",
      visibility: "shared",
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
  data.planning_threads.push({
    id: "demo-org-ping",
    owner_id: "maya",
    coowner_ids: [],
    kind: "ping",
    title: "Sunday picnic after the walk?",
    body: "Vote yes if you're free to stay a little longer.",
    audience: "organization",
    audience_id: organizationId,
    deadline_at: new Date(now + 18 * 60 * 60 * 1000).toISOString(),
    status: "open",
    payload: {
      title: "Sunday picnic",
      description: "Stay for a relaxed picnic after the trail loop.",
      category: "Social",
      mode: "squad",
      starts_at: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(now + 50 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Chicago",
      approval_required: false,
      audience: "organization",
      audience_id: organizationId,
      target_count: null,
      label: "Montrose Harbor",
      online_url: null,
      latitude: null,
      longitude: null,
      aspiration_ids: [],
    },
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: new Date(now - 20 * 60000).toISOString(),
    resolved_at: null,
  });
  const sampleDraft = (
    title: string,
    category: BeaconDraft["category"],
    offsetHours: number,
  ): BeaconDraft => {
    const starts = now + offsetHours * 3600000;
    return {
      title,
      description: "A demo crew meetup shaped by everyone’s ideas.",
      category,
      mode: "squad",
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(starts + 90 * 60000).toISOString(),
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
    };
  };
  const squadPingDraft = sampleDraft(
    "Boxing rounds and coffee",
    "Fitness",
    30,
  );
  squadPingDraft.audience = "squad";
  squadPingDraft.audience_id = "boxing";
  data.planning_threads.push({
    id: "demo-squad-ping-boxing",
    owner_id: "jordan",
    coowner_ids: [],
    kind: "ping",
    title: "A quick boxing session?",
    body: "I can grab coffee nearby afterward if anyone wants to join.",
    audience: "squad",
    audience_id: "boxing",
    deadline_at: new Date(now + 6 * 3600000).toISOString(),
    status: "open",
    payload: squadPingDraft,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: createdAt,
    resolved_at: null,
  });
  const makeIncomingPing = (
    id: string,
    ownerId: string,
    title: string,
    body: string,
    deadlineHours: number,
    startHours: number,
  ) => ({
    id,
    owner_id: ownerId,
    coowner_ids: [],
    kind: "ping" as const,
    title,
    body,
    audience: "friends" as const,
    audience_id: null,
    deadline_at: new Date(now + deadlineHours * 3600000).toISOString(),
    status: "open" as const,
    payload: sampleDraft(title.replace(/\?$/, ""), "Social", startHours),
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: createdAt,
    resolved_at: null,
  });
  data.planning_threads.push(
    makeIncomingPing(
      "demo-ping-jordan",
      "jordan",
      "Coffee and a bookstore?",
      "There’s a new shop downtown. Want to check it out this weekend?",
      36,
      84,
    ),
    makeIncomingPing(
      "demo-ping-sam",
      "sam",
      "Sunset walk, anyone?",
      "I’ll be by the lake after work if anyone wants to join.",
      48,
      96,
    ),
  );

  const voteDeadline = new Date(now + 18 * 3600000).toISOString();
  data.planning_threads.push({
    id: "demo-vote-weekend",
    owner_id: "maya",
    coowner_ids: [],
    kind: "vote",
    title: "Which weekend plan sounds best?",
    body: "Choose the option you’d be excited to do.",
    audience: "friends",
    audience_id: null,
    deadline_at: voteDeadline,
    status: "open",
    payload: null,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: createdAt,
    resolved_at: null,
  });
  data.planning_proposals.push(
    {
      id: "demo-vote-option-walk",
      thread_id: "demo-vote-weekend",
      author_id: "maya",
      payload: sampleDraft("Lakefront picnic walk", "Social", 48),
      approved: true,
      disqualified_at: null,
      created_at: createdAt,
      activity_id: null,
    },
    {
      id: "demo-vote-option-market",
      thread_id: "demo-vote-weekend",
      author_id: "jordan",
      payload: sampleDraft("Farmers market and lunch", "Social", 60),
      approved: true,
      disqualified_at: null,
      created_at: createdAt,
      activity_id: null,
    },
  );

  const drawActivityId = "demo-draw-beacon",
    drawProposalId = "demo-draw-winner",
    drawPayload = sampleDraft("A surprise crew meetup", "Social", 120),
    drawCreatedAt = new Date(now - 2 * 3600000).toISOString();
  drawPayload.label = "Lakefront meetup spot (demo)";
  drawPayload.latitude = 41.891;
  drawPayload.longitude = -87.61;
  data.activities.push({
    id: drawActivityId,
    owner_id: "jordan",
    title: drawPayload.title,
    description: drawPayload.description,
    category: drawPayload.category,
    mode: drawPayload.mode,
    starts_at: drawPayload.starts_at,
    ends_at: drawPayload.ends_at,
    timezone: drawPayload.timezone,
    approval_required: drawPayload.approval_required,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: drawPayload.audience,
    audience_id: drawPayload.audience_id,
  });
  data.places.push({
    activity_id: drawActivityId,
    label: drawPayload.label,
    latitude: drawPayload.latitude,
    longitude: drawPayload.longitude,
    online_url: null,
  });
  data.planning_threads.push({
    id: "demo-draw-result",
    owner_id: "jordan",
    coowner_ids: [],
    kind: "draw",
    title: "Crew’s surprise meetup",
    body: "The draw picked one of the approved ideas.",
    audience: "friends",
    audience_id: null,
    deadline_at: new Date(now - 3600000).toISOString(),
    status: "resolved",
    payload: null,
    winner_proposal_id: drawProposalId,
    replaced_from_proposal_id: null,
    materialized_activity_id: drawActivityId,
    created_at: drawCreatedAt,
    resolved_at: createdAt,
  });
  data.planning_proposals.push({
    id: drawProposalId,
    thread_id: "demo-draw-result",
    author_id: "jordan",
    payload: drawPayload,
    approved: true,
    disqualified_at: null,
    created_at: drawCreatedAt,
    activity_id: drawActivityId,
  });
  const routineDemo = makeRoutineDemo(data, DEMO_ID, new Date(now));
  data.plan_routines.push(...routineDemo.plan_routines);
  data.plan_members.push(...routineDemo.plan_members);
  data.plans.push(...routineDemo.plans);
  data.activities.push(...routineDemo.activities);
  data.places.push(...routineDemo.places);
  const growthCreatedAt = new Date(now - 20 * 86400000).toISOString();
  data.squads.push(
    {
      id: "pickup-basketball",
      owner_id: DEMO_ID,
      name: "Pickup Basketball",
      description: "A growing crew for weekday runs and weekend games.",
      discoverability: "public",
      join_mode: "open",
      invite_policy: "members",
    },
    {
      id: "open-run-club",
      owner_id: "maya",
      name: "Open Run Club",
      description: "Easy paced runs around the neighborhood.",
      discoverability: "public",
      join_mode: "open",
      invite_policy: "admins",
    },
    {
      id: "chess-table",
      owner_id: "jordan",
      name: "Chess Table",
      description: "Casual games and friendly puzzles.",
      discoverability: "public",
      join_mode: "request",
      invite_policy: "elders",
    },
  );
  data.squad_members.push({ squad_id: "pickup-basketball", user_id: DEMO_ID, role: "owner" });
  for (let index = 1; index <= 34; index++) {
    const personId = `pickup-player-${index}`;
    const template = data.profiles[0];
    data.profiles.push({
      ...template,
      id: personId,
      username: `pickup${index}`,
      name: `Pickup player ${index}`,
      bio: "",
      interests: [],
      identity_tags: [],
      aspiration_goals: [],
      featured_activity_id: null,
      hide_featured: false,
    });
    data.squad_members.push({ squad_id: "pickup-basketball", user_id: personId, role: "member" });
  }
  data.squad_members.push(
    { squad_id: "open-run-club", user_id: "maya", role: "owner" },
    { squad_id: "open-run-club", user_id: "sam", role: "member" },
    { squad_id: "chess-table", user_id: "jordan", role: "owner" },
    { squad_id: "chess-table", user_id: "sam", role: "member" },
  );
  data.spaces.push(
    {
      id: "space-lakefront-runs",
      owner_id: "maya",
      name: "Lakefront Runs",
      description: "A standalone neighborhood running community.",
      created_at: growthCreatedAt,
      space_type: "local_community",
      discoverability: "public",
      join_mode: "open",
      invite_policy: "admins",
    },
    {
      id: "space-park-care",
      owner_id: "jordan",
      name: "Park Care Crew",
      description: "Neighbors organizing small park cleanup days.",
      created_at: growthCreatedAt,
      space_type: "local_community",
      discoverability: "public",
      join_mode: "request",
      invite_policy: "elders",
    },
  );
  data.space_members.push(
    { space_id: "space-lakefront-runs", user_id: "maya", role: "owner", status: "active", invited_by: null, created_at: growthCreatedAt },
    { space_id: "space-park-care", user_id: "jordan", role: "owner", status: "active", invited_by: null, created_at: growthCreatedAt },
  );
  data.space_squads.push({ space_id: "space-lakefront-runs", squad_id: "open-run-club", added_by: "maya", created_at: growthCreatedAt });
  return data;
}

function applyDemoOrganizationAction(
  data: Data,
  action: string,
  payload: Payload,
  userId: string,
  newId: () => string,
) {
  const organizationId = String(payload.organization_id ?? "");
  const targetId = String(payload.user_id ?? "");
  const organization = data.organizations.find(
    (item) => item.id === organizationId,
  );
  const members = data.organization_members;
  const blocked = (first: string, second: string) =>
    data.blocks.some(
      (row) =>
        (row.blocker_id === first && row.blocked_id === second) ||
        (row.blocker_id === second && row.blocked_id === first),
    );
  const rank = SOCIAL_ROLE_RANK;
  const countMembers = (org: typeof organization) => {
    if (!org) return;
    org.member_count =
      1 +
      members.filter(
        (member) =>
          member.organization_id === org.id &&
          member.status === "active" &&
          member.user_id !== org.owner_id,
      ).length;
  };
  const isGroupMember = (scope: GroupMessageScope, scopeId: string) =>
    scope === "organization"
      ? !!data.organizations.find((item) => item.id === scopeId) &&
        activeOrganizationRole(
          data.organizations.find((item) => item.id === scopeId)!,
          members,
          userId,
        ) !== null &&
        !blocked(
          userId,
          data.organizations.find((item) => item.id === scopeId)!.owner_id,
        )
      : data.squad_members.some(
          (member) => member.squad_id === scopeId && member.user_id === userId,
        ) &&
        !blocked(
          userId,
          data.squads.find((item) => item.id === scopeId)?.owner_id ?? "",
        );
  const upsertRead = (
    scope: GroupMessageScope,
    scopeId: string,
    at: string,
  ) => {
    const found = data.group_message_reads.find(
      (row) =>
        row.scope === scope &&
        row.scope_id === scopeId &&
        row.user_id === userId,
    );
    if (found) {
      if (found.last_read_at < at) found.last_read_at = at;
      return;
    }
    data.group_message_reads.push({
      scope,
      scope_id: scopeId,
      organization_id: scope === "organization" ? scopeId : null,
      squad_id: scope === "squad" ? scopeId : null,
      user_id: userId,
      last_read_at: at,
    });
  };

  if (action === "create_organization") {
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    if (name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Check the organization name and description.");
    const id = newId();
    data.organizations.push({
      id,
      owner_id: userId,
      name,
      description,
      created_at: new Date().toISOString(),
      member_count: 1,
      discoverability: payload.discoverability === "public" || payload.discoverability === "community" ? payload.discoverability : "private",
      join_mode: payload.join_mode === "open" || payload.join_mode === "request" ? payload.join_mode : "invite",
      invite_policy: payload.invite_policy === "elders" || payload.invite_policy === "members" ? payload.invite_policy : "admins",
    });
    return true;
  }

  if (action === "send_group_message" || action === "mark_group_chat_read") {
    const scope = payload.scope as GroupMessageScope;
    const scopeId = String(
      scope === "organization"
        ? (payload.organization_id ?? "")
        : (payload.squad_id ?? ""),
    );
    if (
      (scope !== "organization" && scope !== "squad") ||
      !scopeId ||
      !isGroupMember(scope, scopeId)
    )
      throw new Error("That group chat is unavailable to you.");
    if (action === "mark_group_chat_read") {
      upsertRead(scope, scopeId, new Date().toISOString());
      return true;
    }
    const body = String(payload.body ?? "").trim();
    if (!body || body.length > 2000)
      throw new Error("Messages must be 1 to 2000 characters.");
    const createdAt = new Date().toISOString();
    data.group_messages.push({
      id: newId(),
      scope,
      scope_id: scopeId,
      organization_id: scope === "organization" ? scopeId : null,
      squad_id: scope === "squad" ? scopeId : null,
      author_id: userId,
      body,
      created_at: createdAt,
    });
    upsertRead(scope, scopeId, createdAt);
    return true;
  }

  if (action === "respond_organization_invite") {
    if (!organization)
      throw new Error("That organization invitation is unavailable.");
    const invitation = members.find(
      (member) =>
        member.organization_id === organization.id &&
        member.user_id === userId &&
        member.status === "invited",
    );
    if (!invitation || organization.archived_at || blocked(userId, organization.owner_id) ||
        data.organization_bans.some((row) => row.organization_id === organization.id && row.user_id === userId))
      throw new Error("That organization invitation is unavailable.");
    if (payload.accept) invitation.status = "active";
    else
      data.organization_members = members.filter(
        (member) => member !== invitation,
      );
    countMembers(organization);
    return true;
  }

  if (!organization) return false;

  if (action === "update_organization") {
    if (!canManageOrganization(organization, members, userId))
      throw new Error(
        "Only organization leaders can edit organization details.",
      );
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    if (name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Check the organization name and description.");
    organization.name = name;
    organization.description = description;
    return true;
  }

  if (action === "invite_organization_member") {
    const desiredRole = String(
      payload.role ?? "member",
    ) as OrganizationMemberRole;
    if (
      !data.profiles.some((profile) => profile.id === targetId) ||
      targetId === userId ||
      targetId === organization.owner_id ||
      blocked(userId, targetId) ||
      !canInviteOrganizationRole(organization, members, userId, desiredRole)
    )
      throw new Error("Your organization role cannot invite that person.");
    if (
      data.organization_bans.some(
        (ban) =>
          ban.organization_id === organization.id && ban.user_id === targetId,
      )
    )
      throw new Error("That person is banned from this organization.");
    const old = members.find(
      (member) =>
        member.organization_id === organization.id &&
        member.user_id === targetId,
    );
    if (old?.status === "active")
      throw new Error("That person is already in this organization.");
    if (
      old &&
      !canChangeOrganizationMemberRole(
        organization,
        members,
        userId,
        targetId,
        desiredRole,
      )
    )
      throw new Error("Your organization role cannot replace that invitation.");
    const invitedBy = userId;
    const createdAt = new Date().toISOString();
    if (old) {
      old.role = desiredRole;
      old.status = "invited";
      old.invited_by = invitedBy;
      old.created_at = createdAt;
    } else {
      members.push({
        organization_id: organization.id,
        user_id: targetId,
        role: desiredRole,
        status: "invited",
        invited_by: invitedBy,
        created_at: createdAt,
      });
    }
    return true;
  }

  if (action === "set_organization_member_role") {
    const member = members.find(
      (row) =>
        row.organization_id === organization.id && row.user_id === targetId,
    );
    const nextRole = String(payload.role ?? "") as OrganizationMemberRole;
    if (
      !member ||
      !canChangeOrganizationMemberRole(
        organization,
        members,
        userId,
        targetId,
        nextRole,
      )
    )
      throw new Error(
        "Your organization role cannot change this member's role.",
      );
    member.role = nextRole;
    return true;
  }

  if (
    action === "remove_organization_member" ||
    action === "ban_organization_member"
  ) {
    const member = members.find(
      (row) =>
        row.organization_id === organization.id && row.user_id === targetId,
    );
    if (
      !member ||
      !canManageOrganizationMember(organization, members, userId, targetId)
    )
      throw new Error("Your organization role cannot change this member.");
    if (action === "ban_organization_member") {
      data.organization_bans = data.organization_bans.filter(
        (row) =>
          !(
            row.organization_id === organization.id && row.user_id === targetId
          ),
      );
      data.organization_bans.push({
        organization_id: organization.id,
        user_id: targetId,
        banned_by: userId,
        reason: String(payload.reason ?? ""),
        former_role: member.role,
        created_at: new Date().toISOString(),
      });
    }
    data.organization_members = members.filter((row) => row !== member);
    countMembers(organization);
    return true;
  }

  if (action === "unban_organization_member") {
    const ban = data.organization_bans.find(
      (row) =>
        row.organization_id === organization.id && row.user_id === targetId,
    );
    const actorRole = activeOrganizationRole(organization, members, userId);
    if (!ban || !actorRole || rank[actorRole] <= rank[ban.former_role])
      throw new Error("Your organization role cannot unban this person.");
    data.organization_bans = data.organization_bans.filter(
      (row) => row !== ban,
    );
    return true;
  }

  if (action === "leave_organization") {
    if (!canLeaveOrganization(organization, members, userId))
      throw new Error("The organization owner cannot leave.");
    data.organization_members = members.filter(
      (row) =>
        !(row.organization_id === organization.id && row.user_id === userId),
    );
    countMembers(organization);
    return true;
  }

  if (
    action === "attach_organization_squad" ||
    action === "detach_organization_squad"
  ) {
    const squadId = String(payload.squad_id ?? "");
    const canManageSquad = canManageOrganizationSquads(
      organization,
      members,
      userId,
    );
    const ownsSquad = data.squad_members.some(
      (member) =>
        member.squad_id === squadId &&
        member.user_id === userId &&
        (member.role === "owner" || member.role === "admin"),
    );
    if (!canManageSquad || !ownsSquad)
      throw new Error(
        "You need an elder or organization leader role and squad admin access.",
      );
    const old = data.organization_squads.find(
      (row) =>
        row.organization_id === organization.id && row.squad_id === squadId,
    );
    if (action === "attach_organization_squad") {
      if (!data.squads.some((squad) => squad.id === squadId))
        throw new Error("That Squad is unavailable.");
      if (!old)
        data.organization_squads.push({
          organization_id: organization.id,
          squad_id: squadId,
          added_by: userId,
          created_at: new Date().toISOString(),
        });
    } else {
      if (!old)
        throw new Error("That Squad is not linked to this organization.");
      data.organization_squads = data.organization_squads.filter(
        (row) => row !== old,
      );
    }
    return true;
  }

  if (action === "attach_organization_space" || action === "detach_organization_space") {
    const spaceId = String(payload.space_id ?? "");
    const space = data.spaces.find((row) => row.id === spaceId);
    const organizationRole = activeOrganizationRole(organization, members, userId);
    const spaceRole = space && data.space_members.find((row) => row.space_id === space.id && row.user_id === userId && row.status === "active")?.role;
    if (!space || !organizationRole || rank[organizationRole] < rank.admin ||
        !spaceRole || SOCIAL_ROLE_RANK[spaceRole] < SOCIAL_ROLE_RANK.admin ||
        blocked(userId, organization.owner_id) || blocked(userId, space.owner_id) ||
        data.organization_bans.some((row) => row.organization_id === organization.id && row.user_id === userId) ||
        data.space_bans.some((row) => row.space_id === space.id && row.user_id === userId))
      throw new Error("You need active admin authority in both communities to link them.");
    const old = data.organization_spaces.find((row) => row.organization_id === organization.id && row.space_id === space.id);
    if (action === "attach_organization_space") {
      if (!old) data.organization_spaces.push({ organization_id: organization.id, space_id: space.id, added_by: userId, created_at: new Date().toISOString() });
    } else {
      if (!old) throw new Error("That Space is not linked to this organization.");
      data.organization_spaces = data.organization_spaces.filter((row) => row !== old);
    }
    return true;
  }

  return false;
}

function applyDemoSpaceAction(
  data: Data,
  action: string,
  payload: Payload,
  userId: string,
  newId: () => string,
) {
  const spaceId = String(payload.space_id ?? "");
  const targetId = String(payload.user_id ?? "");
  const space = data.spaces.find((item) => item.id === spaceId);
  const members = data.space_members;
  const blocked = (first: string, second: string) =>
    data.blocks.some(
      (row) =>
        (row.blocker_id === first && row.blocked_id === second) ||
        (row.blocker_id === second && row.blocked_id === first),
    );
  const roleFor = (personId: string) => {
    const member = members.find(
      (row) => row.space_id === spaceId && row.user_id === personId,
    );
    if (member?.status !== "active") return null;
    if (personId === space?.owner_id)
      return member.role === "owner" ? "owner" : null;
    return member.role === "owner" ? null : member.role;
  };
  const roleRank = SOCIAL_ROLE_RANK;
  const actorRole = roleFor(userId);
  const canManage = !!space && !space.archived_at && !blocked(userId, space.owner_id) &&
    !data.space_bans.some((ban) => ban.space_id === spaceId && ban.user_id === userId) &&
    !!actorRole && SOCIAL_ROLE_RANK[actorRole] >= SOCIAL_ROLE_RANK.admin;
  const findMember = (personId: string) =>
    members.find((row) => row.space_id === spaceId && row.user_id === personId);
  const now = new Date().toISOString();

  if (action === "create_space") {
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    if (name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Check the Space name and description.");
    const createdId = newId();
    data.spaces.push({
      id: createdId,
      owner_id: userId,
      name,
      description,
      created_at: now,
      space_type: payload.space_type === "club" || payload.space_type === "academic" || payload.space_type === "sports" || payload.space_type === "residence" || payload.space_type === "interest" || payload.space_type === "local_community" || payload.space_type === "professional" ? payload.space_type : "other",
      discoverability: payload.discoverability === "public" || payload.discoverability === "community" ? payload.discoverability : "private",
      join_mode: payload.join_mode === "open" || payload.join_mode === "request" ? payload.join_mode : "invite",
      invite_policy: payload.invite_policy === "elders" || payload.invite_policy === "members" ? payload.invite_policy : "admins",
    });
    data.space_members.push({
      space_id: createdId,
      user_id: userId,
      role: "owner",
      status: "active",
      invited_by: null,
      created_at: now,
    });
    return true;
  }

  if (!space) return false;
  if (action === "update_space") {
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    if (!canManage || name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Only Space owners and admins can edit valid Space details.");
    space.name = name;
    space.description = description;
    return true;
  }
  if (action === "invite_space_member") {
    const role: SocialMemberRole = payload.role === "coowner" || payload.role === "admin" || payload.role === "elder" ? payload.role : "member";
    const targetMember = findMember(targetId);
    const friend = data.friendships.some(
      (friendship) =>
        friendship.status === "accepted" &&
        ((friendship.sender_id === userId && friendship.recipient_id === targetId) ||
          (friendship.recipient_id === userId && friendship.sender_id === targetId)),
    );
    if (
      !space || space.archived_at || targetId === userId || targetId === space.owner_id ||
      !actorRole || !canInviteWithPolicy(actorRole, space.invite_policy) ||
      (SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[role] && !(actorRole === "member" && role === "member" && space.invite_policy === "members")) ||
      !data.profiles.some((profile) => profile.id === targetId) ||
      blocked(userId, targetId) || blocked(space.owner_id, targetId) || !friend ||
      data.space_bans.some((ban) => ban.space_id === spaceId && ban.user_id === targetId) ||
      targetMember?.status === "active" ||
      (!!targetMember && (!actorRole || SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[targetMember.role]))
    )
      throw new Error("Choose an eligible friend to invite to this Space.");
    if (targetMember) {
      targetMember.role = role;
      targetMember.status = "invited";
      targetMember.invited_by = userId;
      targetMember.created_at = now;
    } else {
      members.push({
        space_id: spaceId,
        user_id: targetId,
        role,
        status: "invited",
        invited_by: userId,
        created_at: now,
      });
    }
    return true;
  }
  if (action === "respond_space_invite") {
    const invite = findMember(userId);
    if (targetId && targetId !== userId || invite?.status !== "invited" || space.archived_at || blocked(userId, space.owner_id) ||
        data.space_bans.some((row) => row.space_id === spaceId && row.user_id === userId))
      throw new Error("That Space invitation is no longer available.");
    if (payload.accept === true) invite.status = "active";
    else data.space_members = members.filter((row) => row !== invite);
    return true;
  }
  if (action === "set_space_member_role") {
    const member = findMember(targetId);
    const role = payload.role;
    if (
      !canManage || targetId === userId ||
      targetId === space.owner_id || !member ||
      (role !== "coowner" && role !== "admin" && role !== "elder" && role !== "member") ||
      !actorRole || SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[member.role] || SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[role]
    )
      throw new Error("Your Space role cannot change this member role.");
    member.role = role;
    return true;
  }
  if (action === "remove_space_member") {
    const member = findMember(targetId);
    if (
      !canManage || !member || targetId === userId || targetId === space.owner_id ||
      !actorRole || roleRank[actorRole] <= roleRank[member.role]
    )
      throw new Error("Your Space role cannot remove this member.");
    data.space_members = members.filter((row) => row !== member);
    return true;
  }
  if (action === "leave_space") {
    const member = findMember(userId);
    if (userId === space.owner_id || !member || member.status !== "active")
      throw new Error("The Space owner cannot leave; active members may leave.");
    data.space_members = members.filter((row) => row !== member);
    return true;
  }
  if (action === "attach_space_squad" || action === "detach_space_squad") {
    const linked = data.space_squads.find(
      (row) => row.space_id === spaceId && row.squad_id === String(payload.squad_id ?? ""),
    );
    if (!canManage) throw new Error("Only Space owners and admins can link Squads.");
    if (action === "attach_space_squad") {
      const hasSquadAdmin = data.squad_members.some(
        (member) =>
          member.squad_id === String(payload.squad_id ?? "") &&
          member.user_id === userId &&
          (member.role === "owner" || member.role === "admin"),
      );
      if (!hasSquadAdmin || !data.squads.some((squad) => squad.id === String(payload.squad_id ?? "")))
        throw new Error("You need to administer that Squad to link it.");
      if (!linked)
        data.space_squads.push({
          space_id: spaceId,
          squad_id: String(payload.squad_id),
          added_by: userId,
          created_at: now,
        });
      return true;
    }
    if (!linked) throw new Error("That Squad is not linked to this Space.");
    data.space_squads = data.space_squads.filter((row) => row !== linked);
    return true;
  }
  return false;
}

function applyDemoSocialMembershipAction(
  data: Data,
  action: string,
  payload: Payload,
  userId: string,
  newId: () => string,
) {
  const blocked = (first: string, second: string) =>
    data.blocks.some(
      (row) =>
        (row.blocker_id === first && row.blocked_id === second) ||
        (row.blocker_id === second && row.blocked_id === first),
    );
  if (action === "set_social_association" || action === "clear_social_association") {
    const activityId = String(payload.activity_id ?? "");
    const activity = data.activities.find((row) => row.id === activityId && row.owner_id === userId);
    if (!activity) throw new Error("Only the Beacon host can change its community association.");
    const existing = data.activity_social_links.find((row) => row.activity_id === activityId);
    if (action === "clear_social_association") {
      if (existing?.created_by === userId)
        data.activity_social_links = data.activity_social_links.filter((row) => row !== existing);
      return true;
    }
    const type = payload.entity_type;
    const entityId = String(payload.entity_id ?? "");
    const entity = type === "organization" ? data.organizations.find((row) => row.id === entityId)
      : type === "space" ? data.spaces.find((row) => row.id === entityId)
        : type === "squad" ? data.squads.find((row) => row.id === entityId) : undefined;
    const banned = type === "organization" ? data.organization_bans.some((row) => row.organization_id === entityId && row.user_id === userId)
      : type === "space" ? data.space_bans.some((row) => row.space_id === entityId && row.user_id === userId)
        : data.squad_bans.some((row) => row.squad_id === entityId && row.user_id === userId);
    const memberRole: SocialRole | null = type === "organization" && entity
      ? activeOrganizationRole(entity as (typeof data.organizations)[number], data.organization_members, userId)
      : type === "space"
        ? data.space_members.find((row) => row.space_id === entityId && row.user_id === userId && row.status === "active")?.role ?? null
        : data.squad_members.find((row) => row.squad_id === entityId && row.user_id === userId)?.role ?? null;
    if (!entity || entity.archived_at || banned || blocked(userId, entity.owner_id) || !memberRole)
      throw new Error("You need current membership in an available community to associate this Beacon.");
    const now = new Date().toISOString();
    if (existing) {
      existing.entity_type = type as ActivitySocialLink["entity_type"];
      existing.entity_id = entityId;
      existing.created_by = userId;
      existing.created_at = now;
    } else {
      data.activity_social_links.push({ activity_id: activityId, entity_type: type as ActivitySocialLink["entity_type"], entity_id: entityId, created_by: userId, created_at: now });
    }
    return true;
  }
  if (action === "set_social_policy") {
    const type = payload.entity_type;
    const entityId = String(payload.entity_id ?? "");
    const entity = type === "organization" ? data.organizations.find((row) => row.id === entityId)
      : type === "space" ? data.spaces.find((row) => row.id === entityId)
        : type === "squad" ? data.squads.find((row) => row.id === entityId) : undefined;
    const banned = type === "organization" ? data.organization_bans.some((row) => row.organization_id === entityId && row.user_id === userId)
      : type === "space" ? data.space_bans.some((row) => row.space_id === entityId && row.user_id === userId)
        : data.squad_bans.some((row) => row.squad_id === entityId && row.user_id === userId);
    const role = type === "organization" && entity ? activeOrganizationRole(entity as (typeof data.organizations)[number], data.organization_members, userId)
      : type === "space" ? data.space_members.find((row) => row.space_id === entityId && row.user_id === userId && row.status === "active")?.role
        : data.squad_members.find((row) => row.squad_id === entityId && row.user_id === userId)?.role;
    if (!entity || entity.archived_at || banned || blocked(userId, entity.owner_id) || !role || SOCIAL_ROLE_RANK[role] < SOCIAL_ROLE_RANK.admin)
      throw new Error("Only active community admins can change social settings.");
    if (!["public", "community", "private"].includes(String(payload.discoverability)) ||
        !["open", "request", "invite"].includes(String(payload.join_mode)) ||
        !["admins", "elders", "members"].includes(String(payload.invite_policy)))
      throw new Error("Choose valid social settings.");
    entity.discoverability = payload.discoverability as "public" | "community" | "private";
    entity.join_mode = payload.join_mode as "open" | "request" | "invite";
    entity.invite_policy = payload.invite_policy as InvitePolicy;
    return true;
  }
  if (action === "set_squad_member_role") {
    const squadId = String(payload.squad_id ?? "");
    const targetId = String(payload.user_id ?? "");
    const squad = data.squads.find((row) => row.id === squadId);
    const role = payload.role;
    const target = data.squad_members.find((row) => row.squad_id === squadId && row.user_id === targetId);
    const actorRole = data.squad_members.find((row) => row.squad_id === squadId && row.user_id === userId)?.role;
    if (!squad || squad.archived_at || blocked(userId, squad.owner_id) ||
        data.squad_bans.some((ban) => ban.squad_id === squadId && ban.user_id === userId) ||
        !actorRole || SOCIAL_ROLE_RANK[actorRole] < SOCIAL_ROLE_RANK.admin || targetId === userId ||
        targetId === squad.owner_id || !target || (role !== "coowner" && role !== "admin" && role !== "elder" && role !== "member") ||
        SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[target.role] || SOCIAL_ROLE_RANK[actorRole] <= SOCIAL_ROLE_RANK[role])
      throw new Error("Your Squad role cannot change this member role.");
    target.role = role;
    return true;
  }
  const prefix = action.match(/^(join|request|cancel|approve|deny)_(squad|space|organization)(?:_join|_join_request)?$/);
  if (action === "create_space_from_squads") {
    const squadIds = Array.isArray(payload.squad_ids) ? payload.squad_ids.filter((id): id is string => typeof id === "string") : [];
    if (squadIds.length < 1 || squadIds.length > 20 || new Set(squadIds).size !== squadIds.length)
      throw new Error("Choose 1 to 20 different Squads.");
    const managed = squadIds.map((id) => data.squads.find((row) => row.id === id));
    if (managed.some((squad) => !squad || squad.archived_at || blocked(userId, squad.owner_id) ||
      data.squad_bans.some((ban) => ban.squad_id === squad.id && ban.user_id === userId) ||
      !data.squad_members.some((member) => member.squad_id === squad.id && member.user_id === userId && SOCIAL_ROLE_RANK[member.role] >= SOCIAL_ROLE_RANK.admin)))
      throw new Error("You need active admin access to every Squad.");
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    if (name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Check the Space name and description.");
    const spaceId = newId();
    const now = new Date().toISOString();
    data.spaces.push({
      id: spaceId, owner_id: userId, name, description, created_at: now,
      space_type: payload.space_type === "club" || payload.space_type === "academic" || payload.space_type === "sports" || payload.space_type === "residence" || payload.space_type === "interest" || payload.space_type === "local_community" || payload.space_type === "professional" ? payload.space_type : "other",
      discoverability: payload.discoverability === "public" || payload.discoverability === "community" ? payload.discoverability : "private",
      join_mode: payload.join_mode === "open" || payload.join_mode === "request" ? payload.join_mode : "invite",
      invite_policy: payload.invite_policy === "elders" || payload.invite_policy === "members" ? payload.invite_policy : "admins",
    });
    data.space_members.push({ space_id: spaceId, user_id: userId, role: "owner", status: "active", invited_by: null, created_at: now });
    for (const squadId of squadIds) data.space_squads.push({ space_id: spaceId, squad_id: squadId, added_by: userId, created_at: now });
    return { space_id: spaceId, linked_squad_count: squadIds.length };
  }
  const banAction = action.match(/^(ban|unban)_(squad|space)_member$/);
  if (banAction) {
    const [, verb, type] = banAction;
    const id = String(payload[`${type}_id`] ?? "");
    const targetId = String(payload.user_id ?? "");
    const entity = type === "space" ? data.spaces.find((row) => row.id === id) : data.squads.find((row) => row.id === id);
    const ownerId = entity?.owner_id;
    const role = type === "space"
      ? data.space_members.find((row) => row.space_id === id && row.user_id === userId && row.status === "active")?.role
      : data.squad_members.find((row) => row.squad_id === id && row.user_id === userId)?.role;
    const oldBan = type === "space"
      ? data.space_bans.find((row) => row.space_id === id && row.user_id === targetId)
      : data.squad_bans.find((row) => row.squad_id === id && row.user_id === targetId);
    if (!entity || entity.archived_at || !ownerId || blocked(userId, ownerId) ||
        (type === "space" ? data.space_bans.some((row) => row.space_id === id && row.user_id === userId) : data.squad_bans.some((row) => row.squad_id === id && row.user_id === userId)) ||
        !role || SOCIAL_ROLE_RANK[role] < SOCIAL_ROLE_RANK.admin || targetId === userId || targetId === ownerId)
      throw new Error("Only active community admins can manage bans.");
    if (verb === "unban") {
      if (!oldBan || SOCIAL_ROLE_RANK[role] <= SOCIAL_ROLE_RANK[oldBan.former_role]) throw new Error("Your role cannot remove that ban.");
      if (type === "space") data.space_bans = data.space_bans.filter((row) => row !== oldBan);
      else data.squad_bans = data.squad_bans.filter((row) => row !== oldBan);
      return true;
    }
    if (String(payload.reason ?? "").length > 200) throw new Error("Ban reasons must be 200 characters or fewer.");
    const targetRole = type === "space"
      ? data.space_members.find((row) => row.space_id === id && row.user_id === targetId && row.status === "active")?.role
      : data.squad_members.find((row) => row.squad_id === id && row.user_id === targetId)?.role;
    const formerRole = targetRole && targetRole !== "owner" ? targetRole : null;
    if (!formerRole || SOCIAL_ROLE_RANK[role] <= SOCIAL_ROLE_RANK[formerRole]) throw new Error("Your role cannot ban that member.");
    if (type === "space") {
      data.space_members = data.space_members.filter((row) => !(row.space_id === id && row.user_id === targetId));
      data.space_bans = data.space_bans.filter((row) => !(row.space_id === id && row.user_id === targetId));
      data.space_bans.push({ space_id: id, user_id: targetId, banned_by: userId, reason: String(payload.reason ?? ""), former_role: formerRole, created_at: new Date().toISOString() });
    } else {
      data.squad_members = data.squad_members.filter((row) => !(row.squad_id === id && row.user_id === targetId));
      data.squad_join_requests = data.squad_join_requests.filter((row) => !(row.squad_id === id && row.user_id === targetId));
      data.squad_invites = data.squad_invites.filter((row) => !(row.squad_id === id && row.recipient_id === targetId));
      data.squad_bans = data.squad_bans.filter((row) => !(row.squad_id === id && row.user_id === targetId));
      data.squad_bans.push({ squad_id: id, user_id: targetId, banned_by: userId, reason: String(payload.reason ?? ""), former_role: formerRole, created_at: new Date().toISOString() });
    }
    return true;
  }
  if (prefix) {
    const [, verb, entityType] = prefix;
    const idField = entityType === "organization" ? "organization_id" : `${entityType}_id`;
    const entityId = String(payload[idField] ?? "");
    const entity = entityType === "organization"
      ? data.organizations.find((row) => row.id === entityId)
      : entityType === "space"
        ? data.spaces.find((row) => row.id === entityId)
        : data.squads.find((row) => row.id === entityId);
    if (!entity) throw new Error("That community is unavailable.");
    const ownerId = entity.owner_id;
    const currentStatus = entityType === "organization"
      ? data.organization_members.find((row) => row.organization_id === entityId && row.user_id === userId)?.status ?? (ownerId === userId ? "active" : null)
      : entityType === "space"
        ? data.space_members.find((row) => row.space_id === entityId && row.user_id === userId)?.status ?? null
        : data.squad_members.some((row) => row.squad_id === entityId && row.user_id === userId)
          ? "active"
          : data.squad_join_requests.some((row) => row.squad_id === entityId && row.user_id === userId)
            ? "requested"
            : null;
    const parentEligible = () => {
      if (entityType === "organization") return false;
      if (entityType === "space")
        return data.organization_spaces.some((link) => {
          const parent = data.organizations.find((row) => row.id === link.organization_id);
          return link.space_id === entityId && !!parent && !parent.archived_at && !blocked(userId, parent.owner_id) &&
            !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === userId) &&
            activeOrganizationRole(parent, data.organization_members, userId) !== null;
        });
      return data.space_squads.some((link) => {
        const parent = data.spaces.find((row) => row.id === link.space_id);
        return link.squad_id === entityId && !!parent && !parent.archived_at && !blocked(userId, parent.owner_id) &&
          !data.space_bans.some((ban) => ban.space_id === parent.id && ban.user_id === userId) &&
          data.space_members.some((member) => member.space_id === parent.id && member.user_id === userId && member.status === "active");
      }) || data.organization_squads.some((link) => {
        const parent = data.organizations.find((row) => row.id === link.organization_id);
        return link.squad_id === entityId && !!parent && !parent.archived_at && !blocked(userId, parent.owner_id) &&
          !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === userId) &&
          activeOrganizationRole(parent, data.organization_members, userId) !== null;
      }) || data.space_squads.some((link) => data.organization_spaces.some((parentLink) => {
        const parent = data.organizations.find((row) => row.id === parentLink.organization_id);
        const space = data.spaces.find((row) => row.id === link.space_id);
        return link.squad_id === entityId && link.space_id === parentLink.space_id && !!space && !space.archived_at &&
          data.space_members.some((member) => member.space_id === space.id && member.user_id === userId && member.status === "active") &&
          !!parent && !parent.archived_at && !blocked(userId, parent.owner_id) &&
          !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === userId) &&
          activeOrganizationRole(parent, data.organization_members, userId) !== null;
      }));
    };
    const banned = entityType === "organization"
      ? data.organization_bans.some((row) => row.organization_id === entityId && row.user_id === userId)
      : entityType === "space"
        ? data.space_bans.some((row) => row.space_id === entityId && row.user_id === userId)
        : data.squad_bans.some((row) => row.squad_id === entityId && row.user_id === userId);
    const canCurrentlyJoin = () =>
      !entity.archived_at && !banned && !blocked(userId, ownerId) &&
      (entity.discoverability === "public" ||
        (entity.discoverability === "community" && parentEligible()));
    const actorRole: SocialRole | null = entityType === "organization"
      ? activeOrganizationRole(entity as (typeof data.organizations)[number], data.organization_members, userId)
      : entityType === "space"
        ? (() => {
            const row = data.space_members.find((member) => member.space_id === entityId && member.user_id === userId && member.status === "active");
            return row ? row.role : null;
          })()
        : data.squad_members.find((member) => member.squad_id === entityId && member.user_id === userId)?.role ?? null;

    if (verb === "join" || verb === "request") {
      if (banned || blocked(userId, ownerId) || !canCurrentlyJoin())
        throw new Error("That community is unavailable to you.");
      if (currentStatus === "active") return true;
      if (currentStatus === "invited") throw new Error("Accept your invitation to join this community.");
      const joinMode = entity.join_mode ?? "invite";
      if (verb === "join" && joinMode !== "open") throw new Error("This community requires a request or invitation.");
      if (verb === "request" && joinMode !== "request") throw new Error("This community is not accepting join requests.");
      const createdAt = new Date().toISOString();
      if (entityType === "organization") {
        const old = data.organization_members.find((row) => row.organization_id === entityId && row.user_id === userId);
        if (old) { old.status = verb === "join" ? "active" : "requested"; old.role = "member"; }
        else data.organization_members.push({ organization_id: entityId, user_id: userId, role: "member", status: verb === "join" ? "active" : "requested", invited_by: null, created_at: createdAt });
      } else if (entityType === "space") {
        const old = data.space_members.find((row) => row.space_id === entityId && row.user_id === userId);
        if (old) { old.status = verb === "join" ? "active" : "requested"; old.role = "member"; }
        else data.space_members.push({ space_id: entityId, user_id: userId, role: "member", status: verb === "join" ? "active" : "requested", invited_by: null, created_at: createdAt });
      } else if (verb === "join") {
        data.squad_join_requests = data.squad_join_requests.filter((row) => !(row.squad_id === entityId && row.user_id === userId));
        data.squad_members.push({ squad_id: entityId, user_id: userId, role: "member" });
      } else if (!data.squad_join_requests.some((row) => row.squad_id === entityId && row.user_id === userId)) {
        data.squad_join_requests.push({ squad_id: entityId, user_id: userId, created_at: createdAt });
      }
      return true;
    }

    if (verb === "cancel") {
      if (currentStatus !== "requested") throw new Error("You do not have a pending join request.");
      if (entityType === "organization") data.organization_members = data.organization_members.filter((row) => !(row.organization_id === entityId && row.user_id === userId && row.status === "requested"));
      else if (entityType === "space") data.space_members = data.space_members.filter((row) => !(row.space_id === entityId && row.user_id === userId && row.status === "requested"));
      else data.squad_join_requests = data.squad_join_requests.filter((row) => !(row.squad_id === entityId && row.user_id === userId));
      return true;
    }

    const targetId = String(payload.user_id ?? "");
    if (entity.archived_at || banned || blocked(userId, ownerId) || !actorRole || SOCIAL_ROLE_RANK[actorRole] < SOCIAL_ROLE_RANK.admin || targetId === userId)
      throw new Error("Only community admins can review join requests.");
    if (entityType === "organization" || entityType === "space") {
      const target = entityType === "organization"
        ? data.organization_members.find((row) => row.organization_id === entityId && row.user_id === targetId && row.status === "requested")
        : data.space_members.find((row) => row.space_id === entityId && row.user_id === targetId && row.status === "requested");
      if (!target) throw new Error("That join request is no longer available.");
      if (verb === "deny") {
        if (entityType === "organization") data.organization_members = data.organization_members.filter((row) => row !== target);
        else data.space_members = data.space_members.filter((row) => row !== target);
        return true;
      }
      const targetBlocked = blocked(targetId, ownerId);
      const targetBanned = entityType === "organization"
        ? data.organization_bans.some((row) => row.organization_id === entityId && row.user_id === targetId)
        : data.space_bans.some((row) => row.space_id === entityId && row.user_id === targetId);
      if (targetBlocked || targetBanned || (entity.discoverability === "community" && !parentEligibleFor(entityType, entityId, targetId)))
        throw new Error("That person is no longer eligible to join this community.");
      target.status = "active";
      return true;
    }
    const target = data.squad_join_requests.find((row) => row.squad_id === entityId && row.user_id === targetId);
    if (!target) throw new Error("That join request is no longer available.");
    if (verb === "deny") {
      data.squad_join_requests = data.squad_join_requests.filter((row) => row !== target);
      return true;
    }
    const targetBlocked = blocked(targetId, ownerId);
    const targetBanned = data.squad_bans.some((row) => row.squad_id === entityId && row.user_id === targetId);
    if (targetBlocked || targetBanned || (entity.discoverability === "community" && !parentEligibleFor(entityType, entityId, targetId)))
      throw new Error("That person is no longer eligible to join this Squad.");
    data.squad_join_requests = data.squad_join_requests.filter((row) => row !== target);
    data.squad_members.push({ squad_id: entityId, user_id: targetId, role: "member" });
    return true;
  }

  if (action === "invite_squad") {
    const squadId = String(payload.squad_id ?? payload.id ?? "");
    const targetId = String(payload.user_id ?? "");
    const squad = data.squads.find((row) => row.id === squadId);
    const actorRole = data.squad_members.find((row) => row.squad_id === squadId && row.user_id === userId)?.role ?? null;
    const friend = data.friendships.some((row) => row.status === "accepted" &&
      ((row.sender_id === userId && row.recipient_id === targetId) || (row.recipient_id === userId && row.sender_id === targetId)));
    if (!squad || squad.archived_at || data.squad_bans.some((row) => row.squad_id === squadId && row.user_id === userId) ||
        blocked(userId, squad.owner_id) || !actorRole || !canInviteWithPolicy(actorRole, squad.invite_policy) || !friend ||
        targetId === userId || blocked(userId, targetId) || blocked(squad.owner_id, targetId) ||
        data.squad_bans.some((row) => row.squad_id === squadId && row.user_id === targetId) ||
        data.squad_members.some((row) => row.squad_id === squadId && row.user_id === targetId))
      throw new Error("Your Squad role cannot invite that person.");
    if (!data.squad_invites.some((row) => row.squad_id === squadId && row.recipient_id === targetId))
      data.squad_invites.push({ id: newId(), squad_id: squadId, sender_id: userId, recipient_id: targetId });
    return true;
  }

  if (action === "accept_squad") {
    const invite = data.squad_invites.find((row) => row.id === String(payload.id ?? "") && row.recipient_id === userId);
    const squad = invite && data.squads.find((row) => row.id === invite.squad_id);
    const inviterRole = invite && data.squad_members.find((row) => row.squad_id === invite.squad_id && row.user_id === invite.sender_id)?.role;
    if (!invite || !squad || squad.archived_at || !inviterRole || !canInviteWithPolicy(inviterRole, squad.invite_policy) ||
        data.squad_bans.some((row) => row.squad_id === squad.id && row.user_id === invite.sender_id) ||
        blocked(userId, invite.sender_id) || blocked(userId, squad.owner_id) ||
        data.squad_bans.some((row) => row.squad_id === squad.id && row.user_id === userId) ||
        (squad.discoverability === "community" && !parentEligibleFor("squad", squad.id, userId)))
      throw new Error("That Squad invitation is no longer available.");
    if (!data.squad_members.some((row) => row.squad_id === squad.id && row.user_id === userId))
      data.squad_members.push({ squad_id: squad.id, user_id: userId, role: "member" });
    data.squad_invites = data.squad_invites.filter((row) => row !== invite);
    return true;
  }

  if (action === "organize_squad_into_space") {
    const squadId = String(payload.squad_id ?? "");
    const squad = data.squads.find((row) => row.id === squadId);
    if (!squad || squad.archived_at || squad.owner_id !== userId || !data.squad_members.some((row) => row.squad_id === squadId && row.user_id === userId && row.role === "owner"))
      throw new Error("Only the Squad owner can organize it into a Space.");
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "");
    const copyMembers = payload.copy_members === true;
    if (name.length < 2 || name.length > 60 || description.length > 500)
      throw new Error("Check the Space name and description.");
    if (copyMembers && payload.confirm_member_copy !== true)
      throw new Error("Confirm that current Squad members will become Space members.");
    const eligibleMembers = data.squad_members.filter((row) => row.squad_id === squadId && row.user_id !== userId &&
      data.profiles.some((profile) => profile.id === row.user_id) && !blocked(userId, row.user_id) &&
      !data.squad_bans.some((ban) => ban.squad_id === squadId && ban.user_id === row.user_id));
    if (copyMembers && payload.expected_member_count !== undefined && payload.expected_member_count !== eligibleMembers.length)
      throw new Error("The eligible Squad roster changed. Review the current members and confirm again.");
    const now = new Date().toISOString();
    const spaceId = newId();
    data.spaces.push({
      id: spaceId,
      owner_id: userId,
      name,
      description,
      created_at: now,
      space_type: payload.space_type === "club" || payload.space_type === "academic" || payload.space_type === "sports" || payload.space_type === "residence" || payload.space_type === "interest" || payload.space_type === "local_community" || payload.space_type === "professional" ? payload.space_type : "other",
      discoverability: payload.discoverability === "public" || payload.discoverability === "community" ? payload.discoverability : "private",
      join_mode: payload.join_mode === "open" || payload.join_mode === "request" ? payload.join_mode : "invite",
      invite_policy: payload.invite_policy === "elders" || payload.invite_policy === "members" ? payload.invite_policy : "admins",
    });
    data.space_members.push({ space_id: spaceId, user_id: userId, role: "owner", status: "active", invited_by: null, created_at: now });
    data.space_squads.push({ space_id: spaceId, squad_id: squadId, added_by: userId, created_at: now });
    let copiedCount = 0;
    let skippedBlockedCount = 0;
    if (copyMembers) {
      for (const member of data.squad_members.filter((row) => row.squad_id === squadId && row.user_id !== userId)) {
        if (!data.profiles.some((profile) => profile.id === member.user_id) || blocked(userId, member.user_id) ||
            data.squad_bans.some((ban) => ban.squad_id === squadId && ban.user_id === member.user_id)) {
          skippedBlockedCount++;
          continue;
        }
        const role: SocialMemberRole = member.role === "coowner" || member.role === "admin" || member.role === "elder" ? member.role : "member";
        data.space_members.push({ space_id: spaceId, user_id: member.user_id, role, status: "active", invited_by: userId, created_at: now });
        copiedCount++;
      }
    }
    if (payload.rename_general === true) squad.name = "General";
    return { space_id: spaceId, copied_member_count: copiedCount, skipped_member_count: skippedBlockedCount, source_squad_id: squadId };
  }

  return false;

  function parentEligibleFor(type: string, id: string, personId: string) {
    if (type === "organization") return false;
    if (type === "space") return data.organization_spaces.some((link) => {
      const parent = data.organizations.find((row) => row.id === link.organization_id);
      return link.space_id === id && !!parent && !parent.archived_at && !blocked(personId, parent.owner_id) &&
        !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === personId) &&
        activeOrganizationRole(parent, data.organization_members, personId) !== null;
    });
    return data.space_squads.some((link) => {
      const parent = data.spaces.find((row) => row.id === link.space_id);
      return link.squad_id === id && !!parent && !parent.archived_at && !blocked(personId, parent.owner_id) &&
        !data.space_bans.some((ban) => ban.space_id === parent.id && ban.user_id === personId) &&
        data.space_members.some((member) => member.space_id === parent.id && member.user_id === personId && member.status === "active");
    }) || data.organization_squads.some((link) => {
      const parent = data.organizations.find((row) => row.id === link.organization_id);
      return link.squad_id === id && !!parent && !blocked(personId, parent.owner_id) &&
        !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === personId) &&
        activeOrganizationRole(parent, data.organization_members, personId) !== null;
    }) || data.space_squads.some((link) => data.organization_spaces.some((parentLink) => {
      const parent = data.organizations.find((row) => row.id === parentLink.organization_id);
      const space = data.spaces.find((row) => row.id === link.space_id);
      return link.squad_id === id && link.space_id === parentLink.space_id && !!space && !space.archived_at &&
        data.space_members.some((member) => member.space_id === space.id && member.user_id === personId && member.status === "active") &&
        !!parent && !parent.archived_at && !blocked(personId, parent.owner_id) &&
        !data.organization_bans.some((ban) => ban.organization_id === parent.id && ban.user_id === personId) &&
        activeOrganizationRole(parent, data.organization_members, personId) !== null;
    }));
  }
}

export function demoAction(previous: Data, action: string, p: Payload): Data {
  const d = structuredClone(previous),
    id = String(p.id ?? ""),
    uid = DEMO_ID;
  const newId = () => "demo-" + Math.random().toString(36).slice(2);
  const currentProfile = d.profiles.find((profile) => profile.id === uid)!;
  if (applyDemoBeaconMediaTeamAction(d, action, p, uid)) return d;
  if (applyDemoModuleCollectionAction(d, action, p, uid, newId)) return d;
  if (
    [
      "create_routine",
      "join_plan",
      "leave_plan",
      "pause_routine",
      "resume_routine",
      "skip_routine_next",
      "end_routine",
      "edit_routine",
      "run_routine_once",
    ].includes(action)
  ) {
    const additions = applyPlanRoutineDemo(
      d,
      action as PlanRoutineDemoAction,
      p,
      uid,
    );
    for (const routine of additions.plan_routines) {
      const index = d.plan_routines.findIndex((row) => row.id === routine.id);
      if (index < 0) d.plan_routines.push(routine);
      else d.plan_routines[index] = routine;
    }
    d.plans.push(...additions.plans);
    d.activities.push(...additions.activities);
    d.places.push(...additions.places);
    d.plan_members = d.plan_members.filter(
      (member) =>
        !additions.remove_plan_members.some(
          (removed) =>
            removed.plan_id === member.plan_id &&
            removed.user_id === member.user_id,
        ),
    );
    for (const member of additions.plan_members) {
      if (
        !d.plan_members.some(
          (row) =>
            row.plan_id === member.plan_id && row.user_id === member.user_id,
        )
      ) {
        d.plan_members.push(member);
      }
    }
    return d;
  }
  if (action === "save_profile_privacy") {
    const visibility = p.profile_visibility,
      personIds = p.person_ids ?? [],
      squadIds = p.squad_ids ?? [],
      listIds = p.list_ids ?? [],
      organizationIds = p.organization_ids ?? [],
      arrays = [personIds, squadIds, listIds, organizationIds];
    if (
      (visibility !== "public" &&
        visibility !== "friends" &&
        visibility !== "custom") ||
      arrays.some(
        (value) =>
          !Array.isArray(value) || value.some((id) => typeof id !== "string"),
      )
    )
      throw new Error("Choose a valid profile audience.");
    const [people, squads, lists, organizations] = arrays as string[][];
    if (
      people.length > 200 ||
      squads.length > 50 ||
      lists.length > 100 ||
      organizations.length > 50
    )
      throw new Error("Your custom profile audience is too large.");
    if (
      [people, squads, lists, organizations].some(
        (items) => new Set(items).size !== items.length,
      )
    )
      throw new Error("Choose each audience member once.");
    if (
      visibility !== "custom" &&
      arrays.some((value) => (value as unknown[]).length > 0)
    )
      throw new Error(
        "Custom audience selections are only used in Custom mode.",
      );
    if (
      people.some(
        (personId) =>
          personId === uid ||
          !d.profiles.some((profile) => profile.id === personId) ||
          d.blocks.some(
            (block) =>
              (block.blocker_id === uid && block.blocked_id === personId) ||
              (block.blocker_id === personId && block.blocked_id === uid),
          ),
      )
    )
      throw new Error("Choose valid, unblocked people.");
    if (
      squads.some(
        (squadId) =>
          !d.squad_members.some(
            (member) => member.squad_id === squadId && member.user_id === uid,
          ),
      )
    )
      throw new Error("Choose squads you currently belong to.");
    if (
      lists.some(
        (listId) =>
          !d.lists.some((list) => list.id === listId && list.owner_id === uid),
      )
    )
      throw new Error("Choose your own private friend lists.");
    if (
      organizations.some((organizationId) => {
        const organization = d.organizations.find(
          (item) => item.id === organizationId,
        );
        return (
          !organization ||
          activeOrganizationRole(organization, d.organization_members, uid) ===
            null
        );
      })
    )
      throw new Error("Choose organizations you currently belong to.");
    currentProfile.profile_visibility = visibility;
    d.profile_visibility_grants = d.profile_visibility_grants.filter(
      (grant) => grant.owner_id !== uid,
    );
    if (visibility === "custom") {
      d.profile_visibility_grants.push(
        ...people.map((target_id) => ({
          owner_id: uid,
          kind: "person" as const,
          target_id,
        })),
        ...squads.map((target_id) => ({
          owner_id: uid,
          kind: "squad" as const,
          target_id,
        })),
        ...lists.map((target_id) => ({
          owner_id: uid,
          kind: "list" as const,
          target_id,
        })),
        ...organizations.map((target_id) => ({
          owner_id: uid,
          kind: "organization" as const,
          target_id,
        })),
      );
    }
    return d;
  }
  if (applyDemoOrganizationAction(d, action, p, uid, newId)) return d;
  if (applyDemoSpaceAction(d, action, p, uid, newId)) return d;
  if (applyDemoSocialMembershipAction(d, action, p, uid, newId)) return d;
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
          !currentProfile.aspiration_goals.some(
            (goal) => goal.id === aspirationId,
          ),
      )
    )
      throw new Error("Choose aspirations from your profile.");
    return [...new Set(ids as string[])];
  };
  const isFriend = (personId: string) =>
    d.friendships.some(
      (friendship) =>
        friendship.status === "accepted" &&
        ((friendship.sender_id === uid &&
          friendship.recipient_id === personId) ||
          (friendship.recipient_id === uid &&
            friendship.sender_id === personId)),
    );
  const currentControlValues = (activity: Data["activities"][number]) =>
    beaconControlValuesFromActivity(activity);
  if (action === "set_beacon_controls") {
    const activity = d.activities.find(
      (item) => item.id === (p.activity_id ?? id),
    );
    if (!activity || !canManageBeaconSettings(d, activity, uid))
      throw new Error(
        "Only the beacon owner or a current co-owner can change settings.",
      );
    if (activity.status !== "scheduled")
      throw new Error("Beacon settings are read-only after the beacon ends.");
    const values: BeaconControlValues = validateBeaconControlValues({
      ...currentControlValues(activity),
      ...p,
    });
    if (
      !canSetStrictCapacity(
        d,
        activity,
        values.capacity_limit,
        values.capacity_policy,
      )
    )
      throw new Error(
        "Capacity cannot be lowered below current accepted Going count.",
      );
    Object.assign(activity, values);
    return d;
  }
  if (action === "set_beacon_attendance") {
    const activity = d.activities.find(
        (item) => item.id === (p.activity_id ?? id),
      ),
      targetId = typeof p.user_id === "string" ? p.user_id : uid,
      state = p.state;
    if (
      !activity ||
      (state !== "none" && state !== "arriving" && state !== "present") ||
      !canSetArrivalState(
        d,
        activity,
        uid,
        targetId,
        state as "none" | "arriving" | "present",
      )
    )
      throw new Error(
        "Only an eligible attendee may update their own arrival status.",
      );
    const existing = d.beacon_attendance.find(
      (item) => item.activity_id === activity.id && item.user_id === uid,
    );
    if (existing) existing.state = state as "none" | "arriving" | "present";
    else
      d.beacon_attendance.push({
        activity_id: activity.id,
        user_id: uid,
        state: state as "none" | "arriving" | "present",
        updated_at: new Date().toISOString(),
      });
    return d;
  }
  if (action === "assign_beacon_role" || action === "revoke_beacon_role") {
    const activity = d.activities.find(
        (item) => item.id === (p.activity_id ?? id),
      ),
      targetId = typeof p.user_id === "string" ? p.user_id : "";
    if (!activity) throw new Error("Beacon unavailable.");
    if (action === "assign_beacon_role") {
      const role = p.role;
      if (
        (role !== "coowner" && role !== "admin") ||
        !canAssignBeaconRole(d, activity, uid, targetId, role)
      )
        throw new Error(
          "Choose an eligible Going participant and a role you can assign.",
        );
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
        (item) =>
          !(item.activity_id === activity.id && item.user_id === targetId),
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
  const materializePlanningBeacon = (ownerId: string, draft: BeaconDraft) => {
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
    if (audience === "squad") {
      const squad = audienceId
        ? d.squads.find((item) => item.id === audienceId)
        : undefined;
      if (
        !squad ||
        !d.squad_members.some(
          (member) => member.squad_id === squad.id && member.user_id === uid,
        ) ||
        d.blocks.some(
          (block) =>
            (block.blocker_id === uid && block.blocked_id === squad.owner_id) ||
            (block.blocked_id === uid && block.blocker_id === squad.owner_id),
        )
      )
        throw new Error("Only current Squad members can create a Squad Ping or decision.");
    }
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
    if (
      d.planning_proposals.filter((item) => item.thread_id === thread.id)
        .length >= 30
    )
      throw new Error("This council has reached its proposal limit.");
    if (!draft) throw new Error("Add the proposed beacon details.");
    validateCouncilProposal(thread, draft);
    validatePlanningBeaconDraft(draft);
    if (
      draft.audience !== thread.audience ||
      draft.audience_id !== thread.audience_id
    )
      throw new Error("The proposed beacon must use this council's audience.");
    const requestedId = typeof p.id === "string" && p.id ? p.id : newId(),
      existing = d.planning_proposals.find((item) => item.id === requestedId);
    if (existing) {
      if (existing.thread_id === thread.id && existing.author_id === uid)
        return d;
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
      !canReadPlanningAudience(
        thread.owner_id,
        thread.audience,
        thread.audience_id,
        proposal.author_id,
      )
    )
      throw new Error(
        "Only a current council manager can approve visible options before the deadline.",
      );
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
      !canReadPlanningAudience(
        thread.owner_id,
        thread.audience,
        thread.audience_id,
        proposal.author_id,
      ) ||
      d.blocks.some(
        (block) =>
          (block.blocker_id === uid &&
            block.blocked_id === proposal.author_id) ||
          (block.blocker_id === proposal.author_id && block.blocked_id === uid),
      )
    )
      throw new Error(
        "Choose an approved option that is still visible to you.",
      );
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
    if (!thread || thread.kind === "ping" || !canManageThread(thread))
      throw new Error(
        "Only a current council manager can resolve this council.",
      );
    if (thread.status !== "open") return d;
    if (Date.parse(thread.deadline_at) > Date.now())
      throw new Error("The council deadline has not arrived.");
    const approved = d.planning_proposals.filter(
      (proposal) =>
        proposal.thread_id === thread.id &&
        proposal.approved &&
        proposal.disqualified_at == null &&
        Date.parse(proposal.payload.starts_at) > Date.now() &&
        canReadPlanningAudience(
          thread.owner_id,
          thread.audience,
          thread.audience_id,
          proposal.author_id,
        ),
    );
    if (!approved.length) {
      thread.status = d.planning_proposals.some(
        (proposal) =>
          proposal.thread_id === thread.id &&
          proposal.approved &&
          proposal.disqualified_at == null &&
          canReadPlanningAudience(
            thread.owner_id,
            thread.audience,
            thread.audience_id,
            proposal.author_id,
          ),
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
            !d.blocks.some(
              (block) =>
                (block.blocker_id === vote.user_id &&
                  block.blocked_id === first.author_id) ||
                (block.blocker_id === first.author_id &&
                  block.blocked_id === vote.user_id),
            ),
        ).length,
        secondVotes = d.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id &&
            vote.proposal_id === second.id &&
            canReadThread(thread, vote.user_id) &&
            !d.blocks.some(
              (block) =>
                (block.blocker_id === vote.user_id &&
                  block.blocked_id === second.author_id) ||
                (block.blocker_id === second.author_id &&
                  block.blocked_id === vote.user_id),
            ),
        ).length;
      return (
        secondVotes - firstVotes ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id)
      );
    });
    const winner =
      thread.kind === "draw"
        ? approved[Math.floor(Math.random() * approved.length)]
        : ordered[0];
    const activityId = materializePlanningBeacon(
      thread.owner_id,
      winner.payload,
    );
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
      throw new Error(
        "The council winner changed. Refresh before trying again.",
      );
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
      throw new Error(
        "The current winner has started or is no longer replaceable.",
      );
    const alternatives = d.planning_proposals.filter(
      (proposal) =>
        proposal.thread_id === thread.id &&
        proposal.id !== previousProposal.id &&
        proposal.approved &&
        proposal.disqualified_at == null &&
        proposal.activity_id == null &&
        Date.parse(proposal.payload.starts_at) > Date.now() &&
        canReadPlanningAudience(
          thread.owner_id,
          thread.audience,
          thread.audience_id,
          proposal.author_id,
        ),
    );
    if (!alternatives.length)
      throw new Error(
        "There is no other approved option that can still take place.",
      );
    alternatives.sort((first, second) => {
      const firstVotes = d.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id && vote.proposal_id === first.id,
        ).length,
        secondVotes = d.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id && vote.proposal_id === second.id,
        ).length;
      return (
        secondVotes - firstVotes ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id)
      );
    });
    const replacement =
      thread.kind === "draw"
        ? alternatives[Math.floor(Math.random() * alternatives.length)]
        : alternatives[0];
    currentActivity.status = "cancelled";
    previousProposal.disqualified_at = new Date().toISOString();
    const activityId = materializePlanningBeacon(
      thread.owner_id,
      replacement.payload,
    );
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
    const moduleDefaults =
      p.module_defaults == null
        ? (existing?.module_defaults ?? null)
        : (p.module_defaults as Record<string, unknown>);
    if (moduleDefaults) {
      const known = [
        "enable_chat",
        "enable_checklist",
        "enable_journal",
        "enable_experiences",
        "enable_focus",
        "enable_scoreboard",
        "enable_comments",
        "enable_music",
      ];
      if (
        Object.keys(moduleDefaults).some((key) => !known.includes(key)) ||
        Object.values(moduleDefaults).some(
          (value) => typeof value !== "boolean",
        )
      )
        throw new Error("Choose valid template module preferences.");
    }
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
      module_defaults: moduleDefaults,
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
      throw new Error(
        `Write ${isNote ? "1 to 1000 characters" : "1 to 160 characters"}.`,
      );
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
          section_heading: "",
          visibility: "shared",
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
          section_id: null,
          assignee_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
  if (action === "toggle_checklist_item") {
    const item = d.beacon_checklist_items.find((entry) => entry.id === id),
      activity = d.activities.find((entry) => entry.id === item?.activity_id);
    if (
      !item ||
      !activity ||
      !canEditBeaconChecklist(d, activity, uid) ||
      !canWriteBeaconModule(d, activity, uid, "checklist") ||
      d.blocks.some(
        (block) =>
          (block.blocker_id === uid && block.blocked_id === item.author_id) ||
          (block.blocked_id === uid && block.blocker_id === item.author_id),
      )
    )
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
    if (
      !item ||
      !activity ||
      !canDeleteBeaconModuleEntry(d, activity, item.author_id, uid) ||
      !canWriteBeaconModule(
        d,
        activity,
        uid,
        isNote ? "journal" : "checklist",
      ) ||
      (!isNote && !canEditBeaconChecklist(d, activity, uid))
    )
      throw new Error("This item is unavailable or cannot be deleted.");
    if (isNote)
      d.beacon_notes = d.beacon_notes.filter((entry) => entry.id !== id);
    else
      d.beacon_checklist_items = d.beacon_checklist_items.filter(
        (entry) => entry.id !== id,
      );
  }
  if (action === "edit_beacon_note") {
    const note = d.beacon_notes.find((entry) => entry.id === id),
      activity = d.activities.find((entry) => entry.id === note?.activity_id),
      body = typeof p.body === "string" ? p.body.trim() : "",
      expectedRevision = Number(p.expected_revision);
    if (
      !note ||
      !activity ||
      !canWriteBeaconModule(d, activity, uid, "journal")
    )
      throw new Error("This beacon journal is paused or unavailable.");
    if (note.author_id !== uid || !canAddBeaconNote(d, activity, uid))
      throw new Error("Only the note author can edit this shared note.");
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
      throw new Error("Refresh the note before editing it.");
    if (note.revision === expectedRevision + 1 && note.body === body) return d;
    if (note.revision !== expectedRevision)
      throw new Error(
        "This note changed. Your draft is still here; refresh and resolve before saving.",
      );
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
        ? d.library_folders.find(
            (item) => item.id === id && item.owner_id === uid,
          )
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
      if (
        d.library_folders.filter(
          (item) => item.owner_id === uid && item.kind === kind,
        ).length >= 30
      )
        throw new Error("You can create up to 30 folders in each library.");
      const now = new Date().toISOString();
      const folderId = typeof p.id === "string" && p.id ? p.id : newId();
      d.library_folders.push({
        id: folderId,
        owner_id: uid,
        kind,
        name,
        parent_id: null,
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
      if (!folder)
        throw new Error("Choose one of your folders in this library.");
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
      } else d.library_folder_items.push(assignment);
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
      p.identity_tags = [
        ...new Set((p.identity_tags as string[]).map((tag) => tag.trim())),
      ];
    }
    if (Object.hasOwn(p, "aspiration_goals")) {
      if (!Array.isArray(p.aspiration_goals) || p.aspiration_goals.length > 20)
        throw new Error("Choose up to 20 aspirations.");
      p.aspiration_goals = p.aspiration_goals.map((item) => {
        const goal = item as Record<string, unknown>;
        const title = typeof goal.title === "string" ? goal.title.trim() : "",
          category =
            typeof goal.category === "string" ? goal.category.trim() : "",
          target = Number(goal.target_per_week);
        if (
          typeof goal.id !== "string" ||
          !goal.id.trim() ||
          !title ||
          title.length > 100 ||
          !category ||
          category.length > 60 ||
          !Number.isInteger(target) ||
          target < 1 ||
          target > 7
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
      throw new Error(
        "Add a template title and a description under 1000 characters.",
      );
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
      throw new Error(
        "Add a plan title and a description under 1000 characters.",
      );
    if (squadId && !isSquadMember(squadId))
      throw new Error("Join that squad before creating a plan for it.");
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    planStartDateIsValid(startDate, timezone);
    let steps;
    if (p.template_id) {
      const template = d.plan_templates.find(
        (item) => item.id === p.template_id,
      );
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
      throw new Error(
        "Beacons in a plan cannot overlap. Choose a suggested time.",
      );
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
    const plan = d.plans.find(
      (item) => item.id === id && item.owner_id === uid,
    );
    if (!plan) throw new Error("Plan unavailable.");
    plan.status = "cancelled";
    for (const activity of d.activities) {
      if (activity.plan_id === plan.id && activity.status === "scheduled")
        activity.status = "cancelled";
    }
  }
  if (action === "create_activity") {
    const socialType = p.social_entity_type;
    const socialEntityId = String(p.social_entity_id ?? "");
    if ((socialType == null) !== (p.social_entity_id == null))
      throw new Error("Choose both a community type and community.");
    let socialEntity: Organization | Space | Squad | undefined;
    if (socialType === "organization") socialEntity = d.organizations.find((row) => row.id === socialEntityId);
    else if (socialType === "space") socialEntity = d.spaces.find((row) => row.id === socialEntityId);
    else if (socialType === "squad") socialEntity = d.squads.find((row) => row.id === socialEntityId);
    else if (socialType != null) throw new Error("Choose an available community.");
    const socialMemberRole: SocialRole | null = socialType === "organization" && socialEntity
      ? activeOrganizationRole(socialEntity as Organization, d.organization_members, uid)
      : socialType === "space"
        ? d.space_members.find((row) => row.space_id === socialEntityId && row.user_id === uid && row.status === "active")?.role ?? null
        : socialType === "squad"
          ? d.squad_members.find((row) => row.squad_id === socialEntityId && row.user_id === uid)?.role ?? null
          : null;
    const socialBanned = socialType === "organization"
      ? d.organization_bans.some((row) => row.organization_id === socialEntityId && row.user_id === uid)
      : socialType === "space"
        ? d.space_bans.some((row) => row.space_id === socialEntityId && row.user_id === uid)
        : d.squad_bans.some((row) => row.squad_id === socialEntityId && row.user_id === uid);
    if (socialType != null && (!socialEntity || socialEntity.archived_at || socialBanned || !socialMemberRole ||
        d.blocks.some((row) => (row.blocker_id === uid && row.blocked_id === socialEntity?.owner_id) ||
          (row.blocked_id === uid && row.blocker_id === socialEntity?.owner_id))))
      throw new Error("Join the selected community before associating this Beacon.");
    validateActivity(p);
    const defaults = defaultBeaconControlValues();
    const controls = validateBeaconControlValues({
      ...defaults,
      capacity_limit: p.capacity_limit ?? defaults.capacity_limit,
      capacity_policy: p.capacity_policy ?? defaults.capacity_policy,
      manual_closed: p.manual_closed ?? defaults.manual_closed,
      enable_chat: p.enable_chat ?? defaults.enable_chat,
      enable_checklist: p.enable_checklist ?? defaults.enable_checklist,
      enable_journal: p.enable_journal ?? defaults.enable_journal,
      enable_experiences: p.enable_experiences ?? defaults.enable_experiences,
      enable_focus: p.enable_focus ?? defaults.enable_focus,
      enable_reactions: p.enable_reactions ?? defaults.enable_reactions,
      enable_comments: p.enable_comments ?? defaults.enable_comments,
      enable_scoreboard: p.enable_scoreboard ?? defaults.enable_scoreboard,
      enable_music: p.enable_music ?? defaults.enable_music,
      checklist_edit_policy:
        p.checklist_edit_policy ?? defaults.checklist_edit_policy,
      music_url: p.music_url ?? defaults.music_url,
      decoration_emoji: p.decoration_emoji ?? defaults.decoration_emoji,
      decoration_accent: p.decoration_accent ?? defaults.decoration_accent,
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
    if (socialType != null) d.activity_social_links.push({
      activity_id: aid,
      entity_type: socialType as ActivitySocialLink["entity_type"],
      entity_id: socialEntityId,
      created_by: uid,
      created_at: new Date().toISOString(),
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
      existing = d.rsvps.find(
        (item) => item.activity_id === id && item.user_id === uid,
      ),
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
      if (
        isApprovedGoing(activity, existing) ||
        existing?.status === "requested"
      )
        return d;
      const requestsApproval =
        (activity.approval_required || activity.mode === "invite") &&
        !existing?.approved;
      if (activity.manual_closed || beaconCapacity(d, activity).full)
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
      d.blocks.some(
        (block) =>
          (block.blocker_id === activity.owner_id &&
            block.blocked_id === targetId) ||
          (block.blocked_id === activity.owner_id &&
            block.blocker_id === targetId),
      )
    )
      throw new Error("Invite an accepted friend to an active beacon.");
    if (existing && ["going", "requested", "invited"].includes(existing.status))
      return d;
    d.activity_exclusions = d.activity_exclusions.filter(
      (entry) => !(entry.activity_id === id && entry.user_id === targetId),
    );
    d.rsvps = d.rsvps.filter(
      (item) => !(item.activity_id === id && item.user_id === targetId),
    );
    d.rsvps.push({
      activity_id: id,
      user_id: targetId,
      status: "invited",
      approved: true,
    });
    if (
      !d.beacon_invitation_grants.some(
        (item) => item.activity_id === id && item.user_id === targetId,
      )
    )
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
    if (
      !activity ||
      !request ||
      request.status !== "requested" ||
      !canAdmitBeaconParticipants(d, activity, uid)
    )
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
    if (
      !d.activity_exclusions.some(
        (entry) => entry.activity_id === id && entry.user_id === targetId,
      )
    )
      d.activity_exclusions.push({ activity_id: id, user_id: targetId });
  }
  if (action === "comment") {
    const activity = d.activities.find((item) => item.id === id);
    if (!activity || !canWriteBeaconModule(d, activity, uid, "comments"))
      throw new Error("Comments are paused or unavailable for this beacon.");
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
      discoverability: p.discoverability === "public" || p.discoverability === "community" ? p.discoverability : "private",
      join_mode: p.join_mode === "open" || p.join_mode === "request" ? p.join_mode : "invite",
      invite_policy: p.invite_policy === "elders" || p.invite_policy === "members" ? p.invite_policy : "admins",
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
      (x) =>
        x.author_id !== id &&
        !d.activities.every((a) => a.id !== x.activity_id),
    );
    d.beacon_notes = d.beacon_notes.filter(
      (x) =>
        x.author_id !== id &&
        !d.activities.every((a) => a.id !== x.activity_id),
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
