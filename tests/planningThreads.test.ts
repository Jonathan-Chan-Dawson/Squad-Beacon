import test from "node:test";
import assert from "node:assert/strict";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  canRespondToPlanningThread,
  chooseVoteWinner,
  hasPlanningQuorum,
  makeBeaconDraft,
  makeCouncilProposalDraft,
  pendingPlanningThreads,
  validateBeaconDraft,
  validateCouncilProposal,
  validatePlanningThreadDraft,
} from "../src/features/planning/domain";
import type {
  PlanningAccessData,
  PlanningData,
  PlanningProposal,
  PlanningThread,
  PlanningVote,
} from "../src/features/planning/types";

const accessData = (overrides: Partial<PlanningAccessData> = {}) =>
  ({
    blocks: [],
    friendships: [],
    lists: [],
    list_members: [],
    squad_members: [],
    squads: [],
    ...overrides,
  }) as PlanningAccessData;

const thread = (
  overrides: Partial<PlanningThread> = {},
): PlanningThread => ({
  id: "thread-1",
  owner_id: "owner",
  coowner_ids: ["coowner"],
  kind: "vote",
  title: "Choose a plan",
  body: "Pick one of the options.",
  audience: "friends",
  audience_id: null,
  deadline_at: "2026-10-02T18:00:00.000Z",
  status: "open",
  payload: null,
  winner_proposal_id: null,
  replaced_from_proposal_id: null,
  materialized_activity_id: null,
  created_at: "2026-10-01T12:00:00.000Z",
  resolved_at: null,
  ...overrides,
});

const proposal = (
  id: string,
  overrides: Partial<PlanningProposal> = {},
): PlanningProposal => ({
  id,
  thread_id: "thread-1",
  author_id: "owner",
  payload: makeBeaconDraft(new Date("2026-10-03T18:00:00.000Z")),
  approved: true,
  disqualified_at: null,
  created_at: "2026-10-01T12:00:00.000Z",
  activity_id: null,
  ...overrides,
});

const planningData = (overrides: Partial<PlanningData> = {}): PlanningData =>
  ({
    planning_threads: [],
    planning_ping_responses: [],
    planning_proposals: [],
    planning_votes: [],
    ...overrides,
  }) as PlanningData;

test("beacon draft and thread validators enforce schema, audience, and deadline ordering", () => {
  const draft = makeBeaconDraft(new Date("2026-10-03T18:00:00.000Z"));
  draft.title = "Dinner together";
  validateBeaconDraft(draft);
  validatePlanningThreadDraft(
    "ping",
    draft.title,
    "Anyone free this weekend?",
    "friends",
    null,
    "2026-10-02T18:00:00.000Z",
    Date.parse("2026-10-01T12:00:00.000Z"),
    draft,
  );
  assert.throws(
    () =>
      validatePlanningThreadDraft(
        "ping",
        draft.title,
        "",
        "friends",
        null,
        "2026-10-03T19:00:00.000Z",
        Date.parse("2026-10-01T12:00:00.000Z"),
        draft,
      ),
    /deadline must be before its beacon starts/,
  );
  assert.throws(
    () => validateBeaconDraft({ ...draft, latitude: 50, longitude: null }),
    /complete map location/,
  );
  assert.throws(
    () =>
      validateCouncilProposal(
        thread(),
        { ...draft, starts_at: "2026-10-02T17:00:00.000Z" },
        Date.parse("2026-10-01T12:00:00.000Z"),
      ),
    /start after the decision deadline/,
  );
});

test("private, friend, list, and squad audiences enforce membership and blocks", () => {
  const data = accessData({
    blocks: [
      { blocker_id: "viewer", blocked_id: "other" },
      { blocker_id: "owner", blocked_id: "other" },
    ],
    friendships: [
      { sender_id: "owner", recipient_id: "viewer", status: "accepted", id: "f1" },
      { sender_id: "owner", recipient_id: "other", status: "accepted", id: "f2" },
    ],
    lists: [{ id: "list-1", owner_id: "owner", name: "Close friends" }],
    list_members: [{ list_id: "list-1", user_id: "viewer" }],
    squads: [{ id: "squad-1", owner_id: "owner", name: "Crew", description: "" }],
    squad_members: [
      { squad_id: "squad-1", user_id: "owner", role: "owner" },
      { squad_id: "squad-1", user_id: "viewer", role: "member" },
    ],
  });
  assert.equal(canReadPlanningThread(data, thread(), "viewer"), true);
  assert.equal(
    canReadPlanningThread(data, thread({ audience: "private" }), "viewer"),
    false,
  );
  assert.equal(
    canReadPlanningThread(
      data,
      thread({ audience: "list", audience_id: "list-1" }),
      "viewer",
    ),
    true,
  );
  assert.equal(
    canReadPlanningThread(
      data,
      thread({ audience: "squad", audience_id: "squad-1" }),
      "viewer",
    ),
    true,
  );
  assert.equal(canReadPlanningThread(data, thread(), "other"), false);
  assert.equal(canManagePlanningThread(thread(), "owner"), true);
  assert.equal(canManagePlanningThread(thread(), "coowner"), true);
  assert.equal(canManagePlanningThread(thread(), "viewer"), false);
});

test("responses close at the deadline and councils require an approved option", () => {
  const friendData = accessData({
    friendships: [
      { id: "f1", sender_id: "owner", recipient_id: "viewer", status: "accepted" },
    ],
  });
  const voteThread = thread();
  assert.equal(
    canRespondToPlanningThread(
      friendData,
      voteThread,
      "viewer",
      Date.parse("2026-10-02T17:59:59.000Z"),
    ),
    true,
  );
  assert.equal(
    canRespondToPlanningThread(
      friendData,
      voteThread,
      "viewer",
      Date.parse("2026-10-02T18:00:00.000Z"),
    ),
    false,
  );
  assert.equal(
    canRespondToPlanningThread(
      friendData,
      thread({ status: "resolved" }),
      "viewer",
      Date.parse("2026-10-01T12:00:00.000Z"),
    ),
    false,
  );
});

test("zero-vote councils fall back to their earliest option and draws need no entrants", () => {
  const proposals = [
    proposal("proposal-b", { created_at: "2026-10-01T12:00:00.000Z" }),
    proposal("proposal-a", { created_at: "2026-10-01T12:00:00.000Z" }),
    proposal("hidden", { approved: false }),
    proposal("removed", { disqualified_at: "2026-10-01T13:00:00.000Z" }),
  ];
  const votes: PlanningVote[] = [
    { thread_id: "thread-1", proposal_id: "proposal-a", user_id: "one", created_at: "" },
    { thread_id: "thread-1", proposal_id: "proposal-b", user_id: "two", created_at: "" },
  ];
  assert.equal(chooseVoteWinner(votes, proposals, "thread-1")?.id, "proposal-a");
  assert.equal(hasPlanningQuorum("vote", [], "thread-1", proposals), true);
  assert.equal(hasPlanningQuorum("vote", votes, "thread-1", proposals), true);
  assert.equal(hasPlanningQuorum("draw", [], "thread-1", proposals), true);
  assert.equal(hasPlanningQuorum("draw", [], "thread-1", [proposal("pending", { approved: false })]), false);
});

test("council proposal recipes inherit the locked audience and start after the deadline", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z");
  const council = thread({
    kind: "vote",
    audience: "list",
    audience_id: "close-friends",
    deadline_at: "2026-10-03T12:00:00.000Z",
  });
  const draft = makeCouncilProposalDraft(
    council,
    { title: "Birdwatching", description: "Lake walk", category: "Other", minutes: 90 },
    now,
  );
  assert.equal(draft.audience, "list");
  assert.equal(draft.audience_id, "close-friends");
  assert.equal(Date.parse(draft.starts_at) > Date.parse(council.deadline_at), true);
  assert.equal(Date.parse(draft.ends_at) - Date.parse(draft.starts_at), 90 * 60 * 1000);
  assert.throws(
    () => validateCouncilProposal(council, { ...draft, starts_at: council.deadline_at }),
    /start after the decision deadline/,
  );
  assert.throws(
    () => validateCouncilProposal(council, { ...draft, audience: "friends", audience_id: null }),
    /Keep every option in this decision's audience/,
  );
});

test("Planning Inbox includes only concrete decisions for the current member", () => {
  const now = Date.parse("2026-10-02T12:00:00.000Z"),
    upcomingPing = thread({ id: "ping", kind: "ping" }),
    answeredPing = thread({ id: "answered", kind: "ping" }),
    openVote = thread({ id: "vote", deadline_at: "2026-10-03T18:00:00.000Z" }),
    dueForOwner = thread({ id: "due", deadline_at: "2026-10-01T18:00:00.000Z" }),
    readyPing = thread({
      id: "ready-ping",
      kind: "ping",
      deadline_at: "2026-10-01T18:00:00.000Z",
      payload: makeBeaconDraft(new Date("2026-10-02T13:00:00.000Z")),
    }),
    stalePing = thread({
      id: "stale-ping",
      kind: "ping",
      deadline_at: "2026-10-01T18:00:00.000Z",
      payload: makeBeaconDraft(new Date("2026-10-02T10:00:00.000Z")),
    });
  const data = accessData({
    friendships: [
      { id: "f1", sender_id: "owner", recipient_id: "viewer", status: "accepted" },
    ],
  });
  const snapshot = planningData({
    planning_threads: [upcomingPing, answeredPing, openVote, dueForOwner, readyPing, stalePing],
    planning_ping_responses: [
      {
        thread_id: "answered",
        user_id: "viewer",
        response: "maybe",
        auto_rsvp: false,
        created_at: "2026-10-01T12:00:00.000Z",
        updated_at: "2026-10-01T12:00:00.000Z",
      },
    ],
    planning_proposals: [proposal("option", { thread_id: "vote" }), proposal("due-option", { thread_id: "due" })],
  });
  assert.deepEqual(
    pendingPlanningThreads(data, snapshot, "viewer", now).map((item) => item.id),
    ["ping", "vote"],
  );
  assert.deepEqual(
    pendingPlanningThreads(data, snapshot, "owner", now).map((item) => item.id),
    ["due", "ready-ping"],
  );
});
