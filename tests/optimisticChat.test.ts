import assert from "node:assert/strict";
import test from "node:test";
import { OptimisticChatQueue } from "../src/features/messages/optimisticQueue";

const message = (id: string, body = "hello") => ({
  id,
  body,
  authorId: "viewer",
  createdAt: "2026-10-08T12:00:00Z",
});
test("failed sends retain their body, require manual retry, and remain single flight", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:dm:a");
  const token = queue.begin("hello", "viewer", [])!;
  assert.equal(queue.begin("second", "viewer", []), undefined);
  queue.fail(token, "offline");
  assert.equal(queue.rows[0].body, "hello");
  assert.equal(queue.rows[0].state, "failed");
  const retry = queue.retry(token.id, [])!;
  assert.notEqual(retry.attempt, token.attempt);
  queue.complete(token, "obsolete");
  assert.equal(queue.rows[0].state, "sending");
  queue.complete(retry, "canonical");
  queue.observe([message("canonical")]);
  assert.equal(queue.rows.length, 0);
});
test("scope changes and late acknowledgements cannot modify another conversation", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const token = queue.begin("hello", "viewer", [])!;
  queue.reset("other-viewer:b");
  queue.begin("new", "other-viewer", []);
  queue.complete(token, "late");
  queue.fail(token, "late failure");
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].body, "new");
  assert.equal(queue.rows[0].state, "sending");
});
test("old identical bodies are excluded and one canonical message reconciles one local send", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const old = message("old");
  const first = queue.begin("hello", "viewer", [old])!;
  queue.fail(first, "lost response");
  queue.observe([old]);
  assert.equal(queue.rows.length, 1);
  const second = queue.begin("hello", "viewer", [old])!;
  queue.complete(second);
  queue.observe([old, message("new")]);
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].id, second.id);
  queue.observe([old, message("new"), message("newer")]);
  assert.equal(queue.rows.length, 0);
});
test("an observed lost acknowledgement suppresses the explicit retry", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const token = queue.begin("hello", "viewer", [])!;
  queue.fail(token, "timeout");
  assert.equal(queue.retry(token.id, [message("observed")]), undefined);
  assert.equal(queue.rows.length, 0);
});
test("observed data does not unlock an outstanding request before it completes", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const token = queue.begin("hello", "viewer", [])!;
  queue.observe([message("observed")]);
  assert.equal(queue.rows.length, 0);
  assert.equal(queue.busy, true);
  assert.equal(queue.begin("second", "viewer", []), undefined);
  queue.complete(token, "observed");
  assert.equal(queue.busy, false);
});
test("returning to the same scope cannot accept an earlier attempt", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const old = queue.begin("hello", "viewer", [])!;
  queue.reset("viewer:b");
  queue.reset("viewer:a");
  const current = queue.begin("hello", "viewer", [])!;
  assert.equal(queue.isCurrentAttempt(old), false);
  assert.equal(queue.isCurrentAttempt(current), true);
  queue.complete(old, "obsolete");
  assert.equal(queue.busy, true);
  assert.equal(queue.rows[0].state, "sending");
});

test("authoritative receipt adopts database id and timestamp before the snapshot arrives", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const token = queue.begin("hello", "viewer", [])!;
  queue.complete(token, "database-id", "2026-10-08T12:00:05Z");
  assert.equal(queue.rows[0].id, "database-id");
  assert.equal(queue.rows[0].createdAt, "2026-10-08T12:00:05Z");
  queue.observe([message("same-body-other-id")]);
  assert.equal(queue.rows.length, 1);
  queue.observe([message("database-id")]);
  assert.equal(queue.rows.length, 0);
});
test("an unseen old identical message does not reconcile a fresh attempt", () => {
  const queue = new OptimisticChatQueue(() => "2026-10-08T12:00:00Z");
  queue.reset("viewer:a");
  const token = queue.begin("hello", "viewer", [])!;
  queue.fail(token, "offline");
  queue.observe([
    { ...message("unseen-old"), createdAt: "2026-10-08T10:00:00Z" },
  ]);
  assert.equal(queue.rows[0].state, "failed");
});
