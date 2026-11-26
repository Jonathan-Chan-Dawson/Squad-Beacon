import { expect, test } from "@playwright/test";
import { makeBeaconDraft } from "../../src/features/planning/domain";
import { makeDemo } from "../../src/shared/demo";
import { mockOnboardingAccount } from "./onboardingAccount";

for (const [kind, label] of [
  ["ping", "Ping"], ["time", "Find a Time"], ["vote", "Vote"], ["draw", "Random Draw"],
] as const) {
  test(`${label} Map pin previews and opens the full item`, async ({ page }, info) => {
    const title = `${label} at the lakefront`;
    await mockOnboardingAccount(page, {
      configureSnapshot(data, viewer) {
        const starts = new Date(Date.now() + 48 * 3600000);
        const payload = {
          ...makeBeaconDraft(starts, 60),
          title,
          label: "Lakefront Park",
          latitude: 41.88,
          longitude: -87.62,
          timezone: "America/Chicago",
        };
        const deadline = new Date(Date.now() + 24 * 3600000).toISOString();
        const host = "92222222-2222-4222-8222-222222222222";
        data.friendships.push({ id: "planning-friends", sender_id: host, recipient_id: viewer, status: "accepted" });
        data.planning_threads.push({
          id: "map-planning", owner_id: host, coowner_ids: [viewer], kind, title,
          body: "", audience: "friends", audience_id: null, deadline_at: deadline,
          status: "open", payload: kind === "ping" || kind === "time" ? payload : null,
          winner_proposal_id: null, replaced_from_proposal_id: null, materialized_activity_id: null,
          created_at: new Date().toISOString(), resolved_at: null,
        });
        if (kind === "time") data.planning_slots = [0, 1, 2].map((offset) => ({
          id: `slot-${offset}`, thread_id: "map-planning",
          starts_at: new Date(starts.getTime() + offset * 86400000).toISOString(),
          ends_at: new Date(starts.getTime() + offset * 86400000 + 3600000).toISOString(),
          timezone: "America/Chicago", retired_at: null,
        }));
        if (kind === "vote" || kind === "draw")
          data.planning_proposals.push(...[1, 2, 3, 4].map((index) => ({
            id: `option-${index}`, thread_id: "map-planning", author_id: viewer,
            payload: { ...payload, title: `Option ${index}`, latitude: index === 1 ? payload.latitude : null, longitude: index === 1 ? payload.longitude : null },
            approved: true, disqualified_at: null, created_at: new Date().toISOString(), activity_id: null,
          })));
      },
    });
    await page.goto("/council/map-planning");
    await page.getByRole("button", { name: "Show on Map", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^${label}: ${kind === "vote" || kind === "draw" ? "Option 1" : title}`) }).click();
    const preview = page.getByTestId("map-planning-preview");
    await expect(preview).toContainText(title);
    await expect(page.getByTestId("map-planning-callout")).toBeVisible();
    await expect(page.getByRole("dialog", { name: label, exact: true })).toHaveCount(0);
    await expect(preview).toContainText("Lakefront Park");
    await page.screenshot({ path: info.outputPath(`${kind}-map.png`) });
    if (kind === "time") {
      await expect(preview.getByTestId(/^time-option-/)).toHaveCount(2);
      const first = preview.getByTestId("time-option-slot-0").getByRole("radio", { name: "Yes", exact: true });
      await first.click();
      await preview.getByRole("button", { name: "See all 3 times", exact: true }).click();
      await expect(preview.getByTestId(/^time-option-/)).toHaveCount(3);
      await expect(first).toHaveAttribute("aria-checked", "true");
    }
    if (kind === "vote" || kind === "draw") {
      await expect(preview.getByText("Option 4", { exact: true })).toHaveCount(0);
      await preview.getByRole("button", { name: `See all 4 ${kind === "vote" ? "options" : "entries"}`, exact: true }).click();
      await expect(preview.getByText("Option 4", { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: `Open ${label}`, exact: true }).click();
    if (kind === "time")
      await page.getByRole("button", { name: "Discard and leave", exact: true }).click();
    await expect(page).toHaveURL(/\/council\/map-planning/);
    await expect(page.getByRole("button", { name: "Show on Map", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${kind}-detail.png`) });
    await page.goBack();
    await expect(page.getByRole("button", { name: `Remove ${label}: ${title} filter`, exact: true })).toBeVisible();
  });
}

test("a linked Beacon card can focus its Random Draw", async ({ page }, info) => {
  await mockOnboardingAccount(page, {
    configureSnapshot(data, viewer) {
      const demo = makeDemo();
      const beacon = demo.activities.find(({ id }) => id === "demo-draw-beacon")!;
      const place = demo.places.find(({ activity_id }) => activity_id === beacon.id)!;
      const draw = demo.planning_threads.find(({ id }) => id === "demo-draw-result")!;
      data.activities.push({ ...beacon, owner_id: viewer, audience: "private", audience_id: null, viewer_can_access: true });
      data.places.push(place);
      data.planning_threads.push({ ...draw, owner_id: viewer, audience: "private", audience_id: null });
    },
  });
  await page.goto("/council/demo-draw-result");
  await page.getByRole("button", { name: "Show on Map", exact: true }).click();
  const filter = page.getByRole("button", { name: /^Remove Random Draw:/ });
  await expect(filter).toBeVisible();
  await page.locator('button[aria-label^="Map: A surprise crew meetup"]').click();
  const related = page.getByRole("button", { name: /^Show Random Draw on Map/ });
  await expect(related).toBeInViewport({ ratio: 0.9 });
  await page.screenshot({ path: info.outputPath("linked-draw.png") });
  await related.click();
  await expect(filter).toBeVisible();
  await expect(related).toHaveCount(0);
  await filter.click();
  await expect(filter).toHaveCount(0);
});
