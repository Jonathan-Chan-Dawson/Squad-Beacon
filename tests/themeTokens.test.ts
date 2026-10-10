import test from "node:test";
import assert from "node:assert/strict";
import { getDesignColorTheme } from "@/src/theme/data";
import { themeNames } from "@/src/theme/palettes";

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
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("semantic foreground colors meet contrast on every palette and soft tint", () => {
  for (const name of themeNames) {
    for (const appearance of ["light", "dark"] as const) {
      const { colors, categories, availability } = getDesignColorTheme(
        name,
        appearance,
      );
      const context = `${name} ${appearance}`;
      for (const background of [colors.bg, colors.surface]) {
        assert.ok(contrast(colors.textPrimary, background) >= 4.5, `${context} body text`);
        assert.ok(contrast(colors.textSecondary, background) >= 4.5, `${context} supporting text`);
        assert.ok(contrast(colors.danger, background) >= 4.5, `${context} destructive row text`);
      }
      assert.ok(contrast(colors.bg, colors.danger) >= 4.5, `${context} destructive button text`);
      assert.ok(
        contrast(colors.onAccent, colors.accent) >= 4.5,
        `${context} button text`,
      );
      for (const [category, token] of Object.entries(categories)) {
        assert.equal(token.label, category);
        assert.ok(
          contrast(token.color, colors.surface) >= 4.5,
          `${context} ${category} foreground`,
        );
        assert.ok(
          contrast(token.color, token.tint) >= 4.5,
          `${context} ${category} tint`,
        );
      }
      for (const [state, token] of Object.entries(availability)) {
        assert.equal(token.label.length > 0, true);
        assert.ok(
          contrast(token.color, token.tint) >= 4.5,
          `${context} ${state} tint`,
        );
        assert.ok(
          contrast(token.onColor, token.color) >= 4.5,
          `${context} ${state} symbol`,
        );
      }
    }
  }
});

test("the pure design palette builder caches stable theme objects", () => {
  const first = getDesignColorTheme("Midnight", "dark");
  const second = getDesignColorTheme("Midnight", "dark");
  assert.strictEqual(first, second);
  assert.notStrictEqual(first, getDesignColorTheme("Midnight", "light"));
});
