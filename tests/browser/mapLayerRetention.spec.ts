import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import path from "node:path";
const script = buildSync({
  stdin: {
    contents:
      'export {KeyedMapLayers} from "./src/features/maps/keyedMapLayers";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "retention",
  platform: "browser",
}).outputFiles[0].text;
test("actual Leaflet layers retain DOM and handlers on settled pans; changed and removed entities are isolated", async ({
  page,
}) => {
  await page.setContent(
    '<div id="map" style="width:600px;height:600px"></div>',
  );
  await page.addStyleTag({
    path: path.resolve("node_modules/leaflet/dist/leaflet.css"),
  });
  await page.addScriptTag({
    path: path.resolve("node_modules/leaflet/dist/leaflet-src.js"),
  });
  await page.addScriptTag({ content: script });
  const result = await page.evaluate(() => {
    const { L, retention } = window as any,
      map = L.map("map").setView([41.88, -87.64], 17),
      layers = L.layerGroup().addTo(map),
      paths = L.layerGroup().addTo(map),
      cache = new retention.KeyedMapLayers(),
      decorations = new retention.KeyedMapLayers();
    let picked = 0;
    const render = (revision: string, lat: number, includeSecond = true) => {
      cache.begin(layers);
      decorations.begin(paths);
      const first = cache.use(
        "first",
        revision,
        () => {
          const node = document.createElement("button");
          node.textContent = revision;
          node.onclick = () => cache.activate("first");
          return L.marker([lat, -87.64], {
            icon: L.divIcon({ html: node }),
          }).addTo(layers);
        },
        () => (picked = lat),
      );
      first.setLatLng([lat, -87.64]);
      if (includeSecond)
        cache.use("second", "stable", () =>
          L.marker([41.88, -87.641]).addTo(layers),
        );
      const path = decorations.use("area", "stable", () =>
        L.circle([41.88, -87.64], { radius: 20 }).addTo(paths),
      );
      cache.end();
      decorations.end();
      return { first, path };
    };
    const initial = render("one", 41.88),
      dom = initial.first.getElement();
    const reused = render("one", 41.881);
    dom.querySelector("button").click();
    const same = dom === reused.first.getElement(),
      freshHandler = picked === 41.881,
      samePath = initial.path === reused.path;
    map.panTo([41.881, -87.64], { animate: false });
    const panSame = dom === reused.first.getElement();
    const changed = render("two", 41.881, false);
    return {
      same,
      freshHandler,
      samePath,
      panSame,
      changed: changed.first.getElement() !== dom,
      remaining: layers.getLayers().length,
      decorations: paths.getLayers().length,
      stats: cache.stats,
    };
  });
  expect(result).toMatchObject({
    same: true,
    freshHandler: true,
    samePath: true,
    panSame: true,
    changed: true,
    remaining: 1,
    decorations: 1,
    stats: { created: 3, removed: 2 },
  });
});
