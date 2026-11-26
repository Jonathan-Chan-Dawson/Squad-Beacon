import { getDesignColorTheme } from "../../src/theme/data";
import { themeNames } from "../../src/theme/palettes";
import { BEACON_NAME_MAX_WIDTH, EMPTY_MARKER_STATE, mapPersonOpacity } from "../../src/features/maps/markerIdentity";
import { beaconPinSymbols } from "../../src/features/maps/beaconPinArtwork";
import { appendBeaconUpperBeam, appendMapProjector, beaconProjectionDimensions, clusterPrism } from "../../src/features/maps/projector";
import { miniAvatarSvg } from "../../src/features/profile/avatarArt";
import { STELLAR_OPACITY, STELLAR_OUTLINE } from "../../src/features/maps/clusterBloom";
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
const glyph = source.slice(
  source.indexOf("function addBeaconGlyph("),
  source.indexOf("\nfunction hasUsableMapViewport("),
);
const clusterSource = readFileSync("src/features/maps/cluster.ts", "utf8");
const sizing = clusterSource
  .slice(
    clusterSource.indexOf("export function markerVisualSize("),
    clusterSource.indexOf("function validPoint("),
  )
  .replace("export function", "function");
const identitySource = readFileSync("src/features/maps/markerIdentity.ts", "utf8");
const lighting = identitySource.slice(
  identitySource.indexOf("export const BEACON_PULSE_DURATION"),
  identitySource.indexOf("/** Prepare once"),
).replace(/^export /gm, "");
const script = ts.transpileModule(
  `
  let zoom = 13;
  let resolvedAppearance = "light";
  const EMPTY_MARKER_STATE = ${JSON.stringify(EMPTY_MARKER_STATE)};
  const BEACON_NAME_MAX_WIDTH = ${BEACON_NAME_MAX_WIDTH};
  const STELLAR_OPACITY = ${STELLAR_OPACITY};
  const STELLAR_OUTLINE = ${JSON.stringify(STELLAR_OUTLINE)};
  let colors = { green: "#218466", ink: "#182c30", white: "#fff", success: "#176B4A", outline: "#718078", surface: "#fff", textPrimary: "#182c30" };
  const reducedMotion = false, group = {}, coordinates = [];
  const onPick = undefined, identityViewer = "viewer";
  ${lighting}
  const mapPersonOpacity = ${mapPersonOpacity.toString()};
  const clusterPrism = ${JSON.stringify(clusterPrism)};
  const appendMapProjector = ${appendMapProjector.toString()};
  const appendBeaconUpperBeam = ${appendBeaconUpperBeam.toString()};
  const beaconProjectionDimensions = ${beaconProjectionDimensions.toString()};
  const presentationMode = { get current() { return zoom >= 16 ? "stack" : zoom >= 12 ? "swarm" : zoom >= 9 ? "atmosphere" : "micro"; } };
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
  const beaconPinPath = () => ${JSON.stringify(beaconPinSymbols.fitness)};
  const beaconPinImage = () => null;
  const miniAvatarSvg = () => ${JSON.stringify(miniAvatarSvg(42))};
  ${glyph}
  ${sizing}
  ${marker}
  window.renderMarker = (input) => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = input.zoom;
    if (input.colors) colors = input.colors;
    const result = marker(41.88, -87.64, "?", "Test Beacon", () => clicks++, false, 0, "#218466", input.selected, false, "", "unknown", input.live ?? true, input.chip, input.identity, !!input.identity?.owned, !!input.compact, false, undefined, undefined, undefined, input.name, undefined, undefined, undefined, !!input.publicMarker);
    if (input.compact) {
      result.classList.add("beacon-marker");
      document.body.append(result);
    }
  };
  window.renderClusterProjector = () => appendMapProjector(document.body, clusterPrism.pearl, 14, 24, 36, 1, "cluster");
  window.renderIdentityMarker = input => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = 16;
    resolvedAppearance = input.appearance;
    colors = input.colors ?? colors;
    document.body.style.background = colors.surface;
    const result = marker(41.88, -87.64, "?", "Test Beacon, " + (input.owned ? "Your Beacon, " : "") + "Saved, Friend-hosted, Live", () => clicks++, false, 0, "#218466", !!input.selected, false, "", "unknown", true, "", { owned: input.owned, saved: true, friendHosted: true, live: true, interest: true }, input.owned, input.compact, false);
    if (input.compact) {
      result.classList.add("beacon-marker");
      document.body.append(result);
    }
  };
  window.markerClicks = () => clicks;
  window.renderFriendMarker = (compact = false) => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = compact ? 12 : 16;
    const result = marker(41.88, -87.64, "", "Test friend", () => clicks++, true, 42, "#218466", false, false, "", "unknown", false, "", null, false, compact);
    if (compact) {
      result.classList.add("beacon-marker");
      document.body.append(result);
    }
  };
`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
const css = readFileSync("components/leaflet.web.css", "utf8");

test("Interests and Free focus can be enabled together and cleared from the Map", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const intro = page.getByRole("button", { name: "Skip introduction", exact: true });
  if (await intro.isVisible()) await intro.click();
  await page.getByRole("button", { name: "Free friends", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Free friends filter" })).toBeVisible();
  await page.getByRole("button", { name: /^Interests/ }).click();
  await page.getByRole("checkbox", { name: "Focus on my interests" }).click();
  await expect(page.getByRole("button", { name: "Remove My interests filter" })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Free friends filter" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove My interests filter" })).toHaveCount(0);
});

test("production demo previews Beacon looks without developer Coin controls", async ({ page }, info) => {
  test.setTimeout(90000);
  const rewardRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/rpc/beacon_rewards")) rewardRequests.push(request.url());
  });
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }).click();
  await page.getByLabel("Activity title", { exact: true }).fill("Chicago after dark");
  await page.getByRole("button", { name: "Customize appearance", exact: true }).click();
  const appearance = page.getByRole("dialog", { name: "Customize appearance", exact: true });
  await appearance.getByRole("button", { name: "Shop Beacon looks" }).click();
  await page.getByRole("button", { name: "Preview Legendary", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Legendary" });
  await expect(preview.getByText("3,500 more Coins needed.")).toBeVisible();
  await expect(preview.getByRole("button", { name: "Add demo Coins" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("skin-preview.png") });
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue("Chicago after dark");
  expect(rewardRequests).toEqual([]);
});

test("a friend keeps a recognizable 32px avatar and a larger target without projection", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate(() => (window as any).renderFriendMarker());
  const friend = page.getByRole("button", { name: "Test friend" });
  const avatar = friend.locator("[data-cluster-face]");
  await expect(avatar.locator("img")).toBeVisible();
  await expect(avatar).toHaveCSS("width", "32px");
  await expect(friend.getByTestId("friend-marker-projection")).toHaveCount(0);
  await expect(friend.getByTestId("map-person-projector")).toHaveCount(0);
  expect((await friend.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".beacon-marker")).toHaveAttribute("data-anchor", "[32,16]");
});

test("Beacon names sit below the pin tip and truncate within the chip", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  const name = "Table Tennis with the Wednesday Lunch Squad";
  await page.evaluate((name) => (window as any).renderMarker({ zoom: 16, name }), name);
  const chip = page.getByTestId("beacon-map-name");
  const projector = page.getByTestId("map-beacon-projector");
  await expect(projector).toHaveCSS("height", "21px");
  await expect(projector).toHaveCSS("width", "36px");
  await expect(chip).toHaveText(name);
  await expect(chip).toHaveCSS("text-overflow", "ellipsis");
  const bounds = (await chip.boundingBox())!;
  const tip = (await page.getByTestId("beacon-pin-tip").boundingBox())!;
  const base = (await projector.locator('[data-projector-part="base"]').boundingBox())!;
  expect(bounds.y).toBeGreaterThan(tip.y + tip.height);
  expect(bounds.y + 1).toBeGreaterThanOrEqual(base.y + base.height);
  expect(bounds.width).toBeLessThanOrEqual(BEACON_NAME_MAX_WIDTH);
});

test("public Beacons have a larger rounded-square lens and an anchored projector", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate(() => (window as any).renderMarker({ zoom: 16, publicMarker: true, selected: true, live: false }));
  const face = page.locator("[data-public-beacon-face]");
  const projector = page.getByTestId("map-beacon-projector");
  await expect(face).toHaveCSS("width", "44px");
  await expect(face).toHaveCSS("border-radius", "11px");
  await expect(face).toHaveCSS("border-top-color", "rgb(178, 156, 233)");
  await expect(projector).toHaveCSS("height", "21px");
  const lens = (await face.boundingBox())!;
  const beam = (await projector.boundingBox())!;
  expect(Math.abs(lens.x + lens.width / 2 - beam.x - beam.width / 2)).toBeLessThan(0.5);
});

test("cluster projector has a static pearl and prism gradient", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addScriptTag({ content: script });
  await page.evaluate(() => (window as any).renderClusterProjector());
  const projector = page.getByTestId("map-cluster-projector");
  await expect(projector.locator(":scope > span").first()).toHaveCSS(
    "background-image", /rgb\(165, 232, 255\).*rgb\(244, 248, 255\).*rgb\(207, 185, 255\)/,
  );
  await expect(projector).toHaveCSS("animation-name", "none");
});

test("Hosting and Joined retain their rectangular upper beam in both themes", async ({ page }, info) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  for (const appearance of ["light", "dark"] as const) {
    const semantic = getDesignColorTheme(themeNames[0], appearance).colors;
    const colors = { ...semantic, white: semantic.surface, ink: semantic.textPrimary, green: semantic.primary };
    await page.evaluate(color => { document.body.style.background = color; }, colors.surface);
    for (const zoom of [16, 14, 10, 8]) {
      await page.evaluate(input => (window as any).renderMarker(input), {
        zoom, colors, identity: { joined: true, count: 30, lifecycle: "upcoming", light: 0.9 }, name: "Neighbourhood coffee",
      });
      const beam = page.getByTestId("beacon-marker-beam");
      if (zoom >= 14) {
        await expect(beam).toHaveCSS("height", zoom === 16 ? "24px" : "16px");
        await expect(beam).toHaveCSS("background-image", /232, 165, 77/);
      } else await expect(beam).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`marker-${appearance}-${zoom}.png`), animations: "disabled" });
    }
  }
});

test("important individual Beacons keep a quieter upper beam farther out", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addScriptTag({ content: script });
  const beam = page.getByTestId("beacon-marker-beam");
  for (const [zoom, selected, identity, height] of [
    [14, true, {}, 0],
    [14, false, { participatingLive: true }, 16],
    [14, false, { owned: true }, 16],
    [14, false, { friendHosted: true }, 0],
    [10, true, {}, 0],
    [8, true, {}, 0],
  ] as const) {
    await page.evaluate((input) => (window as any).renderMarker(input), { zoom, selected, identity });
    if (height) await expect(beam).toHaveCSS("height", `${height}px`);
    else await expect(beam).toHaveCount(0);
    const projector = page.getByTestId("map-beacon-projector");
    if (zoom === 14) await expect(projector).toHaveCSS("height", "20px");
    else await expect(projector).toHaveCount(0);
    await expect(page.locator(".map-now-halo")).toHaveCount(0);
  }
});

test("web Beacon ripple stays at the badge center across dot/full sizes, chips, selection, animation and reduced motion", async ({
  page,
}) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  for (const zoom of [8, 10, 16])
    for (const chip of ["", "20m left"])
      for (const selected of [false, true]) {
        await page.evaluate((input) => (window as any).renderMarker(input), {
          zoom,
          chip,
          selected,
        });
        await expect(page.getByTestId("beacon-marker-beam")).toHaveCount(0);
        await expect(page.getByTestId("beacon-pin-tip")).toHaveCount(Number(zoom >= 16));
        if (zoom < 16) {
          await expect(page.locator(".map-now-halo")).toHaveCount(0);
          await expect(page.getByTestId("map-beacon-projector")).toHaveCount(0);
          if (zoom < 12 && !selected) {
            await expect(page.getByTestId("map-single-stellar-beacon")).toHaveCSS("opacity", "0.9");
          }
          await page.getByRole("button", { name: "Test Beacon" }).click();
          continue;
        }
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
          expect(result.anchor).toBe(zoom < 12 && !selected ? "[32,5]" : "[32,88]");
          expect(result.pointerEvents).toBe("none");
        }
        await page.getByRole("button", { name: "Test Beacon" }).click();
      }
  expect(await page.evaluate(() => (window as any).markerClicks())).toBe(12);
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

test("Beacon badges keep semantic positions when density changes", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  const identity = { owned: true, saved: true, interest: true, live: true, count: 15 };
  for (const [zoom, selected, count] of [[16, true, 4], [16, false, 4], [14, false, 1], [10, false, 0]]) {
    await page.evaluate(input => (window as any).renderMarker(input), { zoom, selected, identity });
    const slots = page.locator("[data-badge-slot]");
    await expect(slots).toHaveCount(zoom === 14 ? 2 : count);
    if (zoom === 16) {
      await expect(page.getByTestId("beacon-saved-bookmark")).toHaveAttribute("data-badge-slot", "saved");
      await expect(page.getByTestId("beacon-saved-bookmark")).toHaveCSS("width", "12px");
      await expect(page.getByTestId("beacon-saved-bookmark")).toHaveCSS("background-color", "rgb(201, 182, 250)");
      await expect(page.getByTestId("beacon-ownership-star")).toHaveAttribute("data-badge-slot", "identity");
      await expect(page.getByTestId("beacon-live-badge")).toHaveAttribute("data-badge-slot", "lifecycle");
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
    (window as any).renderMarker({ zoom: 16, selected: false, chip: "" }),
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
