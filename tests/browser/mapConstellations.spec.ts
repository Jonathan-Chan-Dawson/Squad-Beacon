import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";

// Exercise the actual DOM adapter and shared policy in a browser, without tiles.
const script = buildSync({
  stdin: {
    contents:
      'export { webConstellation } from "./src/features/maps/webConstellation"; export { nativePresentation } from "./src/features/maps/nativeMapPresentation";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "constellations",
  platform: "browser",
}).outputFiles[0].text;

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<div id="map" style="position:relative;margin:120px;width:500px;height:500px"></div>',
  );
  await page.addScriptTag({ content: script });
  await page.addScriptTag({
    content: `
    window.selected = []; window.explorers = 0;
    window.renderConstellation = (count, mode = 'stack', owned = false) => {
      const members = Array.from({length:count}, (_,i) => ({id:'beacon:'+i,kind:'beacon',category:'Social',latitude:41.88 + i*.00001,longitude:-87.64 + i*.00002}));
      const group = {id:'fixture',latitude:41.88,longitude:-87.64,members};
      const presentation = constellations.nativePresentation(group,mode,{},new Set(owned ? ['beacon:0'] : []));
      const rendered = constellations.webConstellation(presentation, {
        member: point => {const button=document.createElement('button');button.textContent=point.id;button.setAttribute('aria-label','Open '+point.id);button.onclick=()=>window.selected.push(point.id);button.style.cssText='width:64px;height:52px;background:white;border:1px solid green';return button},
        open:()=>window.explorers++,ink:'#183d37',surface:'#fff',line:'#ddd',ownership:'#168578',categoryColor:()=> '#168578',reducedMotion:true,
      });
      document.getElementById('map').replaceChildren(rendered.node);
    };
  `,
  });
});

test("small stacks expand, select exact members and collapse with Escape", async ({
  page,
}) => {
  await page.evaluate(() => (window as any).renderConstellation(5));
  const stack = page.getByTestId("map-constellation");
  await stack.locator('[data-member-id="beacon:0"]').click();
  await expect(stack).toHaveAttribute("data-expanded", "true");
  expect(await page.evaluate(() => (window as any).selected)).toEqual([]);
  await stack
    .getByRole("button", { name: "Open beacon:3", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).selected)).toEqual([
    "beacon:3",
  ]);
  expect(await page.evaluate(() => (window as any).explorers)).toBe(0);
  await stack
    .getByRole("button", { name: "Open beacon:1", exact: true })
    .press("Escape");
  await expect(stack).not.toHaveAttribute("data-expanded");
});

for (const count of [6, 10, 11, 14, 25])
  test(`${count} items open the explorer and count only hidden previews`, async ({
    page,
  }) => {
    await page.evaluate((n) => (window as any).renderConstellation(n), count);
    const stack = page.getByTestId("map-constellation");
    await expect(stack.locator(".map-petal-item")).toHaveCount(
      Math.min(count, 10),
    );
    const overflow = page.getByTestId("map-constellation-overflow");
    if (count > 10) await expect(overflow).toHaveText(`+${count - 10}`);
    else await expect(overflow).toHaveCount(0);
    await stack.click({ position: { x: 90, y: 90 } });
    await stack.press("Enter");
    expect(await page.evaluate(() => (window as any).explorers)).toBe(2);
    expect(await page.evaluate(() => (window as any).selected)).toEqual([]);
  });

test("swarm and atmosphere use geographic summary actions with visible ownership", async ({
  page,
}) => {
  for (const mode of ["swarm", "atmosphere"]) {
    await page.evaluate(
      (m) => (window as any).renderConstellation(14, m, true),
      mode,
    );
    const stack = page.getByTestId("map-constellation");
    await expect(stack).toHaveAttribute("data-mode", mode);
    await expect(page.getByTestId("cluster-ownership-star")).toHaveCount(1);
    await expect(page.getByTestId("map-constellation-overflow")).toHaveCount(0);
    await expect(page.getByTestId("map-constellation-spark")).toHaveCount(
      mode === "swarm" ? 14 : 0,
    );
    await stack.press("Space");
  }
  expect(await page.evaluate(() => (window as any).explorers)).toBe(2);
});

test("expanded touch rectangles do not overlap, including identical source locations", async ({
  page,
}) => {
  await page.evaluate(() => (window as any).renderConstellation(5));
  await page
    .getByTestId("map-constellation")
    .locator('[data-member-id="beacon:0"]')
    .click();
  const boxes = await page.locator(".map-petal-item").evaluateAll((items) =>
    items.map((item) => {
      const r = item.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const left = boxes[a],
        right = boxes[b];
      expect(
        left.x + left.width <= right.x ||
          right.x + right.width <= left.x ||
          left.y + left.height <= right.y ||
          right.y + right.height <= left.y,
      ).toBe(true);
    }
});
