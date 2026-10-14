import type { Activity, Data } from "@/src/shared/types";
import { canUseBeaconModules } from "./beaconModules";
import { isBeaconModuleEnabled } from "./permissions";

export type BeaconToolId = "checklist" | "journal" | "focus" | "experiences" | "scoreboard" | "music" | "chat";
const tools: readonly BeaconToolId[] = ["checklist", "journal", "focus", "experiences", "scoreboard", "music", "chat"];

/** URL input never grants tool access or overrides disabled module settings. */
export function resolveActivityToolEntry(data: Data, activity: Activity | undefined, userId: string | null, tab: unknown, tool: unknown) {
  const overview = { tab: "Overview" as const, tool: null };
  if (!userId || data.viewer_id !== userId || !activity || !canUseBeaconModules(data, activity, userId)) return overview;
  if (tab === "chat") return isBeaconModuleEnabled(activity, "chat") ? { tab: "Chat" as const, tool: null } : overview;
  if (tab !== "tools") return overview;
  if (tool != null && tool !== "") {
    if (typeof tool !== "string" || !tools.includes(tool as BeaconToolId) || !isBeaconModuleEnabled(activity, tool as BeaconToolId)) return overview;
    return { tab: "Tools" as const, tool: tool as BeaconToolId };
  }
  return tools.some((id) => isBeaconModuleEnabled(activity, id)) ? { tab: "Tools" as const, tool: null } : overview;
}
