import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "@/src/shared/demo";
import { normalizeData, type Data, type PlanStep } from "@/src/shared/types";
import {
  premiumCatalog,
  resolvePersonalEntitlements,
  resolveBeaconEntitlements,
  resolveSquadEntitlements,
  personalTemplateUsage,
  pauseDemoPremiumRoutines,
  type PremiumTier,
} from "@/src/shared/entitlements";

const demo = (tier: PremiumTier = "free") => ({
  ...normalizeData(makeDemo()),
  demo_premium_tier: tier,
});
const template = {
  name: "A favorite",
  title: "Walk",
  category: "Social",
  minutes: 30,
  label: "",
  description: "",
};
const step: PlanStep = {
  title: "Coffee",
  description: "",
  category: "Social",
  location_name: "",
  lat: null,
  lng: null,
  day_offset: 0,
  start_time: "18:00",
  duration_minutes: 30,
  aspiration_ids: [],
};
const schedule = {
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  interval_weeks: 1,
  confirmed_source: true,
};

for (const tier of ["free", "plus", "pro"] as const) {
  test(`${tier}: personal quotas count saved content and preserve edits`, () => {
    let data: Data = demo(tier);
    const e = resolvePersonalEntitlements(data, DEMO_ID);
    assert.equal(e.source, "simulated");
    assert.equal(e.tier, tier);
    assert.equal(e.checklistItems, null);
    assert.equal(e.bringItems, true);
    const limit = e.beaconTemplates ?? 55;
    data.templates = [];
    for (let i = 0; i < limit; i++)
      data = demoAction(data, "save_template", {
        ...template,
        name: `Saved ${i}`,
      });
    assert.equal(personalTemplateUsage(data, DEMO_ID).beacon_templates, limit);
    if (e.beaconTemplates !== null)
      assert.throws(
        () => demoAction(data, "save_template", template),
        /PREMIUM_QUOTA/,
      );
    else data = demoAction(data, "save_template", template);
    const first = data.templates[0];
    data = demoAction(data, "save_template", { ...first, name: "Edited" });
    assert.equal(data.templates.find((t) => t.id === first.id)?.name, "Edited");
    data.plan_templates = [];
    const count = e.planTemplates ?? 12;
    for (let i = 0; i < count; i++)
      data = demoAction(data, "save_plan_template", {
        title: `Plan ${i}`,
        timezone: "UTC",
        steps: [step],
      });
    if (e.planTemplates !== null)
      assert.throws(
        () =>
          demoAction(data, "save_plan_template", {
            title: "Extra",
            timezone: "UTC",
            steps: [step],
          }),
        /PREMIUM_QUOTA/,
      );
    assert.equal(e.squadBoosts, premiumCatalog[tier].squadBoosts);
    assert.equal(e.advancedCoordination, tier === "pro");
  });

  test(`${tier}: single recurrence is Free and multi recurrence follows owner eligibility`, () => {
    let data: Data = demo(tier);
    data = demoAction(data, "create_plan", {
      title: "One Beacon",
      timezone: "UTC",
      start_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      steps: [step],
    });
    const single = data.plans.at(-1)!;
    data = demoAction(data, "create_routine", {
      ...schedule,
      plan_id: single.id,
    });
    assert.equal(
      data.plan_routines.find((r) => r.plan_id === single.id)?.status,
      "active",
    );
    data = demoAction(data, "create_plan", {
      title: "Two Beacons",
      timezone: "UTC",
      start_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      steps: [step, { ...step, title: "Walk", start_time: "19:00" }],
    });
    const multi = data.plans.at(-1)!;
    if (tier === "free") {
      assert.throws(
        () =>
          demoAction(data, "create_routine", {
            ...schedule,
            plan_id: multi.id,
          }),
        /PREMIUM_REQUIRED/,
      );
      data = demoAction(data, "create_routine", {
        ...schedule,
        plan_id: multi.id,
        run_mode: "manual",
      });
      const manual = data.plan_routines.find((r) => r.plan_id === multi.id)!;
      data = demoAction(data, "run_routine_now", { id: manual.id });
      assert.ok(data.plans.length > 2);
    } else {
      data = demoAction(data, "create_routine", {
        ...schedule,
        plan_id: multi.id,
      });
      const routine = data.plan_routines.find((r) => r.plan_id === multi.id)!;
      const before = structuredClone(data);
      data = pauseDemoPremiumRoutines({ ...data, demo_premium_tier: "free" });
      assert.deepEqual(data.activities, before.activities);
      assert.deepEqual(data.templates, before.templates);
      assert.equal(
        data.plan_routines.find((r) => r.id === routine.id)?.status,
        "paused",
      );
      assert.throws(
        () => demoAction(data, "resume_routine", { id: routine.id }),
        /PREMIUM_REQUIRED/,
      );
      data.demo_premium_tier = tier;
      assert.equal(
        data.plan_routines.find((r) => r.id === routine.id)?.status,
        "paused",
      );
      data = demoAction(data, "resume_routine", { id: routine.id });
      assert.equal(
        data.plan_routines.find((r) => r.id === routine.id)
          ?.premium_pause_reason,
        null,
      );
    }
  });
}

test("verified entitlements fail closed and never inherit personal limits into Squads", () => {
  const data: Data = {
    ...demo("pro"),
    is_demo: false,
    capabilities: { premium: true },
    premium: {
      owner_id: DEMO_ID,
      tier: "plus",
      source: "verified",
      valid_until: "2030-01-01T00:00:00Z",
      usage: { beacon_templates: 0, plan_templates: 0 },
    },
  };
  assert.equal(
    resolvePersonalEntitlements(data, DEMO_ID, Date.parse("2029-01-01")).tier,
    "plus",
  );
  assert.equal(
    resolvePersonalEntitlements(data, DEMO_ID, Date.parse("2031-01-01")).tier,
    "free",
  );
  assert.equal(
    resolvePersonalEntitlements({ ...data, capabilities: {} }, DEMO_ID).tier,
    "free",
  );
  assert.equal(resolvePersonalEntitlements(data, "another-user").tier, "free");
  assert.equal(resolveSquadEntitlements(data, "squad").tier, "free");
  assert.equal(
    resolveBeaconEntitlements(data, { id: "beacon", owner_id: "another-user" })
      .tier,
    "free",
  );
  assert.equal(normalizeData(data).demo_premium_tier, undefined);
});

test("downgrades retain over-quota templates and permit deletion recovery", () => {
  let data: Data = demo("pro");
  data.templates = [];
  for (let i = 0; i < 11; i++)
    data = demoAction(data, "save_template", template);
  data = pauseDemoPremiumRoutines({ ...data, demo_premium_tier: "free" });
  assert.equal(data.templates.length, 11);
  assert.throws(() => demoAction(data, "save_template", template), /11\/10/);
  data = demoAction(data, "delete_template", { id: data.templates[0].id });
  data = demoAction(data, "delete_template", { id: data.templates[0].id });
  assert.equal(
    demoAction(data, "save_template", template).templates.length,
    10,
  );
});
