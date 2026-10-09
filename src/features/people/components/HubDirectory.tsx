import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Compass, Lock, ChevronDown, ChevronRight } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import type { SocialDirectorySummary, SocialEntityType } from "@/src/features/social/types";
import { canOpenSquadProfile } from "../squadProfile";
import { activeSpaceRole, canReadSpace } from "@/src/features/spaces/domain";
import { activeOrganizationRole, canReadOrganization } from "@/src/features/organizations/domain";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { EmptyState } from "@/src/shared/design-system";
import { SocialDirectorySummaryCard, SocialDirectorySummaryPreview } from "./SocialDirectorySummaryCard";

/** The server returns sanitized summaries. Hierarchy links grant no child access. */
export function HubDirectory({ query = "", entityType = "all", parentType, parentId, tree = false, explore = false, onOpen }: {
  query?: string; entityType?: "all" | SocialEntityType; parentType?: "space" | "organization"; parentId?: string;
  tree?: boolean; explore?: boolean; onOpen: (type: SocialEntityType, id: string) => void;
}) {
  const { data, userId, act, searchDirectory } = useBeacon();
  const { styles, colors } = useTheme();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: SocialDirectorySummary[]; error: boolean; hasMore: boolean } | null>(null);
  const [selected, setSelected] = useState<{ key: string; row: SocialDirectorySummary } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const key = JSON.stringify([userId, data.viewer_id, query.trim(), entityType, parentType, parentId, revision,
    data.squad_members, data.space_members, data.organization_members, data.squad_bans, data.space_bans,
    data.organization_bans, data.blocks, data.squad_invites, data.squad_join_requests,
    data.squads.map((row) => [row.id, row.owner_id, row.discoverability, row.join_mode, row.archived_at]),
    data.spaces.map((row) => [row.id, row.owner_id, row.discoverability, row.join_mode, row.archived_at]),
    data.organizations.map((row) => [row.id, row.owner_id, row.discoverability, row.join_mode, row.archived_at]),
    data.organization_spaces, data.space_squads, data.organization_squads]);
  useEffect(() => {
    const request = ++generation.current;
    let current = true;
    void searchDirectory({ query: query.trim(), entityType, pageSize: 20, pageOffset: 0,
      ...(parentType && parentId ? { parentType, parentId } : {}),
    }).then((rows) => {
      if (current && request === generation.current) setResult({ key, rows, error: false, hasMore: rows.length === 20 });
    }).catch(() => {
      if (current && request === generation.current) setResult({ key, rows: [], error: true, hasMore: false });
    });
    return () => { current = false; };
  }, [entityType, key, parentId, parentType, query, searchDirectory]);
  const current = result?.key === key ? result : null;
  const rows = (current?.rows ?? []).filter((row) => !explore || row.action !== "joined");

  function canOpen(row: SocialDirectorySummary) {
    if (!userId || data.viewer_id !== userId) return false;
    if (row.entity_type === "squad") return canOpenSquadProfile(data, row.entity_id, userId);
    if (row.entity_type === "space") {
      const space = data.spaces.find((item) => item.id === row.entity_id);
      return !!space && canReadSpace(data, space.id, userId) && !!activeSpaceRole(space, data.space_members, userId);
    }
    const org = data.organizations.find((item) => item.id === row.entity_id);
    return !!org && canReadOrganization(data, org.id, userId) && !!activeOrganizationRole(org, data.organization_members, userId);
  }
  function preview(row: SocialDirectorySummary) {
    if (canOpen(row)) onOpen(row.entity_type, row.entity_id);
    else setSelected({ key, row });
  }
  async function perform(row: SocialDirectorySummary): Promise<boolean> {
    if (!userId || data.viewer_id !== userId) throw new Error("Refresh communities before joining.");
    const id = row.entity_id;
    if (row.action === "joined") { preview(row); return true; }
    if (row.action === "join" || row.action === "request") {
      const request = row.action === "request";
      if (row.entity_type === "squad") await act(request ? "request_squad_join" : "join_squad", { squad_id: id });
      else if (row.entity_type === "space") await act(request ? "request_space_join" : "join_space", { space_id: id });
      else await act(request ? "request_organization_join" : "join_organization", { organization_id: id });
    } else if (row.action === "requested") {
      if (row.entity_type === "squad") await act("cancel_squad_join_request", { squad_id: id });
      else if (row.entity_type === "space") await act("cancel_space_join_request", { space_id: id });
      else await act("cancel_organization_join_request", { organization_id: id });
    } else if (row.action === "invited") {
      if (row.entity_type === "space") await act("respond_space_invite", { space_id: id, accept: true });
      else if (row.entity_type === "organization") await act("respond_organization_invite", { organization_id: id, accept: true });
      else {
        const invitation = data.squad_invites.find((item) => item.squad_id === id && item.recipient_id === userId);
        if (!invitation) throw new Error("Refresh your invitation before accepting.");
        await act("accept_squad", { id: invitation.id });
      }
    } else return false;
    setRevision((value) => value + 1);
    return true;
  }
  async function loadMore() {
    if (!current?.hasMore || lock.current) return;
    lock.current = true; setBusy(true); setMoreError(false);
    const request = generation.current;
    try {
      const next = await searchDirectory({ query: query.trim(), entityType, pageSize: 20, pageOffset: current.rows.length,
        ...(parentType && parentId ? { parentType, parentId } : {}) });
      if (request === generation.current) setResult((previous) => previous?.key === key ? { ...previous, rows: [...previous.rows, ...next], hasMore: next.length === 20 } : previous);
    } catch { if (request === generation.current) setMoreError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    {!current ? <Txt muted>Loading communities…</Txt> : current.error ? <View style={{ gap: 8 }}>
      <Txt muted>{"Couldn't load communities."}</Txt><Button secondary title="Try again" onPress={() => setRevision((value) => value + 1)} />
    </View> : !rows.length ? <EmptyState title={tree ? "No readable linked communities" : explore ? "Nothing to discover yet" : "No matching communities"}
      body={tree ? "Linked communities appear when their summaries are visible to you." : "Discoverable communities will appear here as they become available to you."}
      icon={<Compass color={colors.green} size={28} />} /> : <>
      {explore ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {rows.map((row) => <View key={`${row.entity_type}:${row.entity_id}`} style={{ width: 270 }}>
          <SocialDirectorySummaryCard summary={row} onPreview={() => preview(row)} onAction={() => perform(row)} />
        </View>)}
      </ScrollView> : null}
      {rows.map((row) => tree ? <View key={`${row.entity_type}:${row.entity_id}`} style={{ marginLeft: 10, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: colors.line, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 1, backgroundColor: colors.line, marginLeft: -14 }} />
          {row.entity_type === "squad" && !canOpen(row) ? <Lock size={15} color={colors.muted} accessibilityLabel="Separate Squad membership required" /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${row.name}`} onPress={() => preview(row)} style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
            <Text style={styles.body}>{row.name}</Text><Text style={styles.label}>{row.member_count} members · {row.entity_type}</Text>
          </Pressable>
          {row.entity_type === "space" && row.child_count > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${row.name}`} onPress={() => setExpanded((previous) => previous.includes(row.entity_id) ? previous.filter((id) => id !== row.entity_id) : [...previous, row.entity_id])} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            {expanded.includes(row.entity_id) ? <ChevronDown color={colors.green} size={19} /> : <ChevronRight color={colors.green} size={19} />}
          </Pressable> : null}
        </View>
        {row.entity_type === "space" && expanded.includes(row.entity_id) ? <HubDirectory parentType="space" parentId={row.entity_id} tree onOpen={onOpen} /> : null}
      </View> : <SocialDirectorySummaryCard key={`${row.entity_type}:${row.entity_id}`} summary={row} onPreview={() => preview(row)} onAction={() => perform(row)} />)}
      {moreError ? <Txt muted>{"Couldn't load more communities. Try again."}</Txt> : null}
      {current.hasMore ? <Button secondary title={busy ? "Loading…" : "Load more communities"} disabled={busy} onPress={() => { void loadMore(); }} /> : null}
    </>}
    <SocialDirectorySummaryPreview summary={selected?.key === key ? selected.row : null} visible={selected?.key === key} onClose={() => setSelected(null)} onAction={() => selected?.key === key ? perform(selected.row) : Promise.resolve(false)} />
  </View>;
}
