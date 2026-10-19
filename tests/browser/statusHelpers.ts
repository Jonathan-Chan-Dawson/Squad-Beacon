import { expect, type Page } from "@playwright/test";

export async function settleEditor(page: Page) {
  const editor = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  let previous = "";
  await expect
    .poll(
      async () => {
        const boxes = await Promise.all([
          editor
            .getByRole("button", { name: "Close", exact: true })
            .boundingBox(),
          editor
            .getByRole("button", { name: "Save Status", exact: true })
            .boundingBox(),
        ]);
        if (boxes.some((box) => !box)) return false;
        const position = boxes
          .map((box) => `${Math.round(box!.y)}:${Math.round(box!.height)}`)
          .join(";");
        const stable = position === previous;
        previous = position;
        return stable;
      },
      { intervals: [150, 250, 400], timeout: 5000 },
    )
    .toBe(true);
}
