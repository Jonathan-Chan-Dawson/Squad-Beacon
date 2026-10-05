import { expect, type Page } from "@playwright/test";

/** Names/avatars intentionally open previews; tap the rest of the chat row. */
export async function openConversation(page: Page, name: string) {
  const row = page.getByRole("button", {
    name: `Message ${name}`,
    exact: true,
  });
  await expect(row).toBeVisible();
  const bounds = await row.boundingBox();
  if (!bounds) throw new Error(`No conversation row for ${name}`);
  await row.click({ position: { x: bounds.width - 12, y: bounds.height - 8 } });
}
