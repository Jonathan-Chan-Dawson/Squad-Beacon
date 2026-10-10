import type { PulseAnswers } from "./types";
import { PulseDemoStore } from "./demoStore";
export class PulseClientSession {
  readonly demo: PulseDemoStore | null;
  readonly answers = new Map<string, PulseAnswers>();
  readonly confirmations = new Map<string, number>();
  readonly hidden = new Map<string, string>();
  private locked = false;
  constructor(
    readonly scope: string,
    demo: boolean,
    startedAt?: number,
  ) {
    this.demo = demo ? new PulseDemoStore(startedAt) : null;
  }
  isLocked() {
    return this.locked;
  }
  setLocked(value: boolean) {
    this.locked = value;
  }
}

// Retain only the current viewer session, not a history of other accounts.
let retained: PulseClientSession | null = null;
export function findPulseClientSession(scope: string) {
  return retained?.scope === scope ? retained : null;
}
export function retainPulseClientSession(session: PulseClientSession) {
  retained = session;
}
