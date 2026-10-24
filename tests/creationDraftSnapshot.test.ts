import { validCreationMeetingLink } from "../src/features/beacons/creationValidation";
import test from "node:test";
import assert from "node:assert/strict";
import {
  splitCreationStorageText,
  parseCreationSnapshot,
  runFrozenPublication,
  type CreationSnapshot,
  type FrozenPublication,
} from "../src/features/beacons/draftSnapshot";
import { defaultBeaconControlValues } from "../src/features/beacons/controls";

const snapshot = (): CreationSnapshot => ({
  version: 1,
  viewer: "alice",
  token: "creation:draft-one",
  updatedAt: 1,
  context: { editor: "yes" },
  fields: {
    title: "Basketball",
    category: "Fitness",
    pin: { latitude: 0, longitude: 0 },
    beaconControlDraft: { routeKey: "[]", value: defaultBeaconControlValues() },
  },
});
const attempt = (): FrozenPublication => ({
  action: "create_activity",
  payload: { title: "Original", starts_at: "2026-11-01T17:00:00Z" },
  requestId: "11111111-1111-4111-8111-111111111111",
  viewer: "alice",
});

test("versioned snapshots reject cross-account, corrupt controls, dates, and coordinates", () => {
  assert.equal(
    parseCreationSnapshot(JSON.stringify(snapshot()), "alice").fields.title,
    "Basketball",
  );
  for (const patch of [
    { version: 2 },
    { viewer: "bob" },
    { fields: { pin: { latitude: 95, longitude: 0 } } },
    { fields: { starts: "bad" } },
    {
      fields: {
        beaconControlDraft: { routeKey: "[]", value: { capacity_limit: -1 } },
      },
    },
    { fields: { inviteeIds: [1] } },
  ]) {
    assert.throws(() =>
      parseCreationSnapshot(
        JSON.stringify({ ...snapshot(), ...patch }),
        "alice",
      ),
    );
  }
});
test("untrusted publication recovery never restores arbitrary actions or another viewer", () => {
  assert.throws(() =>
    parseCreationSnapshot(
      JSON.stringify({
        ...snapshot(),
        fields: {
          pendingPublication: { ...attempt(), action: "delete_account" },
        },
      }),
      "alice",
    ),
  );
  assert.throws(() =>
    parseCreationSnapshot(
      JSON.stringify({
        ...snapshot(),
        fields: { pendingPublication: { ...attempt(), viewer: "bob" } },
      }),
      "alice",
    ),
  );
});
test("storage failure prevents network publication", async () => {
  let sent = 0;
  await assert.rejects(
    runFrozenPublication(
      attempt(),
      "alice",
      async () => {
        throw new Error("disk full");
      },
      async () => {
        sent++;
        return { id: "beacon" };
      },
    ),
    /disk full/,
  );
  assert.equal(sent, 0);
});
test("ambiguous outcomes retain the identical UUID and original payload", async () => {
  const state = attempt(),
    calls: unknown[] = [];
  const send = async (
    action: string,
    payload: Record<string, unknown>,
    requestId: string,
  ) => {
    calls.push({ action, payload, requestId });
    if (calls.length === 1) throw new Error("timeout");
    return { id: "one-beacon" };
  };
  await assert.rejects(
    runFrozenPublication(state, "alice", async () => {}, send),
    /timeout/,
  );
  const restored = JSON.parse(JSON.stringify(state));
  const result = await runFrozenPublication(
    restored,
    "alice",
    async () => {},
    send,
  );
  assert.equal(result.id, "one-beacon");
  assert.deepEqual(calls[0], calls[1]);
});
test("a confirmed response survives failed result storage and is never resent", async () => {
  const state = attempt();
  let saves = 0,
    sends = 0;
  await assert.rejects(
    runFrozenPublication(
      state,
      "alice",
      async () => {
        if (++saves === 2) throw new Error("storage lost");
      },
      async () => {
        sends++;
        return { id: "confirmed" };
      },
    ),
    /storage lost/,
  );
  assert.equal(state.result?.id, "confirmed");
  await runFrozenPublication(
    state,
    "alice",
    async () => {
      saves++;
    },
    async () => {
      sends++;
      return { id: "duplicate" };
    },
  );
  assert.equal(sends, 1);
  assert.equal(saves, 3);
});
test("unverified atomic invitation responses remain pending", async () => {
  const state = {
    ...attempt(),
    action: "create_activity_with_invitees",
    payload: { invitee_ids: ["friend"] },
  };
  await assert.rejects(
    runFrozenPublication(
      state,
      "alice",
      async () => {},
      async () => ({
        id: "created",
        committed: true,
        event: state.action,
        invited_ids: [],
      }),
    ),
    /could not be verified/,
  );
  assert.equal(state.result, undefined);
});
test("a different account cannot send or clear a pending publication", async () => {
  let called = false;
  await assert.rejects(
    runFrozenPublication(
      attempt(),
      "bob",
      async () => {
        called = true;
      },
      async () => ({ id: "wrong" }),
    ),
    /account/,
  );
  assert.equal(called, false);
});

test("native storage chunks preserve emoji and stay below 2KB", () => {
  const text = "a".repeat(399) + "🏀".repeat(1600) + "\nFinal";
  const chunks = splitCreationStorageText(text);
  assert.equal(chunks.join(""), text);
  for (const chunk of chunks) {
    assert.ok(Buffer.byteLength(chunk, "utf8") <= 1600);
    assert.ok(!/[\uD800-\uDBFF]$/.test(chunk));
  }
});

test("online publication needs a usable HTTPS URL", () => {
  for (const value of ["", "https://", "http://example.com", "https://user:secret@example.com", "words"])
    assert.equal(validCreationMeetingLink(value), false);
  assert.equal(validCreationMeetingLink(" https://example.com/meeting?a=1 "), true);
});
