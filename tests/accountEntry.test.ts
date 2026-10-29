import test from "node:test";
import assert from "node:assert/strict";
import { accountReadiness } from "../src/shared/accountReadiness";
import { makeScenario } from "../src/features/onboarding/scenarios";
import {
  basicProfilePayload,
  profileEntryError,
  authOrigin,
  authCallbackUrl,
  accountEmail,
  usableAuthLink,
} from "../src/features/auth/accountEntry";

test("account emails use the configured HTTPS origin, independent of client platform", () => {
  const origin = "https://squad-beacon.vercel.app";
  assert.equal(authOrigin(`  ${origin}///  `), origin);
  assert.equal(authCallbackUrl(false, origin), `${origin}/auth/confirm`);
  assert.equal(
    authCallbackUrl(true, origin),
    `${origin}/auth/confirm?type=recovery`,
  );
  assert.equal(
    authCallbackUrl(false, "https://new-domain.example/"),
    "https://new-domain.example/auth/confirm",
  );
  for (const value of [
    "",
    " ",
    "http://localhost:8081",
    "squadbeacon://auth/callback",
    "https://site.example/path",
    "https://site.example?next=foo",
    "https://site.example#token",
    "https://user:pass@site.example",
    "not-a-url",
  ]) {
    assert.throws(
      () => authCallbackUrl(false, value),
      /EXPO_PUBLIC_AUTH_ORIGIN/,
    );
  }
});

test("email addresses are trimmed and malformed auth links fail before exchange", () => {
  assert.equal(
    accountEmail(" fixture@example.invalid "),
    "fixture@example.invalid",
  );
  assert.throws(() => accountEmail("no address"));
  for (const type of ["email", "signup", "recovery"])
    assert.equal(usableAuthLink({ token_hash: "fixture", type }), true);
  assert.equal(usableAuthLink({ code: "pkce" }), true);
  for (const input of [
    {},
    { code: [] },
    { code: " " },
    { token_hash: [] },
    { token_hash: "hash", type: "unknown" },
    { token_hash: "hash", type: ["email"] },
    { token_hash: "hash", type: "email", code: "code" },
    { token_hash: "hash", type: "email", error_description: "expired" },
  ])
    assert.equal(usableAuthLink(input), false);
});
import {
  rememberEntryIntent,
  consumeEntryIntent,
  clearEntryIntent,
} from "../src/features/auth/entryIntent";

function account() {
  const { data } = makeScenario("fresh");
  data.is_demo = false;
  return {
    data,
    userId: data.viewer_id!,
    session: { user: { id: data.viewer_id! } },
    demo: false,
    loading: false,
    error: null as string | null,
  };
}
for (const status of ["pending", "skipped", "completed"] as const) {
  test(`${status}: required-profile readiness permits both entry and progress`, () => {
    const input = account();
    input.data.profiles[0].onboarding_survey_status = status;
    assert.equal(accountReadiness(input).state, "ready");
    assert.equal(
      accountReadiness({
        ...input,
        demo: true,
        session: null,
        data: { ...input.data, is_demo: true },
      }).state,
      "ready",
    );
  });
}
test("only a successful viewer-matched read can establish missing required profile", () => {
  const input = account();
  input.data.profiles = [];
  assert.equal(accountReadiness(input).state, "needs-profile");
  assert.equal(accountReadiness({ ...input, loading: true }).state, "loading");
  assert.equal(
    accountReadiness({ ...input, error: "offline" }).state,
    "unavailable",
  );
  assert.equal(
    accountReadiness({ ...input, data: { ...input.data, viewer_id: "other" } })
      .state,
    "unavailable",
  );
  assert.equal(
    accountReadiness({ ...input, session: null }).state,
    "unavailable",
  );
  assert.equal(
    accountReadiness({ ...input, session: { user: { id: "other" } } }).state,
    "unavailable",
  );
  assert.equal(
    accountReadiness({ ...input, userId: null, session: null }).state,
    "signed-out",
  );
});
test("demo/live snapshots cannot be interchanged", () => {
  const input = account();
  assert.equal(accountReadiness({ ...input, demo: true }).state, "unavailable");
  input.data.is_demo = true;
  assert.equal(accountReadiness(input).state, "unavailable");
});
test("basic setup validates dates and the exact age boundary without optional fields", () => {
  const today = new Date(2026, 9, 27);
  const payload = basicProfilePayload(
    "  New Person  ",
    "  NEW_person ",
    "2010-10-27",
    "America/Chicago",
    today,
  );
  assert.deepEqual(payload, {
    name: "New Person",
    username: "new_person",
    birth_date: "2010-10-27",
    timezone: "America/Chicago",
  });
  for (const birth of [
    "2010-10-28",
    "2030-01-01",
    "1900-01-01",
    "2001-02-29",
    "2000-02-30",
    "2000-13-01",
    "2000-1-1",
    "",
  ]) {
    assert.throws(() =>
      basicProfilePayload("Name", "valid_name", birth, "UTC", today),
    );
  }
  assert.doesNotThrow(() =>
    basicProfilePayload("Name", "valid_name", "2000-02-29", "UTC", today),
  );
  assert.throws(() =>
    basicProfilePayload(" ", "valid_name", "2000-01-01", "UTC", today),
  );
  assert.throws(() =>
    basicProfilePayload("Name", "a!", "2000-01-01", "UTC", today),
  );
  assert.match(
    profileEntryError(
      new Error(
        'duplicate key value violates unique constraint "profiles_username_key"',
      ),
    ),
    /already in use/,
  );
});
test("entry intent preserves supported parameters, rejects external paths and clears on consumption", () => {
  clearEntryIntent();
  rememberEntryIntent("/invite", { username: "friend_name" });
  assert.equal(consumeEntryIntent(), "/invite?username=friend_name");
  assert.equal(consumeEntryIntent(), "/");
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/auth/callback",
    "/invite?next=evil",
    "/invite\\evil",
  ]) {
    rememberEntryIntent(path, {});
    assert.equal(consumeEntryIntent(), "/");
  }
  rememberEntryIntent("/activity/authorized-id", { focus: "chat" });
  clearEntryIntent();
  assert.equal(consumeEntryIntent(), "/");
});
