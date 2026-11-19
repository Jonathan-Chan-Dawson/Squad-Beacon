import { expect, type Page } from "@playwright/test";

/** Enter through the real guest/sign-in UI, retaining the original deep-link entry. */
export async function startDemoFromEntry(page: Page) {
  const target = new URL(page.url());
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  const signIn = page
    .getByRole("button", { name: "Sign in", exact: true })
    .first();
  const profile = page.getByRole("tab", { name: "Profile", exact: true });
  await expect(demo.or(signIn).or(profile).first()).toBeVisible();
  const throughSignIn = !(await demo.isVisible());
  if (throughSignIn) {
    if (await signIn.isVisible()) await signIn.click();
    else await profile.click();
  }
  await demo.click();
  await expect(demo).toHaveCount(0);
  if (throughSignIn) {
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    const current = new URL(page.url());
    if (current.pathname + current.search !== target.pathname + target.search) {
      await page.goBack();
      await expect(page).toHaveURL(target.href);
    }
  }
}
