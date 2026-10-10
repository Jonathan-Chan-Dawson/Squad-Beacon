import type { PulseSummary } from "./types";
import {
  pulseConditionText,
  pulseLevelText,
  pulseMetaText,
} from "./copy/pulse";
export function pulseReadout(summary: PulseSummary) {
  const labels: string[] = [];
  for (const kind of ["crowd", "wait", "parking"] as const) {
    const value = summary[kind];
    if (value !== undefined)
      labels.push(
        pulseLevelText(kind, value, (summary.confidence?.[kind] ?? 0) < 2),
      );
  }
  labels.push(
    ...summary.conditions.map((condition) =>
      pulseConditionText(condition.key, condition.strength),
    ),
  );
  return labels;
}
export function pulseSummaryLabel(summary: PulseSummary, now = Date.now()) {
  return [
    ...pulseReadout(summary),
    pulseMetaText(summary.recentCount, summary.updatedAt, now),
  ].join(", ");
}
