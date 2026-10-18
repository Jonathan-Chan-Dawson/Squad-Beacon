import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("CARTO style comparison", async ({ page }) => {
  const key = readFileSync(".env", "utf8")
    .match(/^EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  test.skip(!key, "Local basemap credential unavailable");
  await page.setViewportSize({ width: 900, height: 400 });
  await page.setContent(
    '<body style="margin:0;background:#172126;color:white;font:16px sans-serif"><main style="display:flex;gap:12px;padding:12px"></main></body>',
  );
  const styles = ["dark_all", "light_all", "rastertiles/voyager"];
  await page.evaluate(
    ({ styles, key }) => {
      const main = document.querySelector("main")!;
      styles.forEach((style) => {
        const figure = document.createElement("figure");
        figure.style.margin = "0";
        const image = document.createElement("img");
        image.alt = style;
        image.width = image.height = 256;
        image.src = `https://a.basemaps.cartocdn.com/${style}/12/1050/1522.png?key=${encodeURIComponent(key!)}`;
        const caption = document.createElement("figcaption");
        caption.textContent = style;
        figure.append(image, caption);
        main.append(figure);
      });
    },
    { styles, key },
  );
  await expect
    .poll(
      () =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      { timeout: 30000 },
    )
    .toBe(true);
  await page.screenshot({ path: ".expo/carto-review/styles.png" });
});

test("map tiles, attribution, failure recovery, and responsive layout", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const map = page.getByLabel("Beacon map", { exact: true });
  await expect(map).toBeVisible();
  await expect
    .poll(() => map.locator("img.leaflet-tile-loaded").count(), {
      timeout: 30000,
    })
    .toBeGreaterThan(0);
  await expect(
    map.getByRole("link", { name: "CARTO", exact: true }),
  ).toBeVisible();
  await expect(
    map.getByRole("link", { name: "OpenStreetMap", exact: true }),
  ).toBeVisible();
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => map.locator("img.leaflet-tile").evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `.expo/carto-review/map-${width}.png` });
  }
  await page.route("**.basemaps.cartocdn.com/**", (route) => route.abort());
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(
    page.getByRole("button", { name: "Retry basemap", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.unroute("**.basemaps.cartocdn.com/**");
  await page
    .getByRole("button", { name: "Retry basemap", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry basemap", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      () =>
        page
          .getByLabel("Beacon map", { exact: true })
          .locator("img.leaflet-tile-loaded")
          .count(),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});
