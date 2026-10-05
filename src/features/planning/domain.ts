import type { Audience, Category, Data, ID } from "@/src/shared/types";
import type {
  BeaconDraft,
  PlanningAccessData,
  PlanningData,
  PlanningProposal,
  PlanningThread,
  PlanningThreadKind,
  PlanningVote,
} from "./types";

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
const audiences: Audience[] = ["private", "friends", "list", "squad", "organization"];

export function makeBeaconDraft(
  startAt = new Date(Date.now() + 48 * 60 * 60 * 1000),
  durationMinutes = 60,
): BeaconDraft {
  return {
    title: "",
    description: "",
    category: "Social",
    mode: "squad",
    starts_at: startAt.toISOString(),
    ends_at: new Date(+startAt + durationMinutes * 60000).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
}

export function normalizePlanningData(data: Data): PlanningData {
  const source = data as Data & Partial<PlanningData>;
  return {
    planning_threads: Array.isArray(source.planning_threads)
      ? source.planning_threads
      : [],
    planning_ping_responses: Array.isArray(source.planning_ping_responses)
      ? source.planning_ping_responses
      : [],
    planning_proposals: Array.isArray(source.planning_proposals)
      ? source.planning_proposals
      : [],
    planning_votes: Array.isArray(source.planning_votes)
      ? source.planning_votes
      : [],
  };
}

export function validateAudience(audience: string, audienceId: string | null) {
  if (!audiences.includes(audience as Audience))
    throw new Error("Choose a sharing audience.");
  if ((audience === "list" || audience === "squad" || audience === "organization") !== !!audienceId)
    throw new Error("Choose the private list, squad, or organization for this audience.");
}

export function validateBeaconDraft(draft: BeaconDraft) {
  if (!draft.title.trim() || draft.title.length > 120)
    throw new Error("Give the beacon a title (up to 120 characters).");
  if (draft.description.length > 2000)
    throw new Error("Keep beacon details under 2000 characters.");
  if (!categories.includes(draft.category))
    throw new Error("Choose a valid beacon category.");
  if (draft.mode !== "squad" && draft.mode !== "invite")
    throw new Error("Choose a valid beacon type.");
  validateAudience(draft.audience, draft.audience_id);
  const startsAt = Date.parse(draft.starts_at),
    endsAt = Date.parse(draft.ends_at);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt)
    throw new Error("The end time must be after the start time.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: draft.timezone });
  } catch {
    throw new Error("Choose a valid timezone.");
  }
  if (draft.label.length > 160)
    throw new Error("Keep the location label under 160 characters.");
  if (draft.online_url && !/^https:\/\//i.test(draft.online_url))
    throw new Error("Online links must begin with https://.");
  if (draft.online_url && draft.online_url.length > 2000)
    throw new Error("Keep the online link under 2000 characters.");
  if ((draft.latitude == null) !== (draft.longitude == null))
    throw new Error("Choose a complete map location.");
  if (
    draft.latitude != null &&
    (!Number.isFinite(draft.latitude) ||
      Math.abs(draft.latitude) > 90 ||
      !Number.isFinite(draft.longitude) ||
      Math.abs(draft.longitude!) > 180)
  )
    throw new Error("Choose a valid map location.");
  if (
    draft.target_count != null &&
    (!Number.isInteger(draft.target_count) ||
      draft.target_count < 2 ||
      draft.target_count > 100)
  )
    throw new Error("Choose a crew target from 2 to 100, or leave it blank.");
}

export function validatePlanningThreadDraft(
  kind: PlanningThreadKind,
  title: string,
  body: string,
  audience: string,
  audienceId: string | null,
  deadlineAt: string,
  now = Date.now(),
  payload?: BeaconDraft,
) {
  if (!title.trim() || title.length > 120)
    throw new Error("Give this planning thread a title (up to 120 characters).");
  if (body.length > 500)
    throw new Error("Keep the thread details under 500 characters.");
  validateAudience(audience, audienceId);
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline) || deadline <= now)
    throw new Error("Choose a response deadline in the future.");
  if (kind === "ping") {
    if (!payload) throw new Error("Add the beacon details for this ping.");
    validateBeaconDraft(payload);
    if (Date.parse(payload.starts_at) <= deadline)
      throw new Error("The ping deadline must be before its beacon starts.");
    if (payload.audience !== audience || payload.audience_id !== audienceId)
      throw new Error("The ping and its beacon must use the same audience.");
  } else if (payload) {
    throw new Error("Add Vote or Draw options after starting the decision.");
  }
}

export function validateCouncilProposal(
  thread: PlanningThread,
  payload: BeaconDraft,
  now = Date.now(),
) {
  if (thread.kind !== "vote" && thread.kind !== "draw")
    throw new Error("Pings use one suggested beacon; Vote and Draw use options.");
  if (thread.status !== "open" || Date.parse(thread.deadline_at) <= now)
    throw new Error("The proposal deadline has passed.");
  validateBeaconDraft(payload);
  if (
    payload.audience !== thread.audience ||
    payload.audience_id !== thread.audience_id
  )
    throw new Error("Keep every option in this decision's audience.");
  if (Date.parse(payload.starts_at) <= Date.parse(thread.deadline_at))
    throw new Error("Every option must start after the decision deadline.");
}

export function makeCouncilProposalDraft(
  thread: PlanningThread,
  recipe: Pick<BeaconDraft, "title" | "category"> & {
    minutes: number;
    description?: string;
  },
  now = Date.now(),
) {
  if (thread.kind === "ping")
    throw new Error("Pings use one suggested beacon; Vote and Draw use options.");
  const startAt = Math.max(
    Date.parse(thread.deadline_at) + 60 * 60 * 1000,
    now + 3 * 60 * 60 * 1000,
  );
  const draft = makeBeaconDraft(new Date(startAt), recipe.minutes);
  draft.title = recipe.title;
  draft.description = recipe.description ?? "";
  draft.category = recipe.category;
  draft.audience = thread.audience;
  draft.audience_id = thread.audience_id;
  return draft;
}

function blockedBetween(data: PlanningAccessData, first: ID, second: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === first && block.blocked_id === second) ||
      (block.blocker_id === second && block.blocked_id === first),
  );
}

function acceptedFriend(data: PlanningAccessData, first: ID, second: ID) {
  return (
    first !== second &&
    !blockedBetween(data, first, second) &&
    data.friendships.some(
      (friendship) =>
        friendship.status === "accepted" &&
        ((friendship.sender_id === first && friendship.recipient_id === second) ||
          (friendship.sender_id === second && friendship.recipient_id === first)),
    )
  );
}

function activeOrganizationMember(data: PlanningAccessData, organizationId: ID, personId: ID) {
  const organization = data.organizations.find((item) => item.id === organizationId);
  if (!organization) return false;
  if (organization.owner_id === personId) return true;
  return (
    data.organization_members.some(
      (member) =>
        member.organization_id === organizationId &&
        member.user_id === personId &&
        member.status === "active",
    ) &&
    !data.organization_bans.some(
      (ban) => ban.organization_id === organizationId && ban.user_id === personId,
    )
  );
}

export function canReadPlanningThread(
  data: PlanningAccessData,
  thread: PlanningThread,
  userId: ID,
) {
  if (thread.owner_id === userId) return true;
  if (blockedBetween(data, thread.owner_id, userId)) return false;
  if (thread.audience === "private") return false;
  if (thread.audience === "friends")
    return acceptedFriend(data, thread.owner_id, userId);
  if (thread.audience === "list")
    return (
      acceptedFriend(data, thread.owner_id, userId) &&
      data.lists.some(
        (list) =>
          list.id === thread.audience_id && list.owner_id === thread.owner_id,
      ) &&
      data.list_members.some(
        (member) =>
          member.list_id === thread.audience_id && member.user_id === userId,
      )
    );
  if (thread.audience === "organization") {
    const organizationId = thread.audience_id;
    if (!organizationId) return false;
    const organization = data.organizations.find((item) => item.id === organizationId);
    if (!organization || blockedBetween(data, userId, organization.owner_id)) return false;
    return (
      activeOrganizationMember(data, organizationId, thread.owner_id) &&
      activeOrganizationMember(data, organizationId, userId)
    );
  }
  const squad = data.squads.find((item) => item.id === thread.audience_id);
  return !!(
    squad &&
    !blockedBetween(data, squad.owner_id, userId) &&
    data.squad_members.some(
      (member) =>
        member.squad_id === squad.id && member.user_id === userId,
    ) &&
    data.squad_members.some(
      (member) =>
        member.squad_id === squad.id && member.user_id === thread.owner_id,
    )
  );
}

export function canManagePlanningThread(thread: PlanningThread, userId: ID) {
  return thread.owner_id === userId || thread.coowner_ids.includes(userId);
}

export function canRespondToPlanningThread(
  data: PlanningAccessData,
  thread: PlanningThread,
  userId: ID,
  now = Date.now(),
) {
  return (
    thread.status === "open" &&
    Date.parse(thread.deadline_at) > now &&
    canReadPlanningThread(data, thread, userId)
  );
}

export function visiblePlanningProposals(
  data: PlanningAccessData,
  proposals: PlanningProposal[],
  threadId: ID,
  userId: ID,
) {
  return proposals.filter(
    (proposal) =>
      proposal.thread_id === threadId &&
      !blockedBetween(data, proposal.author_id, userId),
  );
}

export function councilVoteCounts(
  votes: PlanningVote[],
  threadId: ID,
  approvedProposalIds: Set<ID>,
) {
  const counts = new Map<ID, number>();
  for (const vote of votes)
    if (
      vote.thread_id === threadId &&
      vote.proposal_id &&
      approvedProposalIds.has(vote.proposal_id)
    )
      counts.set(vote.proposal_id, (counts.get(vote.proposal_id) ?? 0) + 1);
  return counts;
}

export function chooseVoteWinner(
  votes: PlanningVote[],
  proposals: PlanningProposal[],
  threadId: ID,
): PlanningProposal | undefined {
  const eligible = proposals.filter(
      (proposal) =>
        proposal.thread_id === threadId &&
        proposal.approved &&
        proposal.disqualified_at == null,
    ),
    counts = councilVoteCounts(
      votes,
      threadId,
      new Set(eligible.map((proposal) => proposal.id)),
    );
  return eligible
    .sort(
      (first, second) =>
        (counts.get(second.id) ?? 0) - (counts.get(first.id) ?? 0) ||
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id),
    )[0];
}

export function hasPlanningQuorum(
  kind: "vote" | "draw",
  votes: PlanningVote[],
  threadId: ID,
  proposals: PlanningProposal[],
) {
  void votes; // A vote council uses the deterministic earliest-option fallback when no votes survive.
  const approved = proposals.filter(
      (proposal) =>
        proposal.thread_id === threadId &&
        proposal.approved &&
        proposal.disqualified_at == null,
    );
  if (!approved.length) return false;
  return kind === "draw" || approved.length > 0;
}

export function pendingPlanningThreads(
  accessData: PlanningAccessData,
  planning: PlanningData,
  userId: ID,
  now = Date.now(),
) {
  return planning.planning_threads.filter((thread) => {
    if (!canReadPlanningThread(accessData, thread, userId)) return false;
    if (thread.status !== "open") return false;
    const manages = canManagePlanningThread(thread, userId);
    const deadline = Date.parse(thread.deadline_at),
      threadProposals = visiblePlanningProposals(
        accessData,
        planning.planning_proposals.filter(
          (proposal) =>
            proposal.thread_id === thread.id &&
            canReadPlanningThread(accessData, thread, proposal.author_id),
        ),
        thread.id,
        userId,
      ),
      approvedOptions = threadProposals.filter(
        (proposal) =>
          proposal.approved &&
          proposal.disqualified_at == null &&
          Date.parse(proposal.payload.starts_at) > now,
      );
    if (thread.kind === "ping") {
      if (manages)
        return (
          deadline <= now &&
          !!thread.payload &&
          Date.parse(thread.payload.starts_at) > now
        );
      return (
        deadline > now &&
        thread.owner_id !== userId &&
        !planning.planning_ping_responses.some(
          (response) =>
            response.thread_id === thread.id && response.user_id === userId,
        )
      );
    }
    if (manages && deadline > now && threadProposals.some((option) => !option.approved && option.disqualified_at == null))
      return true;
    if (manages && deadline <= now) return approvedOptions.length > 0;
    if (manages) return false;
    if (thread.kind !== "vote" || deadline <= now || !approvedOptions.length)
      return false;
    const currentVote = planning.planning_votes.find(
      (vote) => vote.thread_id === thread.id && vote.user_id === userId,
    );
    return !approvedOptions.some(
      (proposal) => proposal.id === currentVote?.proposal_id,
    );
  });
}
