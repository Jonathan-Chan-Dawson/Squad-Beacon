import test from "node:test";
import assert from "node:assert/strict";
import { demoAction, makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  isSquadIconKey,
  squadIconKey,
} from "../src/features/people/squadIcons";
import { selectHubConversations } from "../src/features/people/hubState";

test("legacy Squad identities use a real group icon and chosen icons follow authorized conversation rows", () => {
  assert.equal(squadIconKey(undefined), "users");
  assert.equal(squadIconKey("invalid"), "users");
  assert.equal(isSquadIconKey("coffee"), true);
  const data = makeDemo();
  data.squads.find((row) => row.id === "boxing")!.icon_key = "fitness";
  assert.equal(
    selectHubConversations(data, DEMO_ID).find((row) => row.id === "boxing")!
      .iconKey,
    "fitness",
  );
  data.squad_members = data.squad_members.filter(
    (row) => row.user_id !== DEMO_ID,
  );
  assert.equal(
    selectHubConversations(data, DEMO_ID).some((row) => row.id === "boxing"),
    false,
  );
});

test("demo Squad icon changes require an active admin and preserve existing identity and history", () => {
  let data = demoAction(makeDemo(), "create_squad", {
    name: "My icon crew",
    description: "Crew",
  });
  const squad_id = data.squads.at(-1)!.id;
  const count = data.squads.length;
  data = demoAction(data, "update_squad_icon", {
    squad_id,
    icon_key: "coffee",
  });
  assert.equal(data.squads.length, count);
  assert.equal(data.squads.at(-1)!.icon_key, "coffee");
  assert.equal(data.squads.at(-1)!.name, "My icon crew");
  assert.throws(
    () =>
      demoAction(data, "update_squad_icon", { squad_id, icon_key: "invalid" }),
    /valid Squad icon/,
  );
  data.squad_members.find((row) => row.squad_id === "boxing" && row.user_id === DEMO_ID)!.role = "member";
  assert.throws(
    () =>
      demoAction(data, "update_squad_icon", {
        squad_id: "boxing",
        icon_key: "sports",
      }),
    /current Squad admins/,
  );
  data.squad_members = data.squad_members.filter(
    (row) => row.squad_id !== squad_id,
  );
  assert.throws(
    () =>
      demoAction(data, "update_squad_icon", { squad_id, icon_key: "sports" }),
    /current Squad admins/,
  );
});
