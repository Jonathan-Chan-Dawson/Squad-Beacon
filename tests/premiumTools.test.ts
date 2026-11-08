import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import {
  resolvePremiumFeature,
  resolveSquadEntitlements,
} from "../src/shared/entitlements";
import {
  boostBalance,
  reconcileDemoBoosts,
} from "../src/features/people/squadBoosts";
import {
  createFocusTimer,
  startFocusTimer,
  decodeFocus,
} from "../src/features/beacons/focusTimer";
import type { Data } from "../src/shared/types";
const tools = "demo-tools";
test("Free checklists exceed the former ceilings; paid details survive a downgrade", () => {
  let d = makeDemo();
  const original = d.beacon_checklist_items.filter(
    (i) => i.activity_id === tools,
  ).length;
  for (let n = 0; n < 55; n++)
    d = demoAction(d, "add_checklist_item", {
      id: `task-${n}`,
      activity_id: tools,
      text: `Pack ${n}`,
    });
  for (let n = 0; n < 32; n++)
    d = demoAction(d, "add_checklist_section", {
      id: `section-${n}`,
      activity_id: tools,
      title: `Section ${n}`,
    });
  assert.equal(
    d.beacon_checklist_items.filter((i) => i.activity_id === tools).length,
    original + 55,
  );
  assert.throws(
    () =>
      demoAction(d, "edit_checklist_item", {
        id: "task-0",
        assignee_id: DEMO_ID,
      }),
    /PREMIUM_REQUIRED/,
  );
  d = demoAction({ ...d, demo_premium_tier: "plus" }, "edit_checklist_item", {
    id: "task-0",
    assignee_id: DEMO_ID,
    due_on: "2028-02-29",
    reminder_minutes: 30,
  });
  d = demoAction({ ...d, demo_premium_tier: "free" }, "toggle_checklist_item", {
    id: "task-0",
    completed: true,
  });
  assert.equal(
    d.beacon_checklist_items.find((i) => i.id === "task-0")?.due_on,
    "2028-02-29",
  );
  d = demoAction(d, "edit_checklist_item", {
    id: "task-0",
    assignee_id: null,
    due_on: null,
    reminder_minutes: null,
  });
  assert.equal(
    d.beacon_checklist_items.find((i) => i.id === "task-0")?.assignee_id,
    null,
  );
  assert.throws(
    () =>
      demoAction(d, "save_library_checklist", {
        title: "Fresh list",
        items: [],
        sections: [],
      }),
    /PREMIUM_REQUIRED/,
  );
});
test("each configurable module enforces its tier and rejects unrelated fields", () => {
  const settings = [
    [
      "focus",
      { steps: [{ label: "Read", minutes: 25 }] },
      { steps: [{ label: "Read", minutes: 25 }], group: "Study" },
    ],
    ["appearance", { style: "ocean" }, { style: "ocean", layout: "session" }],
    [
      "teams",
      {
        team_names: ["Blue", "Gold"],
        score_steps: [{ label: "Goal", points: 3 }],
      },
      {
        team_names: ["Blue", "Gold"],
        score_steps: [{ label: "Goal", points: 3 }],
        rotation: true,
      },
    ],
    ["memories", { title: "Highlights", memory_ids: [], highlights: [] }, null],
  ] as const;
  for (const [kind, plus, pro] of settings) {
    const p = { activity_id: tools, kind, settings: plus, revision: -1 };
    assert.throws(
      () => demoAction(makeDemo(), "save_tool_config", p),
      /PREMIUM_REQUIRED/,
    );
    assert.equal(
      demoAction(
        { ...makeDemo(), demo_premium_tier: "plus" },
        "save_tool_config",
        p,
      ).premium_tool_configs?.length,
      1,
    );
    if (pro) {
      assert.throws(
        () =>
          demoAction(
            { ...makeDemo(), demo_premium_tier: "plus" },
            "save_tool_config",
            { ...p, settings: pro },
          ),
        /PREMIUM_REQUIRED/,
      );
      assert.equal(
        demoAction(
          { ...makeDemo(), demo_premium_tier: "pro" },
          "save_tool_config",
          { ...p, settings: pro },
        ).premium_tool_configs?.length,
        1,
      );
    }
  }
  assert.throws(
    () =>
      demoAction(
        { ...makeDemo(), demo_premium_tier: "pro" },
        "save_tool_preset",
        {
          kind: "appearance",
          title: "Unsafe",
          settings: { style: "ocean", invitee_ids: ["other"] },
        },
      ),
    /Unsupported/,
  );
});
test("simulated Squad totals stay separate from personal allowance and preserve non-extending grace", () => {
  let d: Data = makeDemo();
  const sid = d.squad_members.find((m) => m.user_id === DEMO_ID)!.squad_id;
  d.activities = d.activities.map((a) =>
    a.id === tools ? { ...a, audience: "squad", audience_id: sid } : a,
  );
  d = demoAction(d, "demo_squad_boost_total", { squad_id: sid, total: 4 });
  const a = d.activities.find((a) => a.id === tools)!;
  assert.equal(resolvePremiumFeature(d, "afterglow", a).available, true);
  assert.equal(
    resolvePremiumFeature(d, "journal_formatting", a, true).available,
    false,
  );
  assert.equal(boostBalance(d, DEMO_ID).allocated, 0);
  d = demoAction(d, "demo_squad_boost_total", { squad_id: sid, total: 2 });
  const grace = resolveSquadEntitlements(d, sid).grace_until;
  d = demoAction(d, "demo_squad_boost_total", { squad_id: sid, total: 0 });
  assert.equal(resolveSquadEntitlements(d, sid).tier, "pro");
  assert.equal(resolveSquadEntitlements(d, sid).grace_until, grace);
  d = demoAction(d, "demo_expire_boost_grace", {});
  assert.equal(resolveSquadEntitlements(d, sid).tier, "free");
  assert.equal(
    resolveSquadEntitlements(
      {
        ...d,
        is_demo: false,
        squad_premium: [],
        demo_squad_boosts: { [sid]: 5 },
      },
      sid,
    ).tier,
    "free",
  );
  d = { ...d, demo_premium_tier: "plus" };
  d = demoAction(d, "assign_boost", { squad_id: sid });
  d = demoAction(d, "assign_boost", { squad_id: sid });
  d = demoAction(d, "withdraw_boost", { id: d.boost_allocations![0].id });
  assert.equal(boostBalance(d, DEMO_ID).cooling, 1);
  assert.equal(boostBalance(d, DEMO_ID).available, 0);
  const lost = reconcileDemoBoosts({ ...d, demo_premium_tier: "free" });
  assert.equal(boostBalance(lost, DEMO_ID).allocated, 0);
  assert.equal(lost.activities.length, d.activities.length);
});
test("persisted focus restores elapsed time and rejects invalid intervals", () => {
  const state = {
    timer: startFocusTimer(createFocusTimer(60), 1000),
    mode: "Standard",
    pomodoro: "Focus",
    minutes: "1",
    steps: [{ label: "Focus", minutes: 1 }],
    index: 0,
    summary: true,
    completed: 0,
  };
  assert.equal(
    decodeFocus(JSON.stringify(state), 31000)?.timer.remainingSeconds,
    30,
  );
  assert.equal(
    decodeFocus(JSON.stringify(state), 62000)?.timer.phase,
    "complete",
  );
  assert.equal(
    decodeFocus(
      JSON.stringify({ ...state, steps: [{ label: "Invalid", minutes: -1 }] }),
      31000,
    ),
    null,
  );
});

test("downgrading keeps the oldest Boosts and upgrading preserves transfer waits", () => {
  let d: Data = {...makeDemo(), demo_premium_tier:"pro"};
  const sid=d.squad_members.find(m=>m.user_id===DEMO_ID)!.squad_id;
  for(let i=0;i<5;i++) d=demoAction(d,"assign_boost",{squad_id:sid});
  const oldest=d.boost_allocations!.slice().sort((a,b)=>a.assigned_at.localeCompare(b.assigned_at)||a.id.localeCompare(b.id)).slice(0,2).map(b=>b.id).sort();
  d=reconcileDemoBoosts({...d,demo_premium_tier:"plus"});
  assert.deepEqual(d.boost_allocations!.filter(b=>!b.released_at).map(b=>b.id).sort(),oldest);
  assert.equal(boostBalance(d,DEMO_ID).cooling,3);
  const restored=reconcileDemoBoosts({...d,demo_premium_tier:"pro"});
  assert.equal(boostBalance(restored,DEMO_ID).available,0);
  assert.equal(boostBalance(restored,DEMO_ID).cooling,3);
});
