import test from "node:test";
import assert from "node:assert/strict";
import { cartoTileUrl, cartoBasemapLayers } from "../src/theme/map";

test("CARTO keys survive URL encoding while palette styles and Leaflet placeholders stay unchanged", () => {
  const dummyKey = " test+key/with=characters&suffix ";
  for (const appearance of ["dark", "light"] as const) {
    const template = cartoTileUrl(appearance, dummyKey);
    const url = new URL(template.replace("{s}", "a"));
    assert.equal(url.hostname, "a.basemaps.cartocdn.com");
    assert.equal(url.searchParams.get("key"), dummyKey.trim());
    assert.equal([...url.searchParams.keys()].length, 1);
    assert.ok(
      template.includes(
        `/${appearance === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png?`,
      ),
    );
  }
});

test("unconfigured or whitespace-only CARTO keys retain the unkeyed tile URL", () => {
  assert.equal(cartoTileUrl("light", "  "), cartoTileUrl("light"));
  assert.equal(cartoTileUrl("dark").includes("?"), false);
});

test("dark basemap separates labels while keeping credentials and light tiles unchanged", () => {
  const dark = cartoBasemapLayers("dark", "sample+key");
  assert.ok(dark.base.includes("/dark_nolabels/"));
  assert.ok(dark.labels?.includes("/dark_only_labels/"));
  assert.equal(
    new URL(dark.labels!.replace("{s}", "a")).searchParams.get("key"),
    "sample+key",
  );
  assert.deepEqual(cartoBasemapLayers("light", "sample+key"), {
    base: cartoTileUrl("light", "sample+key"),
  });
});
