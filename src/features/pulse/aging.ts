import { PULSE_HALF_LIFE_MINUTES } from "./expiry";
import { validPulseAnswer } from "./pulseProfiles";
import { PULSE_KINDS, type PulseSummary } from "./types";
/** Conservative at the first contributor expiry; no raw rows or timed network requests. */
export function agePulseSummary(
  input: PulseSummary,
  now: number,
): PulseSummary {
  if (!input.signals || input.generatedAt === undefined)
    return { ...input, freshness: 0 };
  const summary: PulseSummary = {
    ...input,
    conditions: [...input.conditions],
    confidence: { ...input.confidence },
    freshness: 0,
    importance: 0,
    recentCount: 0,
    updatedAt: 0,
  };
  for (const kind of PULSE_KINDS) {
    const signal = input.signals[kind];
    const decay = Math.pow(
      0.5,
      Math.max(0, now - input.generatedAt) /
        60000 /
        PULSE_HALF_LIFE_MINUTES[kind],
    );
    const alive = !!signal && now < signal.validUntil;
    if (alive) {
      summary.recentCount += signal.count;
      summary.updatedAt = Math.max(summary.updatedAt, signal.updatedAt);
    }
    if (!alive || signal.totalWeight * decay < 0.15) {
      delete summary.confidence![kind];
      if (kind === "crowd" || kind === "wait" || kind === "parking")
        delete summary[kind];
      else
        summary.conditions = summary.conditions.filter(
          (condition) =>
            !validPulseAnswer(summary.category, kind, condition.key),
        );
    } else
      summary.freshness = Math.max(summary.freshness, signal.freshness * decay);
  }
  summary.importance = Math.max(
    (summary.crowd ?? 0) / 3,
    (summary.wait ?? 0) / 3,
    (summary.parking ?? 0) / 2,
    ...summary.conditions.map((condition) =>
      condition.key === "blocked_closed" ? 0.9 : 0.65,
    ),
    0,
  );
  if (summary.noteValidUntil === undefined || now >= summary.noteValidUntil) {
    delete summary.noteSample;
    delete summary.noteValidUntil;
  }
  return summary;
}
