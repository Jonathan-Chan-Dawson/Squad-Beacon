import type { Activity, Data, Payload } from "@/src/shared/types";
import { canUseBeaconModules, canReadBeaconModuleEntry } from "./beaconModules";
import { canManageBeacon, isApprovedGoing, beaconSeatCount, isBeaconModuleEnabled, beaconRoleFor } from "./permissions";
export interface SupplyRequest { id: string; activity_id: string; label: string; kind: "group" | "personal"; quantity: number; created_at: string; claimed_quantity?: number; }
export interface SupplyClaim { request_id: string; activity_id: string; user_id: string; quantity: number; }
export function canContribute(data: Data, activity: Activity, userId: string) {
  return data.viewer_id === userId && canUseBeaconModules(data, activity, userId) && activity.status === "scheduled" && (activity.owner_id === userId || isApprovedGoing(activity, data.rsvps.find(row => row.activity_id === activity.id && row.user_id === userId)));
}
export function eligibleSupplyClaim(data: Data, claim: SupplyClaim) {
  const activity = data.activities.find(row => row.id === claim.activity_id);
  if (!activity) return false;
  return (claim.user_id === activity.owner_id || isApprovedGoing(activity, data.rsvps.find(row => row.activity_id === activity.id && row.user_id === claim.user_id))) && !data.blocks.some(row => row.blocker_id === activity.owner_id && row.blocked_id === claim.user_id || row.blocked_id === activity.owner_id && row.blocker_id === claim.user_id);
}
export function supplyRows(data: Data, activity: Activity, userId: string | null) {
  if (!userId || data.viewer_id !== userId || !canUseBeaconModules(data, activity, userId)) return [];
  return data.beacon_supply_requests.filter(row => row.activity_id === activity.id).map(row => {
    const claims = data.beacon_supply_claims.filter(claim => claim.request_id === row.id && eligibleSupplyClaim(data, claim));
    const claimed = row.claimed_quantity ?? claims.reduce((sum, claim) => sum + claim.quantity, 0);
    return { ...row, claims, claimed, remaining: row.kind === "group" ? Math.max(0, row.quantity - claimed) : 0 };
  });
}
export function beaconReadiness(data: Data, activity: Activity, userId: string | null) {
  if (!userId || data.viewer_id !== userId || !canUseBeaconModules(data, activity, userId) || activity.status !== "scheduled" || Date.parse(activity.ends_at) <= Date.now()) return [];
  const rows: { id: string; label: string; destination: "People" | "Activity" }[] = [];
  if (activity.target_count) { const missing = Math.max(0, activity.target_count - beaconSeatCount(data, activity)); rows.push({ id: "players", label: missing ? `${missing} more participant${missing === 1 ? "" : "s"} needed` : "Participant target covered", destination: "People" }); }
  for (const row of supplyRows(data, activity, userId).filter(row => row.kind === "group")) rows.push({ id: row.id, label: row.remaining ? `${row.label}: ${row.remaining} still needed` : `${row.label}: covered`, destination: "People" });
  if (isBeaconModuleEnabled(activity, "checklist")) { const tasks = data.beacon_checklist_items.filter(row => row.activity_id === activity.id && !row.completed && row.assignee_id && ["owner", "coowner", "admin"].includes(beaconRoleFor(data, activity, row.assignee_id)) && canReadBeaconModuleEntry(data, activity, row.author_id, userId)); if (tasks.length) rows.push({ id: "tasks", label: `${tasks.length} organizer task${tasks.length === 1 ? "" : "s"} open`, destination: "Activity" }); }
  return rows;
}
export function applyDemoSupplyAction(data: Data, action: string, payload: Payload, userId: string) {
  if (!["save_supply_request", "delete_supply_request", "claim_supply"].includes(action)) return false;
  const existing = data.beacon_supply_requests.find(row => row.id === payload.id || row.id === payload.request_id);
  const activity = data.activities.find(row => row.id === (existing?.activity_id ?? payload.activity_id));
  if (!activity || data.viewer_id !== userId) throw new Error("Beacon unavailable.");
  if (action === "claim_supply") {
    if (!existing || existing.kind !== "group" || !canContribute(data, activity, userId)) throw new Error("Join this Beacon before claiming supplies.");
    const quantity = Number(payload.quantity); if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) throw new Error("Choose a valid quantity.");
    const others = data.beacon_supply_claims.filter(row => row.request_id === existing.id && row.user_id !== userId && eligibleSupplyClaim(data, row)).reduce((sum,row) => sum + row.quantity,0);
    if (others + quantity > existing.quantity) throw new Error("Someone has claimed these supplies. Refresh and choose the remaining quantity.");
    data.beacon_supply_claims = data.beacon_supply_claims.filter(row => row.request_id !== existing.id || row.user_id !== userId);
    if (quantity) data.beacon_supply_claims.push({ request_id: existing.id, activity_id: activity.id, user_id: userId, quantity });
  } else {
    if (!canManageBeacon(data, activity, userId)) throw new Error("Only Beacon organizers can manage supplies.");
    if (action === "delete_supply_request") { if (!existing) throw new Error("Supply unavailable."); data.beacon_supply_requests = data.beacon_supply_requests.filter(row => row.id !== existing.id); data.beacon_supply_claims = data.beacon_supply_claims.filter(row => row.request_id !== existing.id); }
    else { const label = String(payload.label ?? "").trim(); const quantity = Number(payload.quantity); const kind = payload.kind === "personal" ? "personal" : "group"; if (!label || label.length > 120 || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Add a name and quantity from 1 to 999."); const claimed = existing ? data.beacon_supply_claims.filter(row => row.request_id === existing.id && eligibleSupplyClaim(data,row)).reduce((sum,row)=>sum+row.quantity,0) : 0; if (claimed && (quantity < claimed || kind !== existing?.kind)) throw new Error("Release existing commitments before reducing this request."); const value: SupplyRequest = { id: existing?.id ?? String(payload.id), activity_id: activity.id, label, kind, quantity, created_at: existing?.created_at ?? new Date().toISOString() }; data.beacon_supply_requests = [...data.beacon_supply_requests.filter(row => row.id !== value.id),value]; }
  }
  return true;
}
