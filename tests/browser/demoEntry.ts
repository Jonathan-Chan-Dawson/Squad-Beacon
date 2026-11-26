import { expect, type Page } from "@playwright/test";

/** Enter through the real guest/sign-in UI, retaining the original deep-link entry. */
export async function startDemoFromEntry(page: Page) {
  const target = new URL(page.url());
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  const signIn = page.getByRole("button", { name: "Sign in", exact: true }).first();
  const login = page.getByRole("button", { name: "Login to use", exact: true }).filter({ visible: true }).first();
  const profile = page.getByRole("tab", { name: "Profile", exact: true });
  const dismissIntro = page.getByRole("button", { name: "Skip introduction", exact: true });
  await expect(demo.or(signIn).or(login).or(profile).first()).toBeVisible();
  const throughSignIn = !(await demo.isVisible());
  if (throughSignIn) {
    if (await dismissIntro.isVisible()) await dismissIntro.click();
    if (await signIn.isVisible()) await signIn.click();
    else if (await login.isVisible()) await login.click();
    else {
      const dismissMap = page.getByRole("dialog", { name: "Welcome to the Map!" }).getByRole("button", { name: "Got it" });
      if (await dismissMap.isVisible()) await dismissMap.click();
      await profile.click();
      const dismissProfile = page.getByRole("dialog", { name: "Make it yours." }).getByRole("button", { name: "Got it" });
      if (await dismissProfile.isVisible()) await dismissProfile.click();
      await login.click();
    }
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
