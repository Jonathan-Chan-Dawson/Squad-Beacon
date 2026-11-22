import assert from "node:assert/strict";
import test from "node:test";
import { matchingQuests, questBeaconFields, questPing, rollQuest, sideQuests, vibes } from "../src/features/beacons/spontaneity/quests";

test("the shared quest catalog has unique ideas and applies both filters", () => {
  assert.equal(new Set(sideQuests.map((quest) => quest.id)).size, sideQuests.length);
  assert.ok(sideQuests.length >= 60);
  for (const vibe of vibes) assert.ok(matchingQuests(vibe, "Any Activity").length >= 10);
  const study = matchingQuests("Productive", "Study");
  assert.ok(study.length);
  assert.ok(study.every((quest) => quest.vibe === "Productive" && quest.activity === "Study"));
  assert.equal(rollQuest(matchingQuests("Chill", "Study"), []), undefined);
});

test("rerolls skip recent ideas and handle small pools", () => {
  const [first, second, third] = sideQuests;
  assert.equal(rollQuest([first, second, third], [first.id, second.id], () => 0), third);
  assert.equal(rollQuest([first, second], [first.id, second.id], () => 0), second);
  assert.equal(rollQuest([first], [first.id], () => 0), first);
});

test("Beacon ideas populate only draft content and Ping adaptations preserve edits", () => {
  const pizza = sideQuests.find((quest) => quest.id === "pizza")!;
  assert.deepEqual(questBeaconFields(pizza), {
    title: pizza.title, description: pizza.description, duration: "45 min", category: "Social",
  });
  assert.equal(questPing(pizza, pizza.title, pizza.description).title, "Anyone up for pizza?");
  assert.deepEqual(questPing(pizza, " Auburn pizza? ", " Food after class. "), {
    title: "Auburn pizza?", body: "Food after class.", category: "Social",
  });
});
