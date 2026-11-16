import { BeaconActionRow } from "./BeaconSection";
import { useConfirmation } from "@/src/shared/Dialogs";
import { canViewProfile } from "@/src/features/profile/privacy";
import { Images, Image as ImageIcon, Star } from "lucide-react-native";
import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  Chips,
  Field,
  IconButton,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import type { Activity } from "@/src/shared/types";
import { beaconRoleFor } from "../permissions";
import { authorizedMemoryIds } from "../premiumTools";
import { signedBeaconMediaUrl } from "../beaconMedia";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
export function MemoryCollections({
  activity,
  onFilter,
}: {
  activity: Activity;
  onFilter: (ids: string[] | null) => void;
}) {
  const { data, userId, act } = useBeacon();
  const { colors } = useTheme();
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [filter, setFilter] = useState("All memories");
  const [layout, setLayout] = useState<"album" | "timeline" | "story">("album");
  const [participants, setParticipants] = useState<string[]>([]);
  const [recapLimit, setRecapLimit] = useState(10);
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("Album"),
    [title, setTitle] = useState(""),
    [intro, setIntro] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [highlights, setHighlights] = useState<string[]>([]),
    [limit, setLimit] = useState(8),
    [editing, setEditing] = useState<string | null>(null),
    [revision, setRevision] = useState(-1);
  if (!userId || !(data.is_demo || data.capabilities?.advanced_beacon_tools))
    return null;
  const manager =
    activity.status !== "cancelled" &&
    ["owner", "coowner", "admin"].includes(
      beaconRoleFor(data, activity, userId),
    );
  const plus = resolvePremiumFeature(
      data,
      "memory_collections",
      activity,
    ).available,
    pro = resolvePremiumFeature(data, "afterglow", activity).available;
  const album = data.premium_tool_configs?.find(
    (t) => t.activity_id === activity.id && t.kind === "memories",
  );
  const allowed = authorizedMemoryIds(
    data,
    data.beacon_memories
      .filter((m) => mode === "Afterglow" || m.activity_id === activity.id)
      .map((m) => m.id),
    userId,
  );
  const choices = data.beacon_memories.filter(
    (m) =>
      allowed.includes(m.id) &&
      `${m.caption} ${data.activities.find((a) => a.id === m.activity_id)?.title ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const recaps = (data.memory_recaps ?? []).filter(
    (r) => r.activity_id === activity.id,
  );
  const expansion = data.is_demo || data.capabilities?.beacon_stories;
  const consent =
    data.recap_consents?.find(
      (c) => c.activity_id === activity.id && c.user_id === userId,
    )?.allowed === true;
  const consenting = (data.recap_consents ?? []).filter(
    (c) => c.activity_id === activity.id && c.allowed,
  );
  const personName = (id: string) => {
    const p = data.profiles.find((p) => p.id === id);
    return p && canViewProfile(data, p, userId)
      ? p.name
      : "Consenting participant";
  };
  const begin = () => {
    setOpen(!open);
    setEditing(null);
    setMode("Album");
    setTitle(album?.settings.title ?? "");
    setSelected(album?.settings.memory_ids ?? []);
    setHighlights(album?.settings.highlights ?? []);
    setRevision(album?.revision ?? -1);
  };
  return (
    <View style={{ gap: 16 }}>
      {confirmationDialog}
      {expansion && (
        <Action
          secondary
          title={
            consent
              ? "Remove my recap consent"
              : "Allow my name in activity recaps"
          }
          run={() =>
            act("set_recap_consent", {
              activity_id: activity.id,
              allowed: !consent,
            })
          }
        />
      )}
      {album && (
        <>
          <Txt>{album.settings.title || "Album"}</Txt>
          <Chips
            options={["All memories", "Album", "Highlights"]}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              onFilter(
                v === "All memories"
                  ? null
                  : authorizedMemoryIds(
                      data,
                      v === "Album"
                        ? (album.settings.memory_ids ?? [])
                        : (album.settings.highlights ?? []),
                      userId,
                    ),
              );
            }}
          />
        </>
      )}
      {manager && (
        <PlanChoice
          title="Create album or recap"
          detail="Collect photos and build a recap"
          icon={Images}
          expanded={open}
          onPress={begin}
        />
      )}
      {open && (
        <View style={{ gap: 10 }}>
          {!plus && <PremiumPreview />}
          {plus && (
            <>
              {pro && (
                <Chips
                  options={["Album", "Afterglow"]}
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    setEditing(null);
                    setRevision(v === "Album" ? (album?.revision ?? -1) : -1);
                    setSelected([]);
                    setHighlights([]);
                    setLayout("album");
                    setParticipants([]);
                  }}
                />
              )}
              {mode === "Afterglow" && (
                <Chips
                  options={["A day together", "Small moments"]}
                  value={
                    title === "Small moments"
                      ? "Small moments"
                      : "A day together"
                  }
                  onChange={setTitle}
                />
              )}
              {mode === "Afterglow" && expansion && (
                <>
                  <Chips
                    options={["Album", "Timeline", "Story"] as const}
                    value={
                      layout === "timeline"
                        ? "Timeline"
                        : layout === "story"
                          ? "Story"
                          : "Album"
                    }
                    onChange={(v) =>
                      setLayout(
                        v === "Timeline"
                          ? "timeline"
                          : v === "Story"
                            ? "story"
                            : "album",
                      )
                    }
                    accessibilityPrefix="Recap layout"
                  />
                  <Txt muted>
                    Optional participant credits · consent can be withdrawn at
                    any time
                  </Txt>
                  {consenting.map((c) => (
                    <Button
                      key={c.user_id}
                      secondary
                      title={`${participants.includes(c.user_id) ? "Remove credit for" : "Credit"} ${personName(c.user_id)}`}
                      onPress={() =>
                        setParticipants((ids) =>
                          ids.includes(c.user_id)
                            ? ids.filter((id) => id !== c.user_id)
                            : [...ids, c.user_id],
                        )
                      }
                    />
                  ))}
                </>
              )}
              <Field
                label={mode === "Album" ? "Album title" : "Recap title"}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
              {mode === "Afterglow" && (
                <Field
                  label="Introduction · optional"
                  value={intro}
                  onChangeText={setIntro}
                  maxLength={1000}
                  multiline
                />
              )}
              <Field
                label="Find authorized memories"
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setLimit(8);
                }}
              />
              {choices.slice(0, limit).map((m) => {
                const included = selected.includes(m.id);
                const featured = highlights.includes(m.id);
                const beaconTitle = data.activities.find(
                  (a) => a.id === m.activity_id,
                )?.title;
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <PlanChoice
                        title={m.caption || beaconTitle || "Memory"}
                        detail={
                          m.caption && beaconTitle
                            ? beaconTitle
                            : "Memory from this collection"
                        }
                        icon={ImageIcon}
                        selected={included}
                        onPress={() =>
                          setSelected((ids) =>
                            included
                              ? ids.filter((id) => id !== m.id)
                              : [...ids, m.id],
                          )
                        }
                      />
                    </View>
                    {mode === "Album" && included && (
                      <IconButton
                        label={
                          featured ? "Remove highlight" : "Feature highlight"
                        }
                        selected={featured}
                        onPress={() =>
                          setHighlights((ids) =>
                            featured
                              ? ids.filter((id) => id !== m.id)
                              : [...ids, m.id],
                          )
                        }
                      >
                        <Star
                          size={18}
                          color={colors.primary}
                          fill={featured ? colors.primary : "none"}
                        />
                      </IconButton>
                    )}
                  </View>
                );
              })}
              {choices.length > limit && (
                <Button
                  compact
                  secondary
                  title="Show more memories"
                  onPress={() => setLimit((n) => n + 8)}
                />
              )}
              <Action
                title={mode === "Album" ? "Save album" : "Save recap"}
                run={async () => {
                  if (mode === "Album")
                    await act("save_tool_config", {
                      activity_id: activity.id,
                      kind: "memories",
                      settings: {
                        title,
                        memory_ids: selected,
                        highlights: highlights.filter((id) =>
                          selected.includes(id),
                        ),
                      },
                      revision,
                    });
                  else
                    await act("save_memory_recap", {
                      id: editing ?? randomUUID(),
                      activity_id: activity.id,
                      title,
                      introduction: intro,
                      ...(expansion
                        ? { layout, participant_ids: participants }
                        : {}),
                      memory_ids: selected,
                      revision,
                    });
                  setOpen(false);
                }}
              />
            </>
          )}
        </View>
      )}
      {recaps.map((r) => (
        <View key={r.id} style={{ gap: 8 }}>
          <Txt>{r.title}</Txt>
          {r.introduction && <Txt muted>{r.introduction}</Txt>}
          {!!r.participant_ids?.some((id) =>
            consenting.some((c) => c.user_id === id),
          ) && (
            <Txt muted>
              With{" "}
              {r.participant_ids
                .filter((id) => consenting.some((c) => c.user_id === id))
                .map(personName)
                .join(", ")}
            </Txt>
          )}
          {authorizedMemoryIds(data, r.memory_ids, userId)
            .sort((a, b) =>
              r.layout === "timeline"
                ? (
                    data.beacon_memories.find((m) => m.id === a)?.created_at ??
                    ""
                  ).localeCompare(
                    data.beacon_memories.find((m) => m.id === b)?.created_at ??
                      "",
                  )
                : 0,
            )
            .slice(0, recapLimit)
            .map((id) => (
              <RecapMemory key={id} id={id} layout={r.layout} />
            ))}
          {r.memory_ids.length > recapLimit && (
            <Button
              secondary
              title={`Show more of ${r.title}`}
              onPress={() => setRecapLimit((n) => n + 10)}
            />
          )}
          {manager && (
            <BeaconActionRow>
              <Button
                compact
                secondary
                title={`Edit ${r.title}`}
                onPress={() => {
                  setOpen(true);
                  setMode("Afterglow");
                  setEditing(r.id);
                  setRevision(r.revision);
                  setTitle(r.title);
                  setIntro(r.introduction);
                  setLayout(r.layout ?? "album");
                  setParticipants(
                    (r.participant_ids ?? []).filter((id) =>
                      consenting.some((c) => c.user_id === id),
                    ),
                  );
                  setSelected(r.memory_ids);
                }}
              />
              <Action
                secondary
                title="Remove recap"
                compact
                run={async () =>
                  requestConfirmation({
                    title: "Remove recap?",
                    message: "The original memories will be kept.",
                    confirmLabel: "Remove recap",
                    destructive: true,
                    onConfirm: () => act("delete_memory_recap", { id: r.id }),
                  })
                }
              />
            </BeaconActionRow>
          )}
        </View>
      ))}
    </View>
  );
}
function RecapMemory({
  id,
  layout,
}: {
  id: string;
  layout?: "album" | "timeline" | "story";
}) {
  const { data, userId } = useBeacon();
  const [url, setUrl] = useState<string | null>(null);
  const memory = data.beacon_memories.find((m) => m.id === id);
  const allowed =
    !!userId && authorizedMemoryIds(data, [id], userId).length === 1;
  useEffect(() => {
    let alive = true;
    if (!allowed || !memory || memory.object_path.startsWith("demo://")) return;
    void signedBeaconMediaUrl(memory.object_path)
      .then((value) => {
        if (alive) setUrl(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [allowed, memory]);
  if (!allowed || !memory) return null;
  return (
    <View style={{ gap: 4 }}>
      {url && memory.media_type === "image" && (
        <Image
          source={{ uri: url }}
          accessibilityLabel={memory.caption || "Activity memory"}
          style={{
            width: "100%",
            height:
              layout === "story" ? 280 : layout === "timeline" ? 140 : 180,
            borderRadius: 12,
          }}
        />
      )}
      {layout === "timeline" && (
        <Txt muted>{new Date(memory.created_at).toLocaleString()}</Txt>
      )}
      <Txt muted>{memory.caption || "A shared memory"}</Txt>
    </View>
  );
}
