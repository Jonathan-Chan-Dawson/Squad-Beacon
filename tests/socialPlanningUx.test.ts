import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import {
  planningInbox,
  planningDestination,
} from "../src/features/planning/inbox";
import {
  applyPingStarter,
  composerSession,
  saveComposerOption,
  completeComposerSession,
  type ComposerDraft,
} from "../src/features/planning/composerSession";
import {
  publishPlanningSession,
  type PlanningCreationSession,
} from "../src/features/planning/creationSession";
import { makeBeaconDraft } from "../src/features/planning/domain";
import { submitPlanning } from "../src/features/planning/submission";

test("compact and expanded submissions share a lock that releases on failure", async () => {
  let finish!: () => void;
  const first = submitPlanning(
    "viewer",
    "thread",
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await assert.rejects(
    submitPlanning("viewer", "thread", async () => {}),
    /already saving/,
  );
  await submitPlanning("other", "thread", async () => {});
  finish();
  await first;
  await assert.rejects(
    submitPlanning("viewer", "thread", async () => {
      throw new Error("failed");
    }),
  );
  await submitPlanning("viewer", "thread", async () => {});
});

const initial = (): ComposerDraft => ({
  title: "",
  body: "",
  audience: "friends",
  audienceId: null,
  startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
  deadline: new Date(Date.now() + 86400000).toISOString(),
  minutes: "60",
  place: "",
  category: "Social",
  options: [
    {
      id: "option-one",
      payload: makeBeaconDraft(new Date(Date.now() + 3 * 86400000), 60),
    },
  ],
  touched: [],
  publication: {},
});

test("answered Pings survive a fresh inbox selection and stop counting as actionable", () => {
  let data = makeDemo();
  const id = "demo-ping-jordan";
  assert.equal(
    planningInbox(data, DEMO_ID, Date.now()).find((row) => row.thread.id === id)
      ?.section,
    "Needs Response",
  );
  data = demoAction(data, "respond_planning_ping", {
    thread_id: id,
    response: "interested",
    auto_rsvp: false,
  });
  const restored = planningInbox(
    structuredClone(data),
    DEMO_ID,
    Date.now(),
  ).find((row) => row.thread.id === id)!;
  assert.equal(restored.section, "Answered & Active");
  assert.equal(restored.response?.response, "interested");
  assert.equal(restored.actionable, false);
  assert.equal(restored.eligible, true);
  assert.equal(
    data.rsvps.some((row) => row.activity_id === id && row.user_id === DEMO_ID),
    false,
  );
});

test("answered Votes retain eligible controls and invalidated choices require a new response", () => {
  let data = makeDemo();
  const id = "demo-vote-weekend";
  const option = planningInbox(data, DEMO_ID, Date.now()).find(
    (row) => row.thread.id === id,
  )!.options[0];
  data = demoAction(data, "vote_council_proposal", {
    thread_id: id,
    proposal_id: option.id,
  });
  let row = planningInbox(data, DEMO_ID, Date.now()).find(
    (row) => row.thread.id === id,
  )!;
  assert.equal(row.section, "Answered & Active");
  assert.equal(row.eligible, true);
  assert.equal(row.vote?.proposal_id, option.id);
  data.planning_proposals.find((row) => row.id === option.id)!.disqualified_at =
    new Date().toISOString();
  row = planningInbox(data, DEMO_ID, Date.now()).find(
    (row) => row.thread.id === id,
  )!;
  assert.equal(row.vote, undefined);
  assert.ok(!row.options.some((row) => row.id === option.id));
});

test("resolved Draws use stored winners; viewer mismatches and blocks reveal no decisions", () => {
  const data = makeDemo();
  const draw = planningInbox(data, DEMO_ID, Date.now()).find(
    (row) => row.thread.kind === "draw" && row.thread.status === "resolved",
  )!;
  assert.equal(draw.section, "History");
  assert.ok(draw.thread.winner_proposal_id);
  assert.ok(draw.thread.materialized_activity_id);
  assert.equal(draw.actionable, false);
  assert.deepEqual(planningInbox(data, "another-viewer", Date.now()), []);
  data.blocks.push({
    blocker_id: DEMO_ID,
    blocked_id: "jordan",
    created_at: new Date().toISOString(),
  });
  assert.ok(
    !planningInbox(data, DEMO_ID, Date.now()).some(
      (row) => row.thread.id === "demo-ping-jordan",
    ),
  );
});

test("participation and explicit management destinations do not point to each other", () => {
  assert.deepEqual(planningDestination("one"), {
    pathname: "/responses",
    params: { threadId: "one" },
  });
  assert.deepEqual(planningDestination("one", "manage"), {
    pathname: "/council/[id]",
    params: { id: "one", mode: "manage" },
  });
});

test("draft and option identities isolate multiple attempts and accounts across handoffs", () => {
  const first = composerSession("viewer", "first", initial);
  const second = composerSession("viewer", "second", initial);
  first.title = "Keep this";
  const payload = { ...first.options[0].payload, title: "Edited option" };
  saveComposerOption("viewer", "first", "option-one", payload);
  assert.throws(() => saveComposerOption("viewer", "first", "option-one", { ...payload, audience: "private" }), /same audience/);
  assert.equal(
    composerSession("viewer", "first", initial).options[0].payload.title,
    "Edited option",
  );
  assert.equal(composerSession("viewer", "first", initial).title, "Keep this");
  assert.equal(second.title, "");
  assert.notEqual(composerSession("other", "first", initial), first);
  assert.throws(() =>
    saveComposerOption("viewer", "first", "missing", payload),
  );
  completeComposerSession("viewer", "first");
  assert.notEqual(composerSession("viewer", "first", initial), first);
});

test("Ping starters preserve edited fields and audience and always propose a real time", () => {
  const draft = initial();
  draft.title = "My question";
  draft.audience = "squad";
  draft.audienceId = "squad-one";
  draft.touched = ["title"];
  const now = Date.now();
  for (const id of ["free", "try", "nearby"]) {
    applyPingStarter(draft, id, now);
    assert.equal(draft.title, "My question");
    assert.equal(draft.audienceId, "squad-one");
    assert.ok(Date.parse(draft.startsAt) > Date.parse(draft.deadline));
    assert.ok(Date.parse(draft.deadline) > now);
  }
});

test("ambiguous publication retries frozen payloads and IDs and never repeats confirmed options", async () => {
  const session: PlanningCreationSession = {};
  const calls: { action: string; id?: string; title: unknown }[] = [];
  let fail = true;
  let counter = 0;
  const options = [
    { ...initial().options[0].payload, title: "First" },
    { ...initial().options[0].payload, title: "Second" },
  ];
  const act = async (
    action: string,
    payload: Record<string, unknown>,
    id?: string,
  ) => {
    calls.push({
      action,
      id,
      title:
        (payload.payload as Record<string, unknown> | undefined)?.title ??
        payload.title,
    });
    if (action === "create_planning_thread") return { id: "thread-one" };
    if (
      (payload.payload as Record<string, unknown>).title === "Second" &&
      fail
    ) {
      fail = false;
      throw new Error("Connection lost after commit");
    }
    return {
      id: `confirmed-${(payload.payload as Record<string, unknown>).title}`,
    };
  };
  await assert.rejects(
    publishPlanningSession(
      session,
      { title: "Original" },
      options,
      act,
      () => `request-${++counter}`,
    ),
  );
  options[1].title = "Changed after failure";
  await publishPlanningSession(session, { title: "Changed" }, options, act);
  assert.equal(
    calls.filter((row) => row.action === "create_planning_thread").length,
    1,
  );
  assert.equal(calls.filter((row) => row.title === "First").length, 1);
  assert.equal(calls[2].id, calls[3].id);
  assert.equal(calls[3].title, "Second");
});

test("an unverified thread result never starts option publication", async () => {
  const session: PlanningCreationSession = {};
  let count = 0;
  await assert.rejects(
    publishPlanningSession(
      session,
      { title: "Original" },
      [initial().options[0].payload],
      async () => {
        count++;
        return {};
      },
      () => "stable-id",
    ),
  );
  assert.equal(count, 1);
  assert.equal(session.attempt?.requestId, "stable-id");
  assert.equal(session.threadId, undefined);
});
