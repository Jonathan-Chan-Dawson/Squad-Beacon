import test from "node:test";
import assert from "node:assert/strict";
import {
  beaconTemplateCatalog,
  beaconTemplateGroups,
  searchBeaconTemplates,
  templates,
} from "@/src/shared/templates";
import {
  durationMinutesForLabel,
  formatDurationLabel,
  resolveActivityEndAt,
} from "@/src/features/beacons/createTiming";

const groups = new Map(beaconTemplateGroups.map((group) => [group.id, group]));
const recipe = (groupId: string, title: string) => {
  const result = beaconTemplateCatalog.find(
    (item) => item.groupId === groupId && item.title === title,
  );
  assert.ok(result, `${groupId} should include ${title}`);
  return result;
};

test("the catalog has 18 stable groups and keeps three quick starts", () => {
  assert.equal(beaconTemplateGroups.length, 18);
  assert.equal(groups.size, 18);
  assert.deepEqual(
    templates.map(({ id }) => id),
    ["quick-coffee", "quick-study", "quick-walk"],
  );
  assert.deepEqual(
    templates.map(({ title }) => title),
    ["Coffee together", "Study together", "Go for a walk"],
  );
});

test("catalog recipes have unique deterministic ids and valid mapped data", () => {
  const ids = beaconTemplateCatalog.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("study-learning/general-study"));
  assert.ok(ids.includes("gaming/dungeons-and-dragons"));
  for (const item of beaconTemplateCatalog) {
    assert.ok(item.id);
    assert.ok(item.title.trim());
    assert.ok(item.groupId && groups.has(item.groupId));
    assert.ok(["Fitness", "Study", "Gaming", "Creative", "Social", "Other"].includes(item.category));
    assert.ok(Number.isInteger(item.minutes) && item.minutes >= 5 && item.minutes <= 1440);
    assert.ok(item.description?.trim());
    assert.ok(item.prepPrompts?.length);
    assert.ok(
      item.suggestedTools?.every((tool) =>
        ["chat", "checklist", "notes", "focus", "memories", "music", "scoreboard"].includes(tool),
      ),
    );
  }
});

test("search matches recipe names and groups without losing group scope", () => {
  assert.deepEqual(
    searchBeaconTemplates("COFFEE").map((item) => item.groupId),
    ["hangout-social", "food-dining"],
  );
  assert.equal(searchBeaconTemplates("coffee", "food-dining").length, 1);
  assert.equal(searchBeaconTemplates("nature birdwatching")[0]?.title, "Birdwatching");
  assert.equal(searchBeaconTemplates("not a real activity").length, 0);
  assert.equal(searchBeaconTemplates("").length, beaconTemplateCatalog.length);
});

test("recipe overrides map cross-category ideas and choose usable durations", () => {
  assert.equal(recipe("nature-outdoors", "Scenic Drive").category, "Other");
  assert.equal(recipe("nature-outdoors", "Fishing").category, "Other");
  assert.equal(recipe("nature-outdoors", "Birdwatching").category, "Other");
  assert.equal(recipe("nature-outdoors", "Stargazing").category, "Other");
  assert.equal(recipe("nature-outdoors", "Camping").category, "Other");
  assert.equal(recipe("nature-outdoors", "Outdoor Photography").category, "Creative");
  assert.equal(recipe("hangout-social", "Game Night").category, "Gaming");
  assert.equal(recipe("transportation-meetup", "Walk Together").category, "Fitness");
  assert.equal(recipe("transportation-meetup", "Bike Together").category, "Fitness");
  assert.equal(recipe("routine-repeating", "Tuesday Study Group").category, "Study");
  assert.equal(recipe("routine-repeating", "Game Night").category, "Gaming");
  assert.equal(recipe("routine-repeating", "Morning Walk").minutes, 30);
  assert.equal(recipe("food-dining", "Coffee").minutes, 30);
  assert.ok(groups.get("routine-repeating")!.description.includes("does not schedule recurrence"));
});

test("module recommendations reuse one catalog and cover the brief's core recipes", () => {
  assert.deepEqual(recipe("study-learning", "General Study").suggestedTools, [
    "chat",
    "focus",
    "checklist",
    "notes",
  ]);
  assert.deepEqual(recipe("sports-fitness", "Basketball").suggestedTools, [
    "chat",
    "memories",
    "scoreboard",
  ]);
  assert.ok(recipe("food-dining", "Dinner").suggestedTools?.includes("chat"));
  assert.ok(recipe("nature-outdoors", "Camping").suggestedTools?.includes("memories"));
  assert.deepEqual(recipe("travel-trip", "Road Trip").suggestedTools, [
    "chat",
    "checklist",
    "notes",
    "memories",
  ]);
});

test("template durations stay relative to the effective start until custom end is chosen", () => {
  const effectiveStart = Date.parse("2026-10-01T18:30:00.000Z");
  const staleEnd = "2026-10-01T12:00:00.000Z";
  const label = formatDurationLabel(recipe("study-learning", "Group Project").minutes);

  assert.equal(formatDurationLabel(90), "90 min");
  assert.equal(durationMinutesForLabel(label, "", ""), 60);
  assert.equal(
    resolveActivityEndAt(effectiveStart, "90 min", staleEnd),
    new Date(effectiveStart + 90 * 60000).toISOString(),
  );
  assert.equal(
    resolveActivityEndAt(effectiveStart, "Custom", staleEnd),
    staleEnd,
  );
});

