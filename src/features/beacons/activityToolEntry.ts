import type { Activity, Data } from "@/src/shared/types";
import { canUseBeaconModules } from "./beaconModules";
import { canManageBeacon, isBeaconModuleEnabled } from "./permissions";

const tools = [
  "checklist",
  "journal",
  "focus",
  "experiences",
  "scoreboard",
  "music",
  "chat",
] as const;
type ModuleToolId = (typeof tools)[number];
export type BeaconToolId = ModuleToolId | "agenda";

export function canOpenActivitySchedule(
  data: Data,
  activity: Activity,
  viewer: string,
) {
  return (
    data.viewer_id === viewer &&
    canUseBeaconModules(data, activity, viewer) &&
    !!(data.is_demo || data.capabilities?.beacon_expansion) &&
    (canManageBeacon(data, activity, viewer) ||
      !!data.premium_tool_configs?.some(
        (config) =>
          config.activity_id === activity.id && config.kind === "agenda",
      ))
  );
}

/** URL input never grants tool access or overrides disabled module settings. */
export function resolveActivityToolEntry(
  data: Data,
  activity: Activity | undefined,
  userId: string | null,
  tab: unknown,
  tool: unknown,
) {
  const overview = { tab: "Overview" as const, tool: null };
  if (
    !userId ||
    data.viewer_id !== userId ||
    !activity ||
    !canUseBeaconModules(data, activity, userId)
  )
    return overview;
  if (tab === "chat")
    return isBeaconModuleEnabled(activity, "chat")
      ? { tab: "Chat" as const, tool: null }
      : overview;
  if (tab === "people") return { tab: "People" as const, tool: null };
  if (
    tab === "memories" ||
    (tool === "experiences" && (tab === "tools" || tab === "activity"))
  )
    return isBeaconModuleEnabled(activity, "experiences")
      ? { tab: "Memories" as const, tool: null }
      : overview;
  if (tab !== "tools" && tab !== "activity") return overview;
  if (tool === "agenda")
    return canOpenActivitySchedule(data, activity, userId)
      ? { tab: "Activity" as const, tool: "agenda" as const }
      : overview;
  if (tool != null && tool !== "") {
    if (
      typeof tool !== "string" ||
      !tools.includes(tool as ModuleToolId) ||
      !isBeaconModuleEnabled(activity, tool as ModuleToolId)
    )
      return overview;
    return { tab: "Activity" as const, tool: tool as ModuleToolId };
  }
  return tools.some((id) => isBeaconModuleEnabled(activity, id)) ||
    canOpenActivitySchedule(data, activity, userId)
    ? { tab: "Activity" as const, tool: null }
    : overview;
}
