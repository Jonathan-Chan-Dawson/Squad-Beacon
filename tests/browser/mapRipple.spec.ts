import { getDesignColorTheme } from "../../src/theme/data";
import { themeNames } from "../../src/theme/palettes";
import {
  mapIdentityColors,
  BEACON_PULSE_DURATION,
  BEACON_PULSE_SCALE,
} from "../../src/features/maps/markerIdentity";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the actual marker factory and stylesheet without fetching basemap tiles or configuration.
const source = readFileSync(
  "src/features/maps/components/BeaconMap.web.tsx",
  "utf8",
);
const marker = source.slice(
  source.indexOf("    const marker = ("),
  source.indexOf(
    "    const size = m.getSize();",
    source.indexOf("    const marker = ("),
  ),
);
const clusterSource = readFileSync("src/features/maps/cluster.ts", "utf8");
const sizing = clusterSource
  .slice(
    clusterSource.indexOf("export function markerVisualSize("),
    clusterSource.indexOf("function validPoint("),
  )
  .replace("export function", "function");
const script = ts.transpileModule(
  `
  let zoom = 13;
  let resolvedAppearance = "light";
  const mapIdentityColors = ${JSON.stringify(mapIdentityColors)};
  let colors = { green: "#218466", ink: "#182c30", white: "#fff", success: "#176B4A", outline: "#718078", surface: "#fff", textPrimary: "#182c30" };
  const reducedMotion = false, group = {}, coordinates = [];
  const onPick = undefined, identityViewer = "viewer";
  const BEACON_PULSE_DURATION = ${BEACON_PULSE_DURATION}, BEACON_PULSE_SCALE = ${BEACON_PULSE_SCALE};
  const m = { getZoom: () => zoom };
  let clicks = 0;
  const L = { DomEvent: { disableClickPropagation() {} }, divIcon: icon => icon,
    marker: (point, options) => ({ addTo() {
      const wrapper = document.createElement("div");
      wrapper.className = "leaflet-marker-icon leaflet-interactive beacon-marker";
      wrapper.style.cssText = ` +
    "`position:absolute;left:180px;top:300px;width:${options.icon.iconSize[0]}px;height:${options.icon.iconSize[1]}px;margin-left:${-options.icon.iconAnchor[0]}px;margin-top:${-options.icon.iconAnchor[1]}px;`" +
    `;
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
  window.renderIdentityMarker = input => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = 16;
    resolvedAppearance = input.appearance;
    colors = input.colors ?? colors;
    document.body.style.background = colors.surface;
    const result = marker(41.88, -87.64, "?", "Test Beacon, " + (input.owned ? "Your Beacon, " : "") + "Saved, Friend-hosted, Live", () => clicks++, false, 0, "#218466", false, false, "", "unknown", true, "", { owned: input.owned, saved: true, friendHosted: true, live: true }, input.owned, input.compact, false);
    if (input.compact) document.body.append(result);
  };
  window.markerClicks = () => clicks;
`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
const css = readFileSync("components/leaflet.web.css", "utf8");

test("web Beacon ripple stays at the badge center across dot/full sizes, chips, selection, animation and reduced motion", async ({
  page,
}) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  for (const zoom of [11, 13])
    for (const chip of ["", "20m left"])
      for (const selected of [false, true]) {
        await page.evaluate((input) => (window as any).renderMarker(input), {
          zoom,
          chip,
          selected,
        });
        for (const currentTime of [0, 500, 1500]) {
          const result = await page.evaluate((time) => {
            const halo = document.querySelector(".map-now-halo") as HTMLElement;
            halo.getAnimations().forEach((animation) => {
              animation.pause();
              animation.currentTime = time;
            });
            const badge = halo.parentElement!.querySelector(
              ":scope > span:nth-child(2)",
            )! as HTMLElement;
            const wave = halo.getBoundingClientRect(),
              face = badge.getBoundingClientRect();
            return {
              x: wave.x + wave.width / 2 - face.x - face.width / 2,
              y: wave.y + wave.height / 2 - face.y - face.height / 2,
              anchor: document
                .querySelector(".beacon-marker")!
                .getAttribute("data-anchor"),
              pointerEvents: getComputedStyle(halo).pointerEvents,
            };
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
    const badge = halo.parentElement!.querySelector(
      ":scope > span:nth-child(2)",
    )! as HTMLElement;
    const wave = halo.getBoundingClientRect(),
      face = badge.getBoundingClientRect();
    return {
      animation: getComputedStyle(halo).animationName,
      x: wave.x + wave.width / 2 - face.x - face.width / 2,
      y: wave.y + wave.height / 2 - face.y - face.height / 2,
    };
  });
  expect(reduced.animation).toBe("none");
  expect(Math.abs(reduced.x)).toBeLessThan(0.1);
  expect(Math.abs(reduced.y)).toBeLessThan(0.1);
});

test("ownership, saved and friend signals remain legible without competing badges", async ({
  page,
}) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  for (const theme of themeNames)
    for (const appearance of ["light", "dark"] as const) {
      const semantic = getDesignColorTheme(theme, appearance).colors;
      const colors = {
        ...semantic,
        white: semantic.surface,
        ink: semantic.textPrimary,
        green: semantic.primary,
      };
      for (const owned of [false, true]) {
        await page.evaluate(
          (input) => (window as any).renderIdentityMarker(input),
          { appearance, owned, colors },
        );
        const bookmark = page.getByTestId("beacon-saved-bookmark");
        await expect(bookmark).toHaveCount(Number(!owned));
        await expect(page.getByTestId("beacon-ownership-star")).toHaveCount(
          Number(owned),
        );
        const rim = page.getByTestId("beacon-friend-rim");
        if (owned)
          await expect(page.getByRole("button")).toHaveAccessibleName(
            /Your Beacon/,
          );
        await expect(rim).toHaveCSS("pointer-events", "none");
        await expect(rim).toHaveAttribute("aria-hidden", "true");
        if (!owned) {
          await expect(bookmark).toHaveCSS("pointer-events", "none");
          await expect(bookmark).toHaveAttribute("aria-hidden", "true");
          const badge = page.locator("[data-cluster-face] > span").nth(1);
          const face = (await badge.boundingBox())!,
            saved = (await bookmark.boundingBox())!;
          expect(saved.x).toBeGreaterThan(face.x + face.width / 2);
          expect(saved.y).toBeLessThan(face.y + face.height / 2);
        }
        await expect(page.getByRole("button")).toHaveAccessibleName(
          /Saved, Friend-hosted, Live/,
        );
      }
    }
});

test("pulse expands, fades and stops during gestures; detached petals never animate", async ({
  page,
}) => {
  await page.setContent(
    '<body><div class="beacon-map-moving" id="map"></div></body>',
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate(() =>
    (window as any).renderMarker({ zoom: 13, selected: false, chip: "" }),
  );
  const frames = await page.locator(".map-now-halo").evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    return [0, 500, 1500].map((time) => {
      animation.currentTime = time;
      return {
        width: node.getBoundingClientRect().width,
        opacity: Number(getComputedStyle(node).opacity),
      };
    });
  });
  expect(frames[2].width).toBeGreaterThan(frames[1].width);
  expect(frames[1].width).toBeGreaterThan(frames[0].width);
  expect(frames[2].opacity).toBeLessThan(frames[1].opacity);
  await page.evaluate(() => document.body.classList.add("beacon-map-moving"));
  await expect(page.locator(".map-now-halo")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".map-now-halo")).toHaveCSS("opacity", "0");
  await page.evaluate(() => {
    document.body.classList.remove("beacon-map-moving");
    (window as any).renderIdentityMarker({
      appearance: "light",
      owned: false,
      compact: true,
    });
  });
  await expect(page.locator(".map-now-halo")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
