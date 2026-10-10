import type { PulseReport } from "./reports";
import { pulseWeight } from "./expiry";
import { validPulseAnswer } from "./pulseProfiles";
import { PULSE_KINDS, type PulseSummary } from "./types";
/** Input rows are normalized: one active owner/place/kind, with no reporter identifier. */
export function aggregatePulse(
  reports: readonly PulseReport[],
  now: number,
): PulseSummary {
  const first = reports[0];
  if (!first || reports.some((report) => report.placeKey !== first.placeKey))
    throw new Error("Aggregate one place at a time.");
  const active = reports.filter(
    (report, index) =>
      report.expiresAt > now &&
      validPulseAnswer(report.category, report.kind, report.value) &&
      reports.findIndex((row) => row.id === report.id) === index,
  );
  const summary: PulseSummary = {
    placeKey: first.placeKey,
    lat: first.lat,
    lng: first.lng,
    category: first.category,
    conditions: [],
    recentCount: active.length,
    confirmCount: Math.max(0, ...active.map((report) => report.confirmCount)),
    updatedAt: Math.max(
      0,
      ...active.map((report) =>
        Math.max(report.createdAt, report.lastConfirmedAt ?? 0),
      ),
    ),
    freshness: 0,
    importance: 0,
    confidence: {},
    generatedAt: now,
    signals: {},
  };
  for (const kind of PULSE_KINDS) {
    const rows = active.filter((report) => report.kind === kind);
    const total = rows.reduce(
      (sum, report) => sum + pulseWeight(report, now),
      0,
    );
    if (rows.length)
      summary.signals![kind] = {
        totalWeight: total,
        freshness: Math.max(...rows.map((row) => pulseWeight(row, now))),
        validUntil: Math.min(...rows.map((row) => row.expiresAt)),
        count: rows.length,
        updatedAt: Math.max(
          ...rows.map((row) =>
            Math.max(row.createdAt, row.lastConfirmedAt ?? row.createdAt),
          ),
        ),
      };
    if (total < 0.15) continue;
    summary.confidence![kind] = rows.length;
    summary.freshness = Math.max(
      summary.freshness,
      ...rows.map((report) => pulseWeight(report, now)),
    );
    if (kind === "crowd" || kind === "wait" || kind === "parking") {
      const mean =
        rows.reduce(
          (sum, report) =>
            sum + Number(report.value) * pulseWeight(report, now),
          0,
        ) / total;
      const lower = Math.floor(mean),
        upper = Math.ceil(mean);
      const newest = [...rows].sort(
        (a, b) =>
          Math.max(b.createdAt, b.lastConfirmedAt ?? 0) -
            Math.max(a.createdAt, a.lastConfirmedAt ?? 0) ||
          b.id.localeCompare(a.id),
      )[0];
      const rounded =
        Math.abs(mean - lower - 0.5) < 1e-9
          ? Number(newest.value) >= mean
            ? upper
            : lower
          : Math.round(mean);
      Object.assign(summary, { [kind]: rounded });
    } else {
      for (const value of new Set(rows.map((report) => report.value))) {
        const matching = rows.filter((report) => report.value === value);
        if (typeof value === "string")
          summary.conditions.push({
            key: value,
            strength: matching.length >= 2 ? "likely" : "reported",
          });
      }
    }
  }
  summary.freshness = Math.min(1, summary.freshness);
  summary.importance = Math.max(
    (summary.crowd ?? 0) / 3,
    (summary.wait ?? 0) / 3,
    (summary.parking ?? 0) / 2,
    ...summary.conditions.map((condition) =>
      condition.key === "blocked_closed" ? 0.9 : 0.65,
    ),
    0,
  );
  const noteRow = [...active]
    .filter((report) => report.note?.trim())
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))[0];
  const note = noteRow?.note?.trim().slice(0, 80);
  if (note) {
    summary.noteSample = note;
    summary.noteValidUntil = noteRow.expiresAt;
  }
  return summary;
}
