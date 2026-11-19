import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  premiumAccessPresentation,
  squadBenefitProgress,
} from "../src/features/profile/premiumPresentation";

test("benefit hints distinguish locked, personal, shared and simulated access", () => {
  const data = makeDemo();
  data.demo_premium_tier = "free";
  const activity = data.activities.find((a) => a.id === "demo-tools")!;
  assert.ok(activity);
  assert.equal(
    premiumAccessPresentation(data, "checklist_details", activity).label,
    "Requires Plus",
  );
  data.demo_premium_tier = "plus";
  assert.equal(
    premiumAccessPresentation(data, "checklist_details", activity).label,
    "Included",
  );
  assert.equal(
    premiumAccessPresentation(data, "score_rounds", activity).label,
    "Requires Pro",
  );
  data.demo_premium_tier = "pro";
  assert.equal(
    premiumAccessPresentation(data, "score_rounds", activity).label,
    "Included",
  );
  data.demo_premium_tier = "free";
  activity.audience = "squad";
  activity.audience_id = "boxing";
  data.demo_squad_boosts = { boxing: 4 };
  const shared = premiumAccessPresentation(data, "checklist_details", activity);
  assert.equal(shared.label, "Included through your Squad");
  assert.equal(shared.simulated, true);
  const personal = premiumAccessPresentation(
    data,
    "checklist_presets",
    activity,
  );
  assert.equal(personal.label, "Requires Plus");
  assert.match(personal.detail, /own eligible membership/);
});

test("unsupported and expired access never advertise an active entitlement", () => {
  const data = makeDemo();
  data.is_demo = false;
  data.capabilities = {
    ...data.capabilities,
    premium: true,
    premium_tools: true,
    beacon_expansion: false,
  };
  data.premium = {
    owner_id: DEMO_ID,
    tier: "pro",
    source: "verified",
    valid_until: new Date(Date.now() - 1000).toISOString(),
    usage: { beacon_templates: 0, plan_templates: 0 },
  };
  assert.equal(
    premiumAccessPresentation(data, "checklist_details").label,
    "Requires Plus",
  );
  assert.equal(premiumAccessPresentation(data, "agendas").label, "Coming soon");
  assert.equal(premiumAccessPresentation(data, "agendas").simulated, false);
  data.premium.valid_until = null;
  assert.equal(
    premiumAccessPresentation(data, "checklist_details").label,
    "Included",
  );
  assert.equal(premiumAccessPresentation(data, "agendas").label, "Coming soon");
  data.viewer_id = "another-account";
  assert.equal(
    premiumAccessPresentation(data, "checklist_details").label,
    "Requires Plus",
  );
});

test("Squad progress uses 2/4 thresholds and retains grace independently of current qualification", () => {
  const data = makeDemo();
  for (const total of [0, 1, 2, 3, 4, 5, 9]) {
    data.demo_squad_boosts = { boxing: total };
    const state = squadBenefitProgress(data, "boxing");
    assert.equal(
      state.progressLabel,
      total >= 4
        ? "Pro unlocked"
        : `${total}/${total < 2 ? 2 : 4} Boosts toward ${total < 2 ? "Plus" : "Pro"}`,
    );
    assert.ok(state.fraction >= 0 && state.fraction <= 1);
  }
  data.demo_squad_boosts = { boxing: 1 };
  const until = new Date(Date.now() + 3600000).toISOString();
  data.squad_premium = [
    {
      squad_id: "boxing",
      total: 1,
      tier: "plus",
      qualified_tier: "free",
      source: "grace",
      grace_until: until,
      contributors: [],
    },
  ];
  assert.equal(squadBenefitProgress(data, "boxing").tier, "plus");
  assert.equal(
    squadBenefitProgress(data, "boxing").progressLabel,
    "1/2 Boosts toward Plus",
  );
  assert.equal(squadBenefitProgress(data, "boxing").grace_until, until);
  data.squad_premium[0].grace_until = new Date(Date.now() - 1000).toISOString();
  assert.equal(squadBenefitProgress(data, "boxing").tier, "free");
});
