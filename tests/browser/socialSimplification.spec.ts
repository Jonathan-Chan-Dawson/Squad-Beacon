import { expect, test, type Page } from "@playwright/test";
import type { Data } from "@/src/shared/types";

async function demoChats(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(page).toHaveURL(/\/squads/);
  await expect(
    page.getByRole("button", { name: "New conversation", exact: true }),
  ).toBeVisible();
}

// Replace only the local demo provider snapshot. No fixture API or test switch ships in the app.
async function scenario(
  page: Page,
  mode:
    | "new"
    | "friends"
    | "squad"
    | "organization"
    | "networks"
    | "sparse"
    | "large",
) {
  await page.evaluate((mode) => {
    type Hook = {
      memoizedState: unknown;
      queue?: { dispatch: (data: Data) => void };
      next: Hook | null;
    };
    type Fiber = { return: Fiber | null; memoizedState: Hook | null };
    const element = document.querySelector('[aria-label="New conversation"]')!;
    const key = Object.keys(element).find((key) =>
      key.startsWith("__reactFiber$"),
    )!;
    let fiber = (element as unknown as Record<string, Fiber>)[key];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (
        hook &&
        !(
          hook.queue &&
          (hook.memoizedState as Data)?.viewer_id &&
          Array.isArray((hook.memoizedState as Data)?.profiles)
        )
      )
        hook = hook.next;
      const candidate = hook?.memoizedState as Data | undefined;
      if (
        hook?.queue &&
        candidate?.viewer_id &&
        Array.isArray(candidate.friendships) &&
        Array.isArray(candidate.profiles)
      ) {
        const data = structuredClone(candidate);
        const viewer = data.viewer_id!;
        if (mode === "sparse") {
          const person = data.profiles.find((row) => row.id === "jordan")!;
          Object.assign(person, {
            bio: "",
            interests: [],
            identity_tags: [],
            home: "",
            birthday_note: "",
            aspirations: "",
            personality: "",
            quote: "",
            aspiration_goals: [],
          });
          data.activities = [];
          data.squad_members = [];
          data.organization_members = [];
          data.space_members = [];
        } else {
          data.messages = [];
          data.activities = [];
          data.councils = [];
          data.rsvps = [];
          data.friendships = mode === "friends" ? data.friendships : [];
          data.planning_threads = [];
          data.squad_invites = [];
          data.space_members =
            mode === "organization"
              ? data.space_members.filter(
                  (row) => row.space_id === "space-neighborhood-studio",
                )
              : [];
          data.organization_members = [];
          data.squads =
            mode === "squad" || mode === "large"
              ? data.squads.filter((row) => row.id === "boxing")
              : [];
          data.squad_members =
            mode === "squad" || mode === "large"
              ? data.squad_members.filter((row) => row.squad_id === "boxing")
              : [];
          if (mode === "large") {
            const source = data.profiles.find((row) => row.id === "jordan")!;
            for (let index = 0; index < 120; index++) {
              const id = `member-${index}`;
              data.profiles.push({
                ...source,
                id,
                name: `Member ${index}`,
                username: id,
                profile_visibility: "public",
              });
              data.squad_members.push({
                squad_id: "boxing",
                user_id: id,
                role: "member",
              });
            }
          }
          if (mode === "networks") {
            const source = data.organizations[0];
            data.organizations = Array.from({ length: 5 }, (_, index) => ({
              ...source,
              id: `network-${index}`,
              name: `Network ${index + 1}`,
              owner_id: viewer,
            }));
            data.organization_members = data.organizations.map((row) => ({
              organization_id: row.id,
              user_id: viewer,
              role: "owner",
              status: "active",
            }));
          }
        }
        // Keep the provider's canonical action ref in step with the rendered fixture.
        for (let current: Hook | null = hook; current; current = current.next) {
          const ref = current.memoizedState as { current?: unknown } | null;
          if (ref?.current === candidate) ref.current = data;
        }
        hook.queue.dispatch(data);
        return;
      }
      fiber = fiber.return!;
    }
    throw new Error("Local demo provider was not found");
  }, mode);
}

test("new account has two useful actions and no empty community sections or filters", async ({
  page,
}) => {
  await demoChats(page);
  await scenario(page, "new");
  await expect(
    page.getByText("Find your people", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find people", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore Beacons", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your communities", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Chats", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Responses & Invitations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Responses & Invitations, \d+ pending/ }),
  ).toHaveCount(0);
  for (const name of ["All", "Friends", "Unread", "Starred"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await page.screenshot({ path: "test-results/social-new-account-390.png" });
  await page.setViewportSize({ width: 320, height: 740 });
  for (const name of [
    "Communities",
    "Search conversations",
    "New conversation",
  ]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: "test-results/social-new-account-320.png" });
  await page
    .getByRole("button", { name: "Explore Beacons", exact: true })
    .click();
  await expect(page).toHaveURL(/filter=Upcoming/);
  await expect(page.getByRole("tab", { name: /^Upcoming/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("friends without a community can start chats without community placeholders", async ({
  page,
}) => {
  await demoChats(page);
  await scenario(page, "friends");
  await expect(
    page.getByRole("button", { name: "Expand Start a chat", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your communities", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Expand Start a chat", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Message Jordan Ellis", exact: true })
    .click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("one Squad stays chat-first without introducing empty parent sections", async ({
  page,
}) => {
  await demoChats(page);
  await scenario(page, "squad");
  await expect(
    page.getByRole("button", {
      name: "Message The training crew",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Your communities", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Find people", exact: true }),
  ).toHaveCount(0);
});

test("one Organization is a compact row and several networks use a short preview", async ({
  page,
}) => {
  await demoChats(page);
  await scenario(page, "organization");
  await expect(
    page.getByRole("button", { name: "Neighborhood Studio", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your communities", { exact: true })).toHaveCount(
    1,
  );
  await scenario(page, "networks");
  await expect(
    page.getByRole("button", { name: /^Network [1-5]$/ }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "See all communities", exact: true })
    .click();
  await expect(page).toHaveURL(/\/communities/);
  await expect(
    page.getByRole("button", { name: /^Network [1-5]$/ }),
  ).toHaveCount(5);
});

test("sparse person profile stays complete and contains no empty information sections", async ({
  page,
}) => {
  await demoChats(page);
  await scenario(page, "sparse");
  await page
    .getByRole("button", { name: "Expand Start a chat", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open profile Jordan Ellis", exact: true })
    .click();
  await expect(page).toHaveURL(/\/person\/jordan/);
  await expect(
    page.getByRole("button", { name: "Message", exact: true }),
  ).toBeVisible();
  for (const title of [
    "Past Beacons",
    "About",
    "Interests & identity",
    "In common",
    "Current Beacon",
    "Next Beacon",
  ])
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Safety & Privacy", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/person-sparse-390.png" });
});

test("large Squad roster exposes contextual search and keeps invitations in a focused flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await demoChats(page);
  await scenario(page, "large");
  await page
    .getByRole("button", {
      name: "Open squad profile avatar The training crew",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "See all members", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search Squad members", exact: true })
    .fill("member-119");
  await expect(
    page.getByText("Member 119", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Member 118", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Search friends", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invite people", exact: true })
    .click();
  await expect(page).toHaveURL(/tab=Invite/);
  await expect(
    page.getByRole("textbox", { name: "Search friends", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
