import type { Activity, Data, Payload } from "@/src/shared/types";
import {
  requirePremiumFeature,
  resolvePremiumFeature,
} from "@/src/shared/entitlements";
import type { PremiumFeature } from "@/src/shared/premiumFeatures";
import { beaconRoleFor, canManageBeacon } from "./permissions";
import { canReadBeaconNote, canUseBeaconModules } from "./beaconModules";
import { canReadMemory } from "./models";
import {
  canReadPlanningThread,
  canRespondToPlanningThread,
  canManagePlanningThread,
} from "@/src/features/planning/domain";

export type ToolKind =
  "focus" | "appearance" | "teams" | "memories" | "council" | "journal";
export type ToolSettings = {
  body?: string;
  heading?: string;
  format?: "plain" | "markdown";
  tags?: string[];
  steps?: { label: string; minutes: number }[];
  group?: string;
  summary?: boolean;
  style?: "standard" | "sunrise" | "ocean";
  layout?: "standard" | "preparation" | "session";
  module_order?: string[];
  team_names?: string[];
  score_steps?: { label: string; points: number }[];
  rotation?: boolean;
  groups?: string[];
  explanations?: boolean;
  readiness?: boolean;
  title?: string;
  memory_ids?: string[];
  highlights?: string[];
};
export type ToolConfiguration = {
  id: string;
  activity_id: string | null;
  thread_id: string | null;
  kind: ToolKind;
  settings: ToolSettings;
  revision: number;
};
export type ToolPreset = {
  id: string;
  owner_id: string;
  kind: ToolKind;
  title: string;
  settings: ToolSettings;
};
export type JournalDetails = {
  note_id: string;
  format: "plain" | "markdown";
  tags: string[];
  linked_note_ids: string[];
};
export type MemoryRecap = {
  id: string;
  activity_id: string;
  title: string;
  introduction: string;
  memory_ids: string[];
  revision: number;
};
const modules = [
  "checklist",
  "journal",
  "focus",
  "scoreboard",
  "experiences",
  "music",
  "chat",
];
export function toolFeature(
  kind: ToolKind,
  settings: ToolSettings,
): PremiumFeature {
  return kind === "journal"
    ? "journal_templates"
    : kind === "focus"
      ? settings.group || settings.summary
        ? "focus_groups"
        : "focus_sequences"
      : kind === "appearance"
        ? (settings.layout && settings.layout !== "standard") ||
          settings.module_order?.length
          ? "layouts"
          : "appearance"
        : kind === "teams"
          ? settings.rotation
            ? "team_rotation"
            : "team_presets"
          : kind === "council"
            ? settings.readiness
              ? "council_readiness"
              : "council_presets"
            : "memory_collections";
}
export function validateToolSettings(
  kind: ToolKind,
  value: unknown,
): ToolSettings {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(value).length > 12000
  )
    throw new Error("Choose a compact tool configuration.");
  const s = value as ToolSettings;
  const keys: Record<ToolKind, string[]> = {
    journal: ["body", "heading", "format", "tags"],
    focus: ["steps", "group", "summary"],
    appearance: ["style", "layout", "module_order"],
    teams: ["team_names", "score_steps", "rotation"],
    memories: ["title", "memory_ids", "highlights"],
    council: ["groups", "explanations", "readiness"],
  };
  if (!keys[kind] || Object.keys(s).some((k) => !keys[kind].includes(k)))
    throw new Error("Unsupported tool configuration.");
  const texts = (v: unknown, max: number, length: number) =>
    Array.isArray(v) &&
    v.length <= max &&
    v.every(
      (t) => typeof t === "string" && t.trim().length > 0 && t.length <= length,
    ) &&
    new Set(v).size === v.length;
  if (
    kind === "journal" &&
    (typeof s.body !== "string" ||
      !s.body.trim() ||
      s.body.length > 1000 ||
      (s.heading?.length ?? 0) > 100 ||
      !["plain", "markdown"].includes(s.format ?? "plain") ||
      !texts(s.tags ?? [], 12, 36))
  )
    throw new Error("Choose a valid Journal template.");
  if (
    kind === "focus" &&
    (!Array.isArray(s.steps) ||
      !s.steps.length ||
      s.steps.length > 12 ||
      s.steps.some(
        (p) =>
          Object.keys(p).some((k) => !["label", "minutes"].includes(k)) ||
          typeof p.label !== "string" ||
          !p.label.trim() ||
          p.label.length > 36 ||
          !Number.isInteger(p.minutes) ||
          p.minutes < 1 ||
          p.minutes > 1440,
      ) ||
      (s.group !== undefined &&
        (typeof s.group !== "string" || s.group.length > 60)))
  )
    throw new Error(
      "Use one to twelve named intervals from 1 to 1440 minutes.",
    );
  if (
    kind === "appearance" &&
    (!["standard", "sunrise", "ocean"].includes(s.style ?? "standard") ||
      !["standard", "preparation", "session"].includes(
        s.layout ?? "standard",
      ) ||
      (s.module_order !== undefined &&
        (!texts(s.module_order, 7, 20) ||
          s.module_order.some((k) => !modules.includes(k)))))
  )
    throw new Error("Choose a supported appearance.");
  if (
    kind === "teams" &&
    (!texts(s.team_names ?? [], 8, 36) ||
      !Array.isArray(s.score_steps) ||
      !s.score_steps.length ||
      s.score_steps.length > 6 ||
      s.score_steps.some(
        (p) =>
          Object.keys(p).some((k) => !["label", "points"].includes(k)) ||
          typeof p.label !== "string" ||
          !p.label.trim() ||
          p.label.length > 36 ||
          !Number.isInteger(p.points) ||
          p.points < 1 ||
          p.points > 1000,
      ))
  )
    throw new Error("Use up to eight team names and six scoring increments.");
  if (kind === "council" && !texts(s.groups ?? [], 12, 60))
    throw new Error("Use up to twelve distinct option groups.");
  if (
    kind === "memories" &&
    ((s.title?.length ?? 0) > 100 ||
      !texts(s.memory_ids ?? [], 50, 64) ||
      !texts(s.highlights ?? [], 50, 64) ||
      (s.highlights ?? []).some((id) => !s.memory_ids?.includes(id)))
  )
    throw new Error(
      "Choose existing photos for this album and its highlights.",
    );
  for (const key of [
    "summary",
    "rotation",
    "explanations",
    "readiness",
  ] as const)
    if (s[key] !== undefined && typeof s[key] !== "boolean")
      throw new Error("Choose valid tool options.");
  return structuredClone(s);
}
export function authorizedMemoryIds(data: Data, ids: string[], viewer: string) {
  return ids.filter((id) => {
    const m = data.beacon_memories.find((m) => m.id === id),
      a = data.activities.find((a) => a.id === m?.activity_id);
    return !!m && !!a && canReadMemory(data, a, m, viewer);
  });
}
const canCurate = (data: Data, a: Activity, v: string) =>
  a.status !== "cancelled" &&
  ["owner", "coowner", "admin"].includes(beaconRoleFor(data, a, v));
export function applyDemoPremiumTools(
  data: Data,
  action: string,
  p: Payload,
  viewer: string,
  newId: () => string,
): boolean {
  if (
    action === "set_council_option_group" ||
    action === "save_council_explanation"
  ) {
    const thread = data.planning_threads.find((t) => t.id === p.thread_id),
      config = data.premium_tool_configs?.find(
        (t) => t.thread_id === p.thread_id && t.kind === "council",
      );
    if (!thread || !canReadPlanningThread(data, thread, viewer))
      throw new Error("Council unavailable.");
    if (action === "save_council_explanation") {
      if (
        !config?.settings.explanations ||
        !canRespondToPlanningThread(data, thread, viewer) ||
        typeof p.body !== "string" ||
        p.body.length > 500
      )
        throw new Error("This explanation cannot be changed.");
      data.council_explanations = [
        ...(data.council_explanations ?? []).filter(
          (e) => e.thread_id !== thread.id || e.user_id !== viewer,
        ),
        ...(p.body.trim()
          ? [{ thread_id: thread.id, user_id: viewer, body: p.body.trim() }]
          : []),
      ];
    } else {
      if (
        !canManagePlanningThread(thread, viewer) ||
        !data.planning_proposals.some(
          (v) => v.id === p.proposal_id && v.thread_id === thread.id,
        )
      )
        throw new Error("Option unavailable.");
      if (
        p.group_label &&
        !config?.settings.groups?.includes(String(p.group_label))
      )
        throw new Error("Choose a configured option group.");
      if (p.group_label)
        requirePremiumFeature(data, "council_presets", {
          id: thread.id,
          owner_id: thread.owner_id,
          audience: thread.audience,
          audience_id: thread.audience_id,
        } as Activity);
      data.council_option_groups = [
        ...(data.council_option_groups ?? []).filter(
          (g) => g.proposal_id !== p.proposal_id,
        ),
        ...(p.group_label
          ? [
              {
                proposal_id: String(p.proposal_id),
                group_label: String(p.group_label),
              },
            ]
          : []),
      ];
    }
    return true;
  }
  if (
    ![
      "save_tool_config",
      "clear_tool_config",
      "save_tool_preset",
      "delete_tool_preset",
      "save_journal_details",
      "save_memory_recap",
      "delete_memory_recap",
    ].includes(action)
  )
    return false;
  const activity = data.activities.find((a) => a.id === p.activity_id);
  if (action === "delete_tool_preset") {
    data.premium_presets = data.premium_presets?.filter(
      (t) => t.id !== p.id || t.owner_id !== viewer,
    );
    return true;
  }
  if (action === "save_journal_details") {
    const note = data.beacon_notes.find(
      (n) => n.id === p.note_id && n.author_id === viewer,
    );
    if (!note || !canReadBeaconNote(data, note, viewer))
      throw new Error("Journal entry unavailable.");
    const source = data.activities.find((a) => a.id === note.activity_id),
      tags = p.tags as string[],
      links = p.linked_note_ids as string[];
    if (
      !Array.isArray(tags) ||
      tags.length > 12 ||
      tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 36) ||
      !Array.isArray(links) ||
      links.length > 12 ||
      !["plain", "markdown"].includes(String(p.format))
    )
      throw new Error("Choose valid Journal details.");
    if (p.format !== "plain" || tags.length || links.length)
      requirePremiumFeature(
        data,
        links.length ? "journal_reflections" : "journal_formatting",
        source,
        note.visibility === "private",
      );
    if (
      links.some(
        (id) =>
          !data.beacon_notes.some(
            (n) => n.id === id && canReadBeaconNote(data, n, viewer),
          ),
      )
    )
      throw new Error("A linked reflection is unavailable.");
    if (p.body !== undefined) {
      if (
        typeof p.body !== "string" ||
        !p.body.trim() ||
        p.body.length > 1000 ||
        note.revision !== p.expected_revision ||
        source?.status === "cancelled"
      )
        throw new Error("This Journal entry changed or is unavailable.");
      note.body = p.body;
      note.revision++;
    }
    data.journal_details = [
      ...(data.journal_details ?? []).filter((d) => d.note_id !== note.id),
      {
        note_id: note.id,
        format: p.format as "plain" | "markdown",
        tags,
        linked_note_ids: links,
      },
    ];
    return true;
  }
  if (action === "delete_memory_recap") {
    const r = data.memory_recaps?.find((r) => r.id === p.id);
    const a = data.activities.find((a) => a.id === r?.activity_id);
    if (!a || !canCurate(data, a, viewer))
      throw new Error("Recap unavailable.");
    data.memory_recaps = data.memory_recaps?.filter((r) => r.id !== p.id);
    return true;
  }
  if (action === "save_memory_recap") {
    if (!activity || !canCurate(data, activity, viewer))
      throw new Error("Only Beacon organizers can edit recaps.");
    requirePremiumFeature(data, "afterglow", activity);
    const ids = p.memory_ids as string[];
    if (
      !Array.isArray(ids) ||
      ids.length > 50 ||
      authorizedMemoryIds(data, ids, viewer).length !== ids.length ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 100 ||
      String(p.introduction ?? "").length > 1000
    )
      throw new Error("Choose a title and authorized memories.");
    const old = data.memory_recaps?.find((r) => r.id === p.id);
    if (old && (old.activity_id !== activity.id || old.revision !== p.revision))
      throw new Error("This recap changed. Reopen it before saving.");
    data.memory_recaps = [
      ...(data.memory_recaps ?? []).filter((r) => r.id !== p.id),
      {
        id: String(p.id || newId()),
        activity_id: activity.id,
        title: p.title,
        introduction: String(p.introduction ?? ""),
        memory_ids: ids,
        revision: (old?.revision ?? -1) + 1,
      },
    ];
    return true;
  }
  const kind = p.kind as ToolKind;
  if (action === "clear_tool_config") {
    const t = data.premium_tool_configs?.find(
      (t) =>
        t.kind === kind &&
        (p.thread_id
          ? t.thread_id === p.thread_id
          : t.activity_id === p.activity_id),
    );
    const thread = data.planning_threads.find((t) => t.id === p.thread_id);
    if (t && t.revision !== p.revision) throw new Error("This tool changed.");
    if (
      !(thread
        ? canReadPlanningThread(data, thread, viewer) &&
          canManagePlanningThread(thread, viewer)
        : activity &&
          (kind === "memories"
            ? canCurate(data, activity, viewer)
            : canManageBeacon(data, activity, viewer)))
    )
      throw new Error("Tool unavailable.");
    data.premium_tool_configs = data.premium_tool_configs?.filter(
      (c) => c.id !== t?.id,
    );
    return true;
  }
  const settings = validateToolSettings(kind, p.settings);
  if (action === "save_tool_preset") {
    requirePremiumFeature(data, toolFeature(kind, settings), undefined, true);
    const old = data.premium_presets?.find((t) => t.id === p.id);
    if (old && old.owner_id !== viewer) throw new Error("Preset unavailable.");
    if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 100)
      throw new Error("Name this preset.");
    data.premium_presets = [
      ...(data.premium_presets ?? []).filter((t) => t.id !== p.id),
      {
        id: String(p.id || newId()),
        owner_id: viewer,
        kind,
        title: p.title,
        settings:
          kind === "memories"
            ? { title: settings.title, memory_ids: [], highlights: [] }
            : settings,
      },
    ];
    return true;
  }
  const thread = data.planning_threads.find((t) => t.id === p.thread_id);
  if (kind === "council") {
    if (
      !thread ||
      (thread.owner_id !== viewer && !thread.coowner_ids.includes(viewer)) ||
      !canReadPlanningThread(data, thread, viewer)
    )
      throw new Error("Council unavailable.");
    const decision = {
      id: thread.id,
      owner_id: thread.owner_id,
      audience: thread.audience,
      audience_id: thread.audience_id,
    } as Activity;
    requirePremiumFeature(data, toolFeature(kind, settings), decision);
  } else {
    if (
      !activity ||
      !(kind === "memories"
        ? canCurate(data, activity, viewer)
        : canManageBeacon(data, activity, viewer))
    )
      throw new Error(
        "Only current Beacon organizers can configure this tool.",
      );
    requirePremiumFeature(data, toolFeature(kind, settings), activity);
    if (
      kind === "memories" &&
      authorizedMemoryIds(data, settings.memory_ids ?? [], viewer).length !==
        (settings.memory_ids ?? []).length
    )
      throw new Error("Memory unavailable.");
  }
  const old = data.premium_tool_configs?.find(
    (t) =>
      t.kind === kind &&
      (kind === "council"
        ? t.thread_id === p.thread_id
        : t.activity_id === p.activity_id),
  );
  if (old && old.revision !== p.revision)
    throw new Error("This tool changed. Reopen its settings.");
  data.premium_tool_configs = [
    ...(data.premium_tool_configs ?? []).filter((t) => t.id !== old?.id),
    {
      id: old?.id ?? newId(),
      activity_id: activity?.id ?? null,
      thread_id: thread?.id ?? null,
      kind,
      settings,
      revision: (old?.revision ?? -1) + 1,
    },
  ];
  return true;
}
export function canStartAdvancedFocus(
  data: Data,
  activity: Activity,
  settings: ToolSettings,
  viewer: string,
) {
  return (
    canUseBeaconModules(data, activity, viewer) &&
    resolvePremiumFeature(data, toolFeature("focus", settings), activity)
      .available
  );
}
