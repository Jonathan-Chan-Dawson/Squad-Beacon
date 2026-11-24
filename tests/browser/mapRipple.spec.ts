import { getDesignColorTheme } from "../../src/theme/data";
import { themeNames } from "../../src/theme/palettes";
import { BEACON_NAME_MAX_WIDTH, mapIdentityColors } from "../../src/features/maps/markerIdentity";
import { beaconPinSymbols } from "../../src/features/maps/beaconPinArtwork";
import { appendBeaconUpperBeam, appendMapProjector, beaconProjectionDimensions } from "../../src/features/maps/projector";
import { miniAvatarSvg } from "../../src/features/profile/avatarArt";
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
  const mapIdentityColors = ${JSON.stringify(mapIdentityColors)};
  const BEACON_NAME_MAX_WIDTH = ${BEACON_NAME_MAX_WIDTH};
  let colors = { green: "#218466", ink: "#182c30", white: "#fff", success: "#176B4A", outline: "#718078", surface: "#fff", textPrimary: "#182c30" };
  const reducedMotion = false, group = {}, coordinates = [];
  const onPick = undefined, identityViewer = "viewer";
  ${lighting}
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
    const result = marker(41.88, -87.64, "?", "Test Beacon", () => clicks++, false, 0, "#218466", input.selected, false, "", "unknown", input.live ?? true, input.chip, input.identity, !!input.identity?.owned, !!input.compact, false, undefined, undefined, undefined, input.name);
    if (input.compact) {
      result.classList.add("beacon-marker");
      document.body.append(result);
    }
  };
  window.renderIdentityMarker = input => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
    zoom = 16;
    resolvedAppearance = input.appearance;
    colors = input.colors ?? colors;
    document.body.style.background = colors.surface;
    const result = marker(41.88, -87.64, "?", "Test Beacon, " + (input.owned ? "Your Beacon, " : "") + "Saved, Friend-hosted, Live", () => clicks++, false, 0, "#218466", false, false, "", "unknown", true, "", { owned: input.owned, saved: true, friendHosted: true, live: true }, input.owned, input.compact, false);
    if (input.compact) {
      result.classList.add("beacon-marker");
      document.body.append(result);
    }
  };
  window.markerClicks = () => clicks;
  window.renderFriendMarker = (compact = false) => {
    document.querySelectorAll(".beacon-marker").forEach(node => node.remove());
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

test("Demo Coins can unlock Beacon looks from Customize appearance", async ({ page }, info) => {
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
  await preview.getByRole("button", { name: "Add demo Coins" }).click();
  await expect(page.getByText("5,000 Coins", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Buy", exact: true }).click();
  await preview.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(preview.getByText("Owned", { exact: true })).toBeVisible();
  await expect(page.getByText("1,500 Coins", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("skin-preview.png") });
  await page.goBack();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue("Chicago after dark");
  expect(rewardRequests).toEqual([]);
});

test("a friend keeps a recognizable 34px avatar and a larger target without projection", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate(() => (window as any).renderFriendMarker());
  const friend = page.getByRole("button", { name: "Test friend" });
  const avatar = friend.locator("[data-cluster-face]");
  await expect(avatar.locator("img")).toBeVisible();
  await expect(avatar).toHaveCSS("width", "34px");
  await expect(friend.getByTestId("friend-marker-projection")).toHaveCount(0);
  await expect(friend.getByTestId("map-person-projector")).toHaveCount(0);
  expect((await friend.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".beacon-marker")).toHaveAttribute("data-anchor", "[32,17]");
});

test("Beacon names sit below the pin tip and truncate within the chip", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  const name = "Table Tennis with the Wednesday Lunch Squad";
  await page.evaluate((name) => (window as any).renderMarker({ zoom: 16, name }), name);
  const chip = page.getByTestId("beacon-map-name");
  const projector = page.getByTestId("map-beacon-projector");
  await expect(projector).toHaveCSS("height", "23px");
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

test("beam height and gradient follow one priority in both appearances and at compact zoom", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 750, height: 460 });
  await page.setContent("<body></body>");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  const cases = [
    { selected: true, identity: { participatingLive: true, owned: true }, height: 38, compactHeight: 0, tint: "rgb(230, 174, 69)", color: "255, 254, 244" },
    { selected: false, identity: { participatingLive: true, owned: true }, height: 26, compactHeight: 27, tint: "rgb(241, 132, 50)", color: "255, 221, 156" },
    { selected: false, identity: { owned: true }, height: 19, compactHeight: 21, tint: "rgb(243, 185, 50)", color: "255, 241, 173" },
    { selected: false, identity: { friendHosted: true, squadHosted: true }, height: 15, compactHeight: 17, tint: "rgb(109, 175, 229)", color: "203, 234, 255" },
    { selected: false, identity: { squadHosted: true }, height: 18, compactHeight: 20, tint: "rgb(103, 196, 155)", color: "201, 245, 224" },
  ];
  for (const appearance of ["light", "dark"] as const) {
    const semantic = getDesignColorTheme(themeNames[0], appearance).colors;
    const colors = { ...semantic, white: semantic.surface, ink: semantic.textPrimary, green: semantic.primary };
    await page.emulateMedia({ colorScheme: appearance, reducedMotion: "reduce" });
    await page.evaluate(({ background, ink }) => {
      document.body.style.background = background;
      const row = document.createElement("div");
      row.id = "beam-comparison";
      row.style.cssText = `display:flex;position:absolute;left:12px;top:12px;background:${background};color:${ink};font:600 12px system-ui;padding:8px 3px;`;
      (window as any).beamComparison = row;
    }, { background: appearance === "dark" ? "#151a22" : "#f5f7fb", ink: colors.ink });
    for (const [index, item] of cases.entries()) {
      for (const compact of item.selected ? [false] : [false, true]) {
        await page.evaluate((input) => (window as any).renderMarker(input), {
          ...item, colors, zoom: compact ? 12 : 16, compact, live: item.identity.participatingLive ?? false,
        });
        const glow = page.getByTestId("beacon-marker-glow");
        await expect(glow).toHaveAttribute("data-lighting-level", String(index + 1));
        const haloRadius = compact ? 8 : [36, 19, 13, 10, 10][index];
        await expect(glow).toHaveCSS("box-shadow", new RegExp(`0px 0px ${haloRadius}px`));
        const height = compact ? 0 : item.height;
        const beam = page.getByTestId("beacon-marker-beam");
        if (height) {
          await expect(beam).toHaveCSS("height", `${height}px`);
          await expect(beam).toHaveCSS("background-image", new RegExp(item.color));
          await expect(page.getByTestId("map-beacon-projector")).toHaveCSS("color", item.tint);
        } else {
          await expect(beam).toHaveCount(0);
        }
        if (item.identity.participatingLive && !compact) {
          const pulse = page.locator(".map-now-halo");
          await expect(pulse).toHaveCount(1);
          await expect(pulse).toHaveCSS("animation-name", "none");
          await expect(pulse).toHaveCSS("border-top-color", item.selected ? "rgb(255, 240, 184)" : "rgb(241, 132, 50)");
        }
        if (!compact) {
          await page.locator(".beacon-marker").evaluate((marker, label) => {
            const sample = document.createElement("div");
            sample.style.cssText = "position:relative;width:138px;height:184px;text-align:center;";
            const copy = marker.cloneNode(true) as HTMLElement;
            copy.style.left = "50%";
            copy.style.top = "134px";
            const caption = document.createElement("span");
            caption.style.cssText = "position:absolute;bottom:4px;left:0;right:0";
            caption.textContent = label;
            sample.append(copy, caption);
            (window as any).beamComparison.append(sample);
          }, ["Selected", "Live and going", "Yours", "Friend-hosted", "Your Squad"][index]);
        }
      }
    }
    await page.locator(".beacon-marker").evaluate((last) => {
      last.remove();
      document.body.append((window as any).beamComparison);
    });
    await page.locator("#beam-comparison").screenshot({ path: testInfo.outputPath(`beam-comparison-${appearance}.png`), animations: "disabled" });
    await page.locator("#beam-comparison").evaluate((row) => row.remove());
  }
});

test("important individual Beacons keep a quieter upper beam farther out", async ({ page }) => {
  await page.setContent("<body></body>");
  await page.addScriptTag({ content: script });
  const beam = page.getByTestId("beacon-marker-beam");
  for (const [zoom, selected, identity, height] of [
    [14, true, {}, 25],
    [14, false, { participatingLive: true }, 17],
    [14, false, { owned: true }, 13],
    [14, false, { friendHosted: true }, 0],
    [10, true, {}, 12],
    [8, true, {}, 0],
  ] as const) {
    await page.evaluate((input) => (window as any).renderMarker(input), { zoom, selected, identity });
    if (height) await expect(beam).toHaveCSS("height", `${height}px`);
    else await expect(beam).toHaveCount(0);
    const projector = page.getByTestId("map-beacon-projector");
    if (zoom === 14) await expect(projector).toHaveCSS("height", "20px");
    else if (zoom === 10) await expect(projector).toHaveCSS("height", "16px");
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
        await expect(page.getByTestId("beacon-marker-beam")).toHaveCount(Number(selected && zoom >= 9));
        await expect(page.getByTestId("beacon-pin-tip")).toHaveCount(Number(zoom >= 16));
        if (zoom < 16) {
          await expect(page.locator(".map-now-halo")).toHaveCount(0);
          await expect(page.getByTestId("map-beacon-projector")).toHaveCount(Number(selected && zoom >= 9));
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
