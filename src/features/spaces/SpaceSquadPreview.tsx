import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Empty, Txt, useTheme } from "@/src/shared/ui";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { performDirectoryAction } from "@/src/features/social/directoryActions";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import type { Data } from "@/src/shared/types";

const PAGE_SIZE = 20;

/** A bounded, safe preview of directly linked Squads that this viewer can access. */
export function SpaceSquadPreview({ spaceId }: { spaceId: string }) {
  const { data, userId, viewerEpoch, act, searchDirectory } = useBeacon();
  const { styles, colors } = useTheme();
  const [result, setResult] = useState<{
    key: string;
    snapshot: Data;
    userId: string | null;
    viewerEpoch: number;
    rows: SocialDirectorySummary[];
    error: boolean;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const generation = useRef(0);
  const liveContext = useRef({ data, userId, viewerEpoch });
  const key = `${spaceId}:${userId ?? ""}:${data.viewer_id ?? ""}:${viewerEpoch}`;
  useEffect(() => {
    liveContext.current = { data, userId, viewerEpoch };
  }, [data, userId, viewerEpoch]);

  const loadRows = useCallback(async (requestKey: string, request: number) => {
    const page = await searchDirectory({
      query: "",
      entityType: "squad",
      pageSize: PAGE_SIZE,
      pageOffset: 0,
      parentType: "space",
      parentId: spaceId,
    });
    if (request !== generation.current || requestKey !== key) return;
    const combined = new Map<string, SocialDirectorySummary>();
    if (userId && data.viewer_id === userId) {
      for (const link of data.space_squads.filter((item) => item.space_id === spaceId)) {
        const squad = data.squads.find((row) => row.id === link.squad_id);
        if (!squad || !canOpenSquadProfile(data, squad.id, userId)) continue;
        combined.set(squad.id, {
          entity_type: "squad",
          entity_id: squad.id,
          name: squad.name,
          description: squad.description,
          discoverability: squad.discoverability ?? "private",
          join_mode: squad.join_mode ?? "invite",
          member_count: 0,
          child_count: 0,
          membership_status: "active",
          action: "joined",
          parent_type: "space",
          parent_id: spaceId,
          parent_name: "",
        });
      }
    }
    for (const row of page) {
      if (row.entity_type === "squad") combined.set(row.entity_id, row);
    }
    const context = liveContext.current;
    if (context.data !== data || context.userId !== userId || context.viewerEpoch !== viewerEpoch) return;
    setResult({
      key: requestKey,
      snapshot: data,
      userId,
      viewerEpoch,
      rows: [...combined.values()]
        .sort((a, b) => Number(b.action === "joined") - Number(a.action === "joined") ||
          a.name.localeCompare(b.name) || a.entity_id.localeCompare(b.entity_id))
        .slice(0, 5),
      error: false,
    });
  }, [data, key, searchDirectory, spaceId, userId, viewerEpoch]);

  useEffect(() => {
    let active = true;
    const request = ++generation.current;
    void loadRows(key, request).catch(() => {
      if (active && request === generation.current) {
        setResult({ key, snapshot: data, userId, viewerEpoch, rows: [], error: true });
      }
    });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [data, key, loadRows, spaceId, userId, viewerEpoch]);

  async function takeAction(row: SocialDirectorySummary) {
    if (!userId || data.viewer_id !== userId || liveContext.current.data !== data ||
      liveContext.current.userId !== userId || liveContext.current.viewerEpoch !== viewerEpoch) return;
    const requestKey = key;
    const request = generation.current;
    setActionError("");
    try {
      await performDirectoryAction(row, data, userId, act);
    } catch (failure) {
      if (liveContext.current.data === data && liveContext.current.userId === userId &&
        liveContext.current.viewerEpoch === viewerEpoch) {
        setActionError(failure instanceof Error ? failure.message : "Could not update Squad membership.");
      }
      return;
    }
    if (request !== generation.current || requestKey !== key) return;
    try {
      await loadRows(requestKey, request);
    } catch {
      if (request === generation.current) {
        setResult({ key: requestKey, snapshot: data, userId, viewerEpoch, rows: [], error: true });
      }
    }
  }

  const current = result?.key === key && result.snapshot === data &&
    result.userId === userId && result.viewerEpoch === viewerEpoch ? result : null;
  const rows = current?.rows ?? [];
  if (!current) return <Txt muted>Loading accessible Squads…</Txt>;
  if (current?.error) return <Empty title="Squads are unavailable" body="Try opening the full directory again." />;
  if (!rows.length) return <Empty title="No accessible Squads yet" body="Linked Squads appear here when you can open them." />;

  return (
    <View style={{ gap: 7 }}>
      {actionError ? <Text accessibilityRole="alert">{actionError}</Text> : null}
      {rows.map((row) => (
        <View key={row.entity_id} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 9, padding: 9 }]}>
          <CommunityAvatar type="squad" size={36} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open Squad ${row.name}`}
            onPress={() => router.push({ pathname: "/squad/[id]", params: { id: row.entity_id } })}
            style={{ flex: 1, minHeight: 44, justifyContent: "center", gap: 2 }}
          >
            <Text style={[styles.body, { fontWeight: "700" }]}>{row.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>{row.description || "Linked Squad"}</Text>
          </Pressable>
          {row.action === "joined" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Message ${row.name}`}
              onPress={() => router.push({ pathname: "/squad-chat/[id]", params: { id: row.entity_id } })}
              style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <MessageCircle size={18} color={colors.green} />
            </Pressable>
          ) : row.action !== "invite_required" ? (
            <Action
              compact
              secondary
              title={row.action === "request" ? "Request" : row.action === "requested" ? "Cancel" : row.action === "invited" ? "Accept" : "Join"}
              run={() => takeAction(row)}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
