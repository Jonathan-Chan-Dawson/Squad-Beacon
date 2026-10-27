export const progressKeys = [
  "entry.eligible.v1",
  "welcome.seen.v1",
  "welcome.dismissed.v1",
  "tip.ping.v1",
  "tip.vote.v1",
  "tip.plan.v1",
  "tip.visibility.v1",
  "tip.sonar.v1",
  "tip.routine.v1",
  "success.firstBeacon.v1",
  "success.firstConnection.v1",
  "success.firstCompletion.v1",
] as const;
export type OnboardingKey = (typeof progressKeys)[number];
export type ProgressStatus = "loading" | "ready" | "error";
export type SuccessKey = Extract<OnboardingKey, `success.${string}`>;
export function parseProgress(rows: unknown): Set<OnboardingKey> {
  if (!Array.isArray(rows)) throw new Error("Invalid onboarding progress.");
  const keys = new Set<OnboardingKey>();
  for (const row of rows) {
    if (row && typeof row.key === "string" && progressKeys.includes(row.key))
      keys.add(row.key);
  }
  return keys;
}
type SuccessEvent = { viewer: string; epoch: number; key: SuccessKey };
const listeners = new Set<(event: SuccessEvent) => void>();
export function reportOnboardingSuccess(event: SuccessEvent) {
  listeners.forEach((listener) => listener(event));
}
export function listenOnboardingSuccess(
  listener: (event: SuccessEvent) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
