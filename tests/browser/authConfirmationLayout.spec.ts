import { test, expect } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 390]) {
    test(`confirmation layout: ${appearance}, ${width}px`, async ({ page }) => {
      await page.routeWebSocket("**/hot", () => {});
      await page.routeWebSocket("**/message", () => {});
      const account = await mockOnboardingAccount(page, { signedOut: true });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/auth/confirm?token_hash=fixture-layout&type=email");
      const confirm = page.getByRole("button", {
        name: "Confirm and continue",
        exact: true,
      });
      await expect(confirm).toBeEnabled();
      await expect(confirm).toBeInViewport({ ratio: 1 });
      await confirm.focus();
      await expect(confirm).toBeFocused();
      expect((await confirm.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        account.authCalls.filter((path) => path === "/auth/v1/verify"),
      ).toHaveLength(0);
      await page.screenshot({
        path: `docs/screenshots/auth-email/confirm-${appearance}-${width}.png`,
        animations: "disabled",
      });
    });
  }
}
