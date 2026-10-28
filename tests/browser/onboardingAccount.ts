import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { makeScenario } from "../../src/features/onboarding/scenarios";
import {
  normalizeProfileQuery,
  selectProfileContent,
} from "../../src/features/profile/profileContent";

/** Intercepted account transport: no credentials or hosted mutations. */
export async function mockOnboardingAccount(
  page: Page,
  options: {
    viewer?: string;
    eligible?: boolean;
    delayRead?: number;
    failSave?: boolean;
    progress?: Set<string>;
    surveyStatus?: "pending" | "skipped" | "completed";
    noProfile?: boolean;
    signedOut?: boolean;
    failProgress?: boolean;
    failSnapshot?: boolean;
    delaySnapshot?: number;
    failProfileSave?: boolean;
    callbackWithoutSession?: boolean;
    holdProgress?: boolean;
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
  snapshot.profiles[0].onboarding_survey_status =
    options.surveyStatus ?? "skipped";
  const newProfile = structuredClone(snapshot.profiles[0]);
  if (options.noProfile) {
    Object.assign(newProfile, {
      bio: "",
      home: "",
      birthday_note: "",
      aspirations: "",
      personality: "",
      quote: "",
      interests: [],
      identity_tags: [],
      aspiration_goals: [],
    });
    snapshot.profiles = [];
  }
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
  if (!options.signedOut)
    await page.addInitScript(
      ({ storageKey, session }) =>
        sessionStorage.setItem(storageKey, JSON.stringify(session)),
      { storageKey: `sb-${host.split(".")[0]}-auth-token`, session },
    );
  let failed = false;
  let reads = 0;
  let completedReads = 0;
  let releaseProgress: () => void = () => {};
  const progressReleased = new Promise<void>((resolve) => {
    releaseProgress = resolve;
  });
  const actions: { action: string; payload: Record<string, unknown> }[] = [];
  const authCalls: string[] = [];
  let profileSaveFailed = false;
  let snapshotReads = 0;
  await page.route(`https://${host}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/auth/v1/")) authCalls.push(path);
    let body: unknown = [];
    if (path === "/auth/v1/user")
      body = route.request().method() === "PUT" ? { user } : user;
    else if (path === "/auth/v1/token")
      body = options.callbackWithoutSession ? { user, session: null } : session;
    else if (["/auth/v1/recover", "/auth/v1/logout"].includes(path)) body = {};
    else if (path === "/auth/v1/signup") body = { user, session: null };
    else if (path === "/auth/v1/verify")
      body = options.callbackWithoutSession ? { user, session: null } : session;
    else if (path.endsWith("/beacon_snapshot")) {
      snapshotReads++;
      if (options.delaySnapshot)
        await new Promise((resolve) =>
          setTimeout(resolve, options.delaySnapshot),
        );
      if (options.failSnapshot) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture snapshot unavailable" }),
        });
        return;
      }
      body = snapshot;
    } else if (path.endsWith("/onboarding_progress")) {
      reads++;
      if (options.holdProgress) await progressReleased;
      if (options.delayRead)
        await new Promise((resolve) => setTimeout(resolve, options.delayRead));
      if (options.failProgress) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture progress unavailable" }),
        });
        return;
      }
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
    } else if (path.endsWith("/profile_content_page")) {
      const params = route.request().postDataJSON();
      body = selectProfileContent(
        snapshot,
        viewer,
        normalizeProfileQuery({
          personId: params.p_person,
          filter: params.p_filter,
          query: params.p_query ?? "",
          cursor: params.p_cursor,
          pageSize: params.p_page_size,
        }),
      );
    } else if (path.endsWith("/beacon_action")) {
      const request = route.request().postDataJSON();
      actions.push(request);
      if (request.action === "onboard") {
        if (options.failProfileSave && !profileSaveFailed) {
          profileSaveFailed = true;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Interrupted profile save. Try again.",
            }),
          });
          return;
        }
        if (!snapshot.profiles.length)
          snapshot.profiles = [
            {
              ...newProfile,
              name: request.payload.name,
              username: request.payload.username,
              onboarding_survey_status: "pending",
            },
          ];
        keys.add("entry.eligible.v1");
      } else if (request.action === "save_profile")
        Object.assign(snapshot.profiles[0], request.payload);
      body = {};
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (path.endsWith("/onboarding_progress")) completedReads++;
  });
  await page.routeWebSocket(`wss://${host}/**`, (socket) => socket.close());
  return {
    keys,
    snapshot,
    actions,
    authCalls,
    releaseProgress,
    storageKey: `sb-${host.split(".")[0]}-auth-token`,
    get completedReads() {
      return completedReads;
    },
    get snapshotReads() {
      return snapshotReads;
    },
    get reads() {
      return reads;
    },
  };
}
