import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { makeScenario } from "../../src/features/onboarding/scenarios";

/** Intercepted account transport: no credentials or hosted mutations. */
export async function mockOnboardingAccount(
  page: Page,
  options: {
    viewer?: string;
    eligible?: boolean;
    delayRead?: number;
    failSave?: boolean;
    progress?: Set<string>;
  } = {},
) {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    readFileSync(".env", "utf8")
      .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
      .trim()
      .replace(/^['"]|['"]$/g, "");
  if (!url)
    throw new Error(
      "Account browser tests need the configured public Supabase URL.",
    );
  const host = new URL(url).hostname;
  const viewer = options.viewer ?? "91111111-1111-4111-8111-111111111111";
  const keys =
    options.progress ??
    new Set(options.eligible === false ? [] : ["entry.eligible.v1"]);
  const snapshot = makeScenario("fresh").data;
  snapshot.is_demo = false;
  snapshot.viewer_id = viewer;
  snapshot.profiles[0].id = viewer;
  const user = {
    id: viewer,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-26T00:00:00Z",
  };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: viewer,
        aud: "authenticated",
        role: "authenticated",
        exp: expires,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  const session = {
    access_token: jwt,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_at: expires,
    expires_in: 3600,
    user,
  };
  await page.addInitScript(
    ({ storageKey, session }) =>
      sessionStorage.setItem(storageKey, JSON.stringify(session)),
    { storageKey: `sb-${host.split(".")[0]}-auth-token`, session },
  );
  let failed = false;
  let reads = 0;
  await page.route(`https://${host}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/auth/v1/user") body = user;
    else if (path.endsWith("/beacon_snapshot")) body = snapshot;
    else if (path.endsWith("/onboarding_progress")) {
      reads++;
      if (options.delayRead)
        await new Promise((resolve) => setTimeout(resolve, options.delayRead));
      body = [...keys].map((key) => ({ key }));
    } else if (path.endsWith("/claim_onboarding_progress")) {
      if (route.request().postDataJSON().expected_viewer !== viewer) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ message: "Your account changed." }),
        });
        return;
      }
      if (options.failSave && !failed) {
        failed = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture progress save failed" }),
        });
        return;
      }
      const key = route.request().postDataJSON().progress_key;
      body = !keys.has(key);
      keys.add(key);
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.routeWebSocket(`wss://${host}/**`, (socket) => socket.close());
  return {
    keys,
    snapshot,
    get reads() {
      return reads;
    },
  };
}
