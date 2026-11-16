import { resolvePremiumFeature } from "../src/shared/entitlements";
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import {
  validateAgenda,
  agendaTime,
  type AgendaSettings,
} from "../src/features/beacons/agenda";
import { decodeFocus } from "../src/features/beacons/focusTimer";
import {
  activityPremiumPresets,
  activityAgendaPreset,
} from "../src/features/beacons/activityPremiumPresets";

const agenda: AgendaSettings = {
  enabled: true,
  steps: [
    {
      id: "prep",
      label: "Equipment",
      offset: -60,
      minutes: 15,
      reminder: 30,
      organizer: null,
      tasks: [],
      state: "planned",
    },
  ],
};
test("agenda tiers, presets, stale revisions and downgrade continuity", () => {
  let d = makeDemo();
  const payload = {
    activity_id: "demo-tools",
    kind: "agenda",
    settings: { agenda },
    revision: -1,
  };
  assert.throws(
    () => demoAction(d, "save_tool_config", payload),
    /PREMIUM_REQUIRED/,
  );
  d = demoAction(
    { ...d, demo_premium_tier: "plus" },
    "save_tool_config",
    payload,
  );
  assert.equal(
    d.premium_tool_configs?.find((c) => c.kind === "agenda")?.revision,
    0,
  );
  assert.throws(
    () => demoAction(d, "save_tool_config", { ...payload, revision: -1 }),
    /changed/,
  );
  const pro = {
    ...agenda,
    steps: agenda.steps.map((s) => ({
      ...s,
      organizer: DEMO_ID,
      state: "active" as const,
    })),
  };
  assert.throws(
    () =>
      demoAction(d, "save_tool_config", {
        ...payload,
        settings: { agenda: pro },
        revision: 0,
      }),
    /PREMIUM_REQUIRED/,
  );
  d = demoAction({ ...d, demo_premium_tier: "pro" }, "save_tool_config", {
    ...payload,
    settings: { agenda: pro },
    revision: 0,
  });
  d = demoAction(d, "save_tool_preset", {
    id: "preset",
    kind: "agenda",
    title: "Practice",
    settings: { agenda: pro },
  });
  assert.equal(
    d.premium_presets?.find((p) => p.id === "preset")?.settings.agenda?.steps[0]
      .organizer,
    null,
  );
  d = demoAction({ ...d, demo_premium_tier: "free" }, "clear_tool_config", {
    activity_id: "demo-tools",
    kind: "agenda",
    revision: 1,
  });
  assert.equal(
    d.premium_presets?.find((p) => p.id === "preset")?.title,
    "Practice",
  );
});
test("agenda validation rejects malformed timing, duplicate stages and foreign links", () => {
  assert.throws(
    () =>
      validateAgenda({
        ...agenda,
        steps: [{ ...agenda.steps[0], minutes: 0 }],
      }),
    /valid/,
  );
  assert.throws(
    () =>
      validateAgenda({ ...agenda, steps: [agenda.steps[0], agenda.steps[0]] }),
    /valid/,
  );
  const d = { ...makeDemo(), demo_premium_tier: "pro" as const };
  assert.throws(
    () =>
      demoAction(d, "save_tool_config", {
        activity_id: "demo-tools",
        kind: "agenda",
        settings: {
          agenda: {
            ...agenda,
            steps: [{ ...agenda.steps[0], tasks: ["missing"] }],
          },
        },
        revision: -1,
      }),
    /this Beacon/,
  );
  const a = d.activities.find((a) => a.id === "demo-tools")!;
  assert.equal(
    agendaTime(a, agenda.steps[0]),
    Date.parse(a.starts_at) - 3600000,
  );
});
test("task prerequisites reject cycles and survive downgrades without limiting Free items", () => {
  let d = { ...makeDemo(), demo_premium_tier: "pro" as const };
  for (const id of ["first", "second"])
    d = demoAction(d, "add_checklist_item", {
      id,
      activity_id: "demo-tools",
      text: id,
    }) as typeof d;
  d = demoAction(d, "save_task_coordination", {
    id: "second",
    priority: "high",
    prerequisite_id: "first",
    revision: 0,
  }) as typeof d;
  assert.throws(
    () =>
      demoAction(d, "save_task_coordination", {
        id: "first",
        priority: "normal",
        prerequisite_id: "second",
        revision: 0,
      }),
    /cycle/,
  );
  assert.throws(
    () =>
      demoAction(d, "save_task_coordination", {
        id: "second",
        priority: "normal",
        prerequisite_id: null,
        revision: 0,
      }),
    /changed/,
  );
  const free = demoAction(
    { ...d, demo_premium_tier: "free" },
    "save_task_coordination",
    { id: "second", priority: "normal", prerequisite_id: null, revision: 1 },
  );
  assert.equal(
    free.beacon_checklist_items.find((t) => t.id === "second")?.prerequisite_id,
    null,
  );
});
test("shared hosting questions accept Free participant answers and keep stale edits isolated", () => {
  let d = {
    ...makeDemo(),
    demo_premium_tier: "pro" as "free" | "plus" | "pro",
  };
  const hosting = {
    enabled: true,
    questions: [{ id: "needs", label: "Preparation needs" }],
    groups: ["Team A"],
    check_in: true,
    coordinators: [],
  };
  d = demoAction(d, "save_tool_config", {
    activity_id: "demo-tools",
    kind: "hosting",
    settings: { hosting },
    revision: -1,
  }) as typeof d;
  d = demoAction({ ...d, demo_premium_tier: "free" }, "save_rsvp_answers", {
    activity_id: "demo-tools",
    answers: { needs: "Bring notebook" },
    revision: -1,
  }) as typeof d;
  assert.equal(d.attendee_details?.[0].answers?.needs, "Bring notebook");
  assert.throws(
    () =>
      demoAction(d, "save_rsvp_answers", {
        activity_id: "demo-tools",
        answers: { foreign: "No" },
        revision: 0,
      }),
    /valid answers/,
  );
  d = demoAction(d, "set_agenda_reminders", {
    activity_id: "demo-tools",
    reminders: false,
    revision: 0,
  }) as typeof d;
  assert.throws(
    () =>
      demoAction(d, "set_agenda_reminders", {
        activity_id: "demo-tools",
        reminders: true,
        revision: 0,
      }),
    /changed/,
  );
});
test("timer recovery retains private goals/history and rejects malformed history", () => {
  const value = {
    timer: {
      durationSeconds: 60,
      remainingSeconds: 60,
      phase: "running",
      deadline: 10000,
    },
    mode: "Standard",
    pomodoro: "Focus",
    minutes: "1",
    steps: [],
    index: 0,
    summary: false,
    completed: 1,
    goal: "Read",
    history: [
      {
        id: "one",
        ended_at: "2026-11-15T12:00:00Z",
        minutes: 25,
        goal: "Read",
      },
    ],
  };
  const restored = decodeFocus(JSON.stringify(value), 11000);
  assert.equal(restored?.timer.phase, "complete");
  assert.equal(restored?.history?.[0].goal, "Read");
  assert.equal(
    decodeFocus(JSON.stringify({ ...value, history: [{ goal: 5 }] })),
    null,
  );
});
test("Afterglow credits require revocable Free consent; Plus can arrange existing tools", () => {
  let d = {
    ...makeDemo(),
    demo_premium_tier: "pro" as "free" | "plus" | "pro",
  };
  const recap = {
    id: "recap",
    activity_id: "demo-tools",
    title: "Our day",
    introduction: "Highlights",
    memory_ids: [],
    layout: "timeline",
    participant_ids: [DEMO_ID],
    revision: -1,
  };
  assert.throws(() => demoAction(d, "save_memory_recap", recap), /consenting/);
  d = demoAction({ ...d, demo_premium_tier: "free" }, "set_recap_consent", {
    activity_id: "demo-tools",
    allowed: true,
  }) as typeof d;
  d = demoAction(
    { ...d, demo_premium_tier: "pro" },
    "save_memory_recap",
    recap,
  ) as typeof d;
  assert.equal(d.memory_recaps?.[0].layout, "timeline");
  d = demoAction({ ...d, demo_premium_tier: "free" }, "set_recap_consent", {
    activity_id: "demo-tools",
    allowed: false,
  }) as typeof d;
  assert.equal(d.recap_consents?.[0].allowed, false);
  d = demoAction({ ...d, demo_premium_tier: "plus" }, "save_tool_config", {
    activity_id: "demo-tools",
    kind: "appearance",
    settings: { module_order: ["focus", "checklist"] },
    revision: -1,
  }) as typeof d;
  assert.throws(
    () =>
      demoAction(d, "save_tool_config", {
        activity_id: "demo-tools",
        kind: "appearance",
        settings: {
          sections: [
            { id: "s", title: "Itinerary", body: "Meet at trailhead" },
          ],
        },
        revision: 0,
      }),
    /PREMIUM_REQUIRED/,
  );
});
test("round scores update existing totals once per accepted revision and retain Free scoring", () => {
  let d = {
    ...makeDemo(),
    demo_premium_tier: "pro" as "free" | "plus" | "pro",
  };
  const a = d.activities.find((a) => a.id === "demo-tools")!;
  a.enable_scoreboard = true;
  const existing = d.premium_tool_configs?.find(
    (c) => c.activity_id === a.id && c.kind === "teams",
  );
  d = demoAction(d, "save_tool_config", {
    activity_id: a.id,
    kind: "teams",
    settings: {
      team_names: [],
      score_steps: [{ label: "Goal", points: 3 }],
      round_names: ["First", "Final"],
    },
    revision: existing?.revision ?? -1,
  }) as typeof d;
  d = demoAction(d, "create_beacon_team", {
    activity_id: a.id,
    id: "round-team",
    name: "Red",
  }) as typeof d;
  d = demoAction(d, "record_round_score", {
    team_id: "round-team",
    round_name: "First",
    delta: 3,
    revision: -1,
  }) as typeof d;
  assert.equal(d.beacon_teams.find((t) => t.id === "round-team")?.score, 3);
  assert.equal(d.round_scores?.[0].score, 3);
  assert.throws(
    () =>
      demoAction(d, "record_round_score", {
        team_id: "round-team",
        round_name: "First",
        delta: 3,
        revision: -1,
      }),
    /changed/,
  );
  assert.throws(
    () =>
      demoAction({ ...d, demo_premium_tier: "plus" }, "record_round_score", {
        team_id: "round-team",
        round_name: "First",
        delta: 1,
        revision: 0,
      }),
    /PREMIUM_REQUIRED/,
  );
  d = demoAction(
    { ...d, demo_premium_tier: "free" },
    "adjust_beacon_team_score",
    { team_id: "round-team", delta: 1 },
  ) as typeof d;
  assert.equal(d.beacon_teams.find((t) => t.id === "round-team")?.score, 4);
  for (const p of activityPremiumPresets)
    assert.ok(validateAgenda(activityAgendaPreset(p.title)).steps.length);
});

test("pooled Squad entitlement enables agendas without granting personal presets or consuming Boosts",()=>{
  let d=makeDemo();
  const sid=d.squad_members.find(m=>m.user_id===DEMO_ID)!.squad_id;
  d.activities=d.activities.map(a=>a.id==="demo-tools"?{...a,audience:"squad",audience_id:sid}:a);
  d=demoAction(d,"demo_squad_boost_total",{squad_id:sid,total:2});
  d=demoAction(d,"save_tool_config",{activity_id:"demo-tools",kind:"agenda",settings:{agenda},revision:-1});
  assert.throws(()=>demoAction(d,"save_tool_preset",{id:"squad-personal",kind:"agenda",title:"Personal",settings:{agenda}}),/PREMIUM_REQUIRED/);
  const a=d.activities.find(a=>a.id==="demo-tools")!;
  assert.equal(resolvePremiumFeature(d,"agendas",a).available,true);
  d=demoAction(d,"demo_squad_boost_total",{squad_id:sid,total:4});
  assert.equal(resolvePremiumFeature(d,"agenda_coordination",a).available,true);
  assert.equal(d.boost_allocations?.length??0,0);
  d={...d,squad_members:d.squad_members.filter(m=>!(m.squad_id===sid&&m.user_id===DEMO_ID))};
  assert.equal(resolvePremiumFeature(d,"agendas",a).available,false);
  assert.equal(d.premium_tool_configs?.find(c=>c.kind==="agenda")?.settings.agenda?.steps[0].label,"Equipment");
});
test("linked Council workflows use canonical decisions and strip links from personal presets",()=>{
  let d={...makeDemo(),demo_premium_tier:"pro" as "free"|"plus"|"pro"};
  const ids:string[]=[];
  for(const title of ["Choose destination","Choose activity"]) {
    const prior=new Set(d.planning_threads.map(t=>t.id));
    d=demoAction(d,"create_planning_thread",{kind:"vote",title,body:"",audience:"friends",audience_id:null,deadline_at:new Date(Date.now()+86400000).toISOString(),coowner_ids:[]}) as typeof d;
    ids.push(d.planning_threads.find(t=>!prior.has(t.id))!.id);
  }
  const settings={groups:[],explanations:false,readiness:false,workflow:ids.map((thread_id,index)=>({thread_id,label:`Stage ${index+1}`}))};
  assert.throws(()=>demoAction({...d,demo_premium_tier:"plus"},"save_tool_config",{thread_id:ids[0],kind:"council",settings,revision:-1}),/PREMIUM_REQUIRED/);
  d=demoAction(d,"save_tool_config",{thread_id:ids[0],kind:"council",settings,revision:-1}) as typeof d;
  d=demoAction(d,"save_tool_preset",{id:"council-preset",kind:"council",title:"Decisions",settings}) as typeof d;
  assert.deepEqual(d.premium_presets?.find(p=>p.id==="council-preset")?.settings.workflow,[]);
  assert.throws(()=>demoAction(d,"save_tool_config",{thread_id:ids[0],kind:"council",settings:{...settings,workflow:[{thread_id:"missing",label:"Hidden"}]},revision:0}),/readable Councils/);
});
