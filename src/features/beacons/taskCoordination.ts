import type { Data, Payload } from "@/src/shared/types";
import { requirePremiumFeature } from "@/src/shared/entitlements";
import {
  canEditBeaconChecklist,
  canReadBeaconModuleEntry,
} from "./beaconModules";

export function demoTaskCoordination(
  data: Data,
  action: string,
  p: Payload,
  viewer: string,
) {
  if (action !== "save_task_coordination") return false;
  const item = data.beacon_checklist_items.find((i) => i.id === p.id);
  const activity = data.activities.find((a) => a.id === item?.activity_id);
  if (
    !item ||
    !activity ||
    !canEditBeaconChecklist(data, activity, viewer) ||
    !canReadBeaconModuleEntry(data, activity, item.author_id, viewer)
  )
    throw new Error("Task unavailable.");
  if ((item.coordination_revision ?? 0) !== p.revision)
    throw new Error("This task changed. Reopen it.");
  if (!["normal", "high"].includes(String(p.priority)))
    throw new Error("Choose a task priority.");
  if (p.priority !== "normal" && p.priority !== (item.priority ?? "normal"))
    requirePremiumFeature(data, "checklist_organization", activity);
  const prerequisite = p.prerequisite_id ? String(p.prerequisite_id) : null;
  if (prerequisite) {
    if (prerequisite !== item.prerequisite_id)
      requirePremiumFeature(data, "checklist_dependencies", activity);
    const visited = new Set([item.id]);
    let id: string | null | undefined = prerequisite;
    while (id) {
      if (visited.has(id))
        throw new Error("Tasks cannot depend on themselves or form a cycle.");
      visited.add(id);
      const row = data.beacon_checklist_items.find(
        (i) => i.id === id && i.activity_id === activity.id,
      );
      if (
        !row ||
        !canReadBeaconModuleEntry(data, activity, row.author_id, viewer)
      )
        throw new Error("Choose a prerequisite from this Beacon.");
      id = row.prerequisite_id;
    }
  }
  const changed =
    (item.priority ?? "normal") !== p.priority ||
    (item.prerequisite_id ?? null) !== prerequisite;
  item.priority = p.priority as "normal" | "high";
  item.prerequisite_id = prerequisite;
  item.coordination_revision =
    (item.coordination_revision ?? 0) + (changed ? 1 : 0);
  return true;
}
