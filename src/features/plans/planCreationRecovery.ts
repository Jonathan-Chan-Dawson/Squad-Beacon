export interface PlanCreationAttempt {
  id: string;
  payload: Record<string, unknown>;
  resultId?: string;
}

/** One in-session operation, retained if a failed snapshot temporarily removes the route. */
let pending: { scope: string; attempt: PlanCreationAttempt } | undefined;
export function pendingPlanCreation(scope: string) {
  if (pending?.scope !== scope) pending = undefined;
  return pending?.attempt;
}
export function retainPlanCreation(
  scope: string,
  attempt: PlanCreationAttempt,
) {
  pending = { scope, attempt };
}
export function clearPlanCreation(scope: string) {
  if (pending?.scope === scope) pending = undefined;
}
