import { expect, type Page } from "@playwright/test";

export async function openBeaconFromMap(page: Page, title: string) {
  const pin = page.getByRole("button", { name: `Map: ${title}`, exact: true });
  if (await pin.count()) {
    await pin.click();
    return;
  }
  const clusters = page.getByRole("button", { name: /^Map cluster:/ });
  const count = await clusters.count();
  for (let index = 0; index < count; index++) {
    await clusters.nth(index).click();
    const panel = page.getByTestId("map-cluster-panel");
    await expect(panel).toBeVisible();
    const target = panel.getByRole("button", {
      name: `Expand ${title} in map cluster`,
      exact: true,
    });
    if (await target.count()) {
      await target.click();
      await page
        .getByRole("button", { name: "Open Beacon", exact: true })
        .click();
      return;
    }
    await panel.getByRole("button", { name: "Close map cluster" }).click();
  }
  throw new Error(`Beacon ${title} was not present in any map cluster.`);
}
