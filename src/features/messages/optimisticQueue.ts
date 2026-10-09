export type CanonicalChatMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};
export type QueuedChatMessage = CanonicalChatMessage & {
  state: "sending" | "failed" | "sent";
  error?: string;
  baselineIds: Set<string>;
  acknowledgedId?: string;
  attempt: number;
};

/** Local presentation only: the server has no nonce or idempotency contract. */
export class OptimisticChatQueue {
  constructor(private now: () => string = () => new Date().toISOString()) {}
  scope = "";
  rows: QueuedChatMessage[] = [];
  private sequence = 0;
  private attempt = 0;
  private claimedIds = new Set<string>();
  private inFlight?: { scope: string; id: string; attempt: number };
  private listeners = new Set<() => void>();
  private snapshot = {
    scope: "",
    rows: [] as QueuedChatMessage[],
    busy: false,
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish() {
    this.snapshot = {
      scope: this.scope,
      rows: this.rows.map((row) => ({ ...row })),
      busy: this.busy,
    };
    this.listeners.forEach((listener) => listener());
  }

  reset(scope: string) {
    this.scope = scope;
    this.rows = [];
    this.claimedIds.clear();
    this.inFlight = undefined;
    this.publish();
  }

  get busy() {
    return !!this.inFlight;
  }
  isCurrentAttempt(token: { scope: string; id: string; attempt: number }) {
    return (
      this.inFlight?.scope === token.scope &&
      this.inFlight.id === token.id &&
      this.inFlight.attempt === token.attempt
    );
  }

  begin(body: string, authorId: string, canonical: CanonicalChatMessage[]) {
    if (this.busy || !body.trim()) return undefined;
    const row: QueuedChatMessage = {
      id: `local:${++this.sequence}`,
      body: body.trim(),
      authorId,
      createdAt: this.now(),
      state: "sending",
      baselineIds: new Set(canonical.map((message) => message.id)),
      attempt: ++this.attempt,
    };
    this.rows.push(row);
    this.inFlight = { scope: this.scope, id: row.id, attempt: row.attempt };
    this.publish();
    return this.inFlight;
  }

  retry(id: string, canonical: CanonicalChatMessage[]) {
    this.observe(canonical);
    const row = this.rows.find((item) => item.id === id);
    if (this.busy || row?.state !== "failed") return undefined;
    row.state = "sending";
    row.error = undefined;
    row.baselineIds = new Set(canonical.map((message) => message.id));
    row.attempt = ++this.attempt;
    this.inFlight = { scope: this.scope, id: row.id, attempt: row.attempt };
    this.publish();
    return this.inFlight;
  }

  complete(
    token: { scope: string; id: string; attempt: number },
    acknowledgedId?: string,
    acknowledgedCreatedAt?: string,
  ) {
    const row = this.current(token);
    this.finishFlight(token);
    if (!row) {
      this.publish();
      return;
    }
    row.state = "sent";
    row.acknowledgedId = acknowledgedId;
    if (acknowledgedId) row.id = acknowledgedId;
    if (
      acknowledgedCreatedAt &&
      Number.isFinite(Date.parse(acknowledgedCreatedAt))
    )
      row.createdAt = acknowledgedCreatedAt;
    row.error = undefined;
    this.publish();
  }

  fail(token: { scope: string; id: string; attempt: number }, error: string) {
    const row = this.current(token);
    this.finishFlight(token);
    if (!row) {
      this.publish();
      return;
    }
    row.state = "failed";
    row.error = error;
    this.publish();
  }

  observe(canonical: CanonicalChatMessage[]) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => {
      const observed = row.acknowledgedId
        ? canonical.find((message) => message.id === row.acknowledgedId)
        : canonical.find(
            (message) =>
              !row.baselineIds.has(message.id) &&
              !this.claimedIds.has(message.id) &&
              message.authorId === row.authorId &&
              message.body === row.body &&
              // Best effort only: tolerate 60s of clock skew; text/time cannot prove send identity.
              Date.parse(message.createdAt) >=
                Date.parse(row.createdAt) - 60_000,
          );
      if (!observed) return true;
      this.claimedIds.add(observed.id);
      return false;
    });
    if (this.rows.length !== before) this.publish();
  }

  private current(token: { scope: string; id: string; attempt: number }) {
    if (token.scope !== this.scope) return undefined;
    return this.rows.find(
      (row) => row.id === token.id && row.attempt === token.attempt,
    );
  }

  private finishFlight(token: { scope: string; id: string; attempt: number }) {
    if (
      this.inFlight?.scope === token.scope &&
      this.inFlight.id === token.id &&
      this.inFlight.attempt === token.attempt
    )
      this.inFlight = undefined;
  }
}
