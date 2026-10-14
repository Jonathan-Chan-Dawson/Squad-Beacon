import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the actual marker factory and stylesheet without fetching basemap tiles or configuration.
const source = readFileSync("src/features/maps/components/BeaconMap.web.tsx", "utf8");
const marker = source.slice(source.indexOf("    const marker = ("), source.indexOf("    const size = m.getSize();", source.indexOf("    const marker = (")));
const clusterSource = readFileSync("src/features/maps/cluster.ts", "utf8");
const sizing = clusterSource.slice(clusterSource.indexOf("export function markerVisualSize("), clusterSource.indexOf("function validPoint(")).replace("export function", "function");
const script = ts.transpileModule(`
  let zoom = 13;
  const colors = { green: "#218466", ink: "#182c30", white: "#fff" };
  const reducedMotion = false, group = {}, coordinates = [];
  const m = { getZoom: () => zoom };
  let clicks = 0;
  const L = { DomEvent: { disableClickPropagation() {} }, divIcon: icon => icon,
    marker: (point, options) => ({ addTo() {
      const wrapper = document.createElement("div");
      wrapper.className = "leaflet-marker-icon leaflet-interactive beacon-marker";
      wrapper.style.cssText = ` + "`position:absolute;left:180px;top:300px;width:${options.icon.iconSize[0]}px;height:${options.icon.iconSize[1]}px;margin-left:${-options.icon.iconAnchor[0]}px;margin-top:${-options.icon.iconAnchor[1]}px;`" + `;
      wrapper.dataset.anchor = JSON.stringify(options.icon.iconAnchor);
      wrapper.append(options.icon.html); document.body.append(wrapper);
    } }) };
  ${sizing}
  ${marker}
  window.renderMarker = (input) => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = input.zoom;
    marker(41.88, -87.64, "?", "Test Beacon", () => clicks++, false, 0, "#218466", input.selected, false, "", "unknown", true, input.chip);
  };
  window.markerClicks = () => clicks;
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const css = readFileSync("components/leaflet.web.css", "utf8");

test("web Beacon ripple stays at the badge center across dot/full sizes, chips, selection, animation and reduced motion", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  for (const zoom of [11, 13]) for (const chip of ["", "20m left"]) for (const selected of [false, true]) {
    await page.evaluate((input) => (window as any).renderMarker(input), { zoom, chip, selected });
    for (const currentTime of [0, 500, 1500]) {
      const result = await page.evaluate((time) => {
        const halo = document.querySelector(".map-now-halo") as HTMLElement;
        halo.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; });
        const badge = halo.parentElement!.lastElementChild as HTMLElement;
        const wave = halo.getBoundingClientRect(), face = badge.getBoundingClientRect();
        return { x: wave.x + wave.width / 2 - face.x - face.width / 2,
          y: wave.y + wave.height / 2 - face.y - face.height / 2,
          anchor: document.querySelector(".beacon-marker")!.getAttribute("data-anchor"),
          pointerEvents: getComputedStyle(halo).pointerEvents };
      }, currentTime);
      expect(Math.abs(result.x)).toBeLessThan(0.1);
      expect(Math.abs(result.y)).toBeLessThan(0.1);
      expect(result.anchor).toBe("[32,40]");
      expect(result.pointerEvents).toBe("none");
    }
    await page.getByRole("button", { name: "Test Beacon" }).click();
  }
  expect(await page.evaluate(() => (window as any).markerClicks())).toBe(8);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const halo = document.querySelector(".map-now-halo") as HTMLElement;
    const badge = halo.parentElement!.lastElementChild as HTMLElement;
    const wave = halo.getBoundingClientRect(), face = badge.getBoundingClientRect();
    return { animation: getComputedStyle(halo).animationName,
      x: wave.x + wave.width / 2 - face.x - face.width / 2,
      y: wave.y + wave.height / 2 - face.y - face.height / 2 };
  });
  expect(reduced.animation).toBe("none");
  expect(Math.abs(reduced.x)).toBeLessThan(0.1);
  expect(Math.abs(reduced.y)).toBeLessThan(0.1);
});
