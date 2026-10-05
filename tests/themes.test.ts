import test from "node:test";
import assert from "node:assert/strict";
import {
  getInitialThemePreferences,
  isAppearanceMode,
  isThemeName,
  resolveAppearanceMode,
  themeNames,
  themeVariants,
  themes,
} from "@/src/shared/themes";

function luminance(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("theme names are unique, accepted by persistence validation, and reject unknown values", () => {
  assert.equal(new Set(themeNames).size, themeNames.length);
  assert.ok(themeNames.includes("Ocean"));
  assert.ok(themeNames.includes("Berry"));
  for (const name of themeNames) assert.equal(isThemeName(name), true);
  for (const invalid of [null, undefined, "ocean", "Neon", 42])
    assert.equal(isThemeName(invalid), false);
});

test("legacy theme palettes keep their public shape", () => {
  for (const [name, palette] of Object.entries(themes)) {
    assert.ok(contrast(palette.ink, palette.bg) >= 4.5, `${name} primary text`);
    assert.ok(contrast(palette.ink, palette.white) >= 4.5, `${name} card text`);
    assert.ok(contrast(palette.muted, palette.bg) >= 4.5, `${name} muted text`);
    assert.ok(contrast(palette.muted, palette.white) >= 4.5, `${name} muted card text`);
    assert.ok(contrast(palette.green, palette.bg) >= 4.5, `${name} accent text`);
    assert.ok(contrast(palette.green, palette.white) >= 4.5, `${name} accent on cards`);
    assert.ok(contrast(palette.white, palette.ink) >= 4.5, `${name} primary button text`);
    assert.ok(contrast(palette.ink, palette.lime) >= 4.5, `${name} compact action text`);
    assert.ok(contrast(palette.heroText, palette.heroBg) >= 4.5, `${name} Auth hero text`);
    assert.ok(contrast(palette.heroAccent, palette.heroBg) >= 3, `${name} Auth hero icon`);
    assert.ok(contrast(palette.green, palette.lime) >= 3, `${name} accent icon on lime`);
  }
});

test("every theme has readable light and dark variants", () => {
  for (const name of themeNames) {
    for (const appearance of ["light", "dark"] as const) {
      const palette = themeVariants[name][appearance];
      const label = `${name} ${appearance}`;
      assert.ok(contrast(palette.ink, palette.bg) >= 4.5, `${label} primary text`);
      assert.ok(contrast(palette.ink, palette.white) >= 4.5, `${label} card text`);
      assert.ok(contrast(palette.muted, palette.bg) >= 4.5, `${label} muted text`);
      assert.ok(contrast(palette.muted, palette.white) >= 4.5, `${label} muted card text`);
      assert.ok(contrast(palette.green, palette.bg) >= 4.5, `${label} accent text`);
      assert.ok(contrast(palette.green, palette.white) >= 4.5, `${label} accent on cards`);
      assert.ok(contrast(palette.white, palette.ink) >= 4.5, `${label} primary button text`);
      assert.ok(contrast(palette.ink, palette.lime) >= 4.5, `${label} compact action text`);
      assert.ok(contrast(palette.heroText, palette.heroBg) >= 4.5, `${label} hero text`);
      assert.ok(contrast(palette.heroAccent, palette.heroBg) >= 3, `${label} hero icon`);
      assert.ok(contrast(palette.green, palette.lime) >= 3, `${label} accent icon on lime`);
    }
  }
});

test("appearance preference defaults dark and migrates saved legacy themes", () => {
  assert.deepEqual(getInitialThemePreferences(null, null), {
    theme: "Midnight",
    appearanceMode: "dark",
  });
  assert.deepEqual(getInitialThemePreferences("Mint", null), {
    theme: "Mint",
    appearanceMode: "light",
  });
  assert.deepEqual(getInitialThemePreferences("Midnight", null), {
    theme: "Midnight",
    appearanceMode: "dark",
  });
  assert.deepEqual(getInitialThemePreferences("Ocean", "system"), {
    theme: "Ocean",
    appearanceMode: "system",
  });
  assert.equal(isAppearanceMode("system"), true);
  assert.equal(isAppearanceMode("auto"), false);
});

test("system appearance follows the device and has a safe dark fallback", () => {
  assert.equal(resolveAppearanceMode("system", "light"), "light");
  assert.equal(resolveAppearanceMode("system", "dark"), "dark");
  assert.equal(resolveAppearanceMode("system", "unspecified"), "dark");
  assert.equal(resolveAppearanceMode("light", "dark"), "light");
  assert.equal(resolveAppearanceMode("dark", "light"), "dark");
});
