import type { PulseCondition, PulseKind } from "./types";
import type { PulseReport } from "./reports";
export const PULSE_HALF_LIFE_MINUTES: Record<PulseKind, number> = {
  crowd: 20,
  wait: 15,
  parking: 20,
  availability: 30,
  condition: 180,
};
export const PULSE_TTL_MINUTES: Record<PulseKind, number> = {
  crowd: 90,
  wait: 45,
  parking: 60,
  availability: 90,
  condition: 360,
};
export function pulseTTL(kind: PulseKind, value: number | PulseCondition) {
  return (value === "blocked_closed" ? 240 : PULSE_TTL_MINUTES[kind]) * 60000;
}
export function pulseWeight(report: PulseReport, now: number) {
  return Math.pow(
    0.5,
    Math.max(
      0,
      now -
        Math.max(report.createdAt, report.lastConfirmedAt ?? report.createdAt),
    ) /
      60000 /
      PULSE_HALF_LIFE_MINUTES[report.kind],
  );
}
export function confirmPulseReport(
  report: PulseReport,
  now: number,
): PulseReport {
  if (report.expiresAt <= now) return report;
  const ttl = pulseTTL(report.kind, report.value);
  return {
    ...report,
    lastConfirmedAt: now,
    confirmCount: report.confirmCount + 1,
    expiresAt: Math.min(
      report.createdAt + 2 * ttl,
      Math.max(report.expiresAt, now + ttl),
    ),
  };
}
