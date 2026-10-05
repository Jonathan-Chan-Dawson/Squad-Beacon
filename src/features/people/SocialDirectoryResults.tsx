import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Building2, Layers3, UsersRound } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import type { SocialDirectorySummary, SocialEntityType } from "@/src/features/social/types";
import { Action, Button, Empty, Txt, useTheme } from "@/src/shared/ui";
import { ProfilePreviewFrame } from "@/src/features/people/previews/ProfilePreviewFrame";

const PAGE_SIZE = 20;
type ResultSet = {
  key: string;
  rows: SocialDirectorySummary[];
  hasMore: boolean;
  error: boolean;
};

const entityTitle: Record<SocialEntityType, string> = {
  organization: "Organizations",
  space: "Spaces",
  squad: "Squads",
};
const entitySingular: Record<SocialEntityType, string> = {
  organization: "Organization",
  space: "Space",
  squad: "Squad",
};

/** Authenticated, paged search results. The result payload is a sanitized summary, never a roster. */
export function SocialDirectoryResults({
  query,
  entityType = "all",
  parentType,
  parentId,
  explore = false,
  onOpenSquad,
  onOpenSpace,
  onOpenOrganization,
}: {
  query: string;
  entityType?: "all" | SocialEntityType;
  parentType?: "space" | "organization";
  parentId?: string;
  explore?: boolean;
  onOpenSquad: (id: string) => void;
  onOpenSpace: (id: string) => void;
  onOpenOrganization: (id: string) => void;
}) {
  const { data, userId, act, searchDirectory } = useBeacon();
  const { styles, colors } = useTheme();
  const [revision, setRevision] = useState(0);
  const [loadingMoreFor, setLoadingMoreFor] = useState<string | null>(null);
  const [loadMoreErrorFor, setLoadMoreErrorFor] = useState<string | null>(null);
  const [result, setResult] = useState<ResultSet | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<{
    key: string;
    row: SocialDirectorySummary;
  } | null>(null);
  const generation = useRef(0);
  const normalizedQuery = query.trim();
  const permissionSnapshot = JSON.stringify({
    squads: data.squads.map(({ id, owner_id, discoverability, join_mode, archived_at }) => [id, owner_id, discoverability, join_mode, archived_at]),
    spaces: data.spaces.map(({ id, owner_id, discoverability, join_mode, archived_at }) => [id, owner_id, discoverability, join_mode, archived_at]),
    organizations: data.organizations.map(({ id, owner_id, discoverability, join_mode, archived_at }) => [id, owner_id, discoverability, join_mode, archived_at]),
    squadMembers: data.squad_members.map(({ squad_id, user_id, role }) => [squad_id, user_id, role]),
    spaceMembers: data.space_members.map(({ space_id, user_id, status, role }) => [space_id, user_id, status, role]),
    organizationMembers: data.organization_members.map(({ organization_id, user_id, status, role }) => [organization_id, user_id, status, role]),
    blocks: data.blocks.map(({ blocker_id, blocked_id }) => [blocker_id, blocked_id]),
    bans: data.squad_bans.map(({ squad_id, user_id }) => [squad_id, user_id]),
    spaceBans: data.space_bans.map(({ space_id, user_id }) => [space_id, user_id]),
    organizationBans: data.organization_bans.map(({ organization_id, user_id }) => [organization_id, user_id]),
    organizationSpaces: data.organization_spaces.map(({ organization_id, space_id }) => [organization_id, space_id]),
    spaceSquads: data.space_squads.map(({ space_id, squad_id }) => [space_id, squad_id]),
    organizationSquads: data.organization_squads.map(({ organization_id, squad_id }) => [organization_id, squad_id]),
    squadInvites: data.squad_invites.map(({ id, squad_id, recipient_id }) => [id, squad_id, recipient_id]),
    squadJoinRequests: data.squad_join_requests.map(({ squad_id, user_id }) => [squad_id, user_id]),
  });
  const key = `${userId ?? "signed-out"}|${data.viewer_id ?? "no-snapshot"}|${permissionSnapshot}|${normalizedQuery}|${entityType}|${parentType ?? ""}|${parentId ?? ""}|${revision}`;

  useEffect(() => {
    const requestId = ++generation.current;
    let current = true;
    void searchDirectory({
      query: normalizedQuery,
      entityType,
      pageSize: PAGE_SIZE,
      pageOffset: 0,
      ...(parentType && parentId ? { parentType, parentId } : {}),
    }).then((rows) => {
      if (!current || generation.current !== requestId) return;
      setResult({ key, rows, hasMore: rows.length === PAGE_SIZE, error: false });
    }).catch(() => {
      if (!current || generation.current !== requestId) return;
      setResult({ key, rows: [], hasMore: false, error: true });
    });
    return () => {
      current = false;
      if (generation.current === requestId) generation.current += 1;
    };
  }, [entityType, key, normalizedQuery, parentId, parentType, searchDirectory]);

  const current = result?.key === key ? result : null;
  const loadingMore = loadingMoreFor === key;
  const selected = selectedSummary?.key === key ? selectedSummary.row : null;
  const rows = (current?.rows ?? []).filter((row) =>
    !explore || (row.action !== "joined" && row.action !== "invited" && row.action !== "requested"),
  );

  async function loadMore() {
    if (!current || !current.hasMore || loadingMore) return;
    const requestId = generation.current;
    setLoadingMoreFor(key);
    setLoadMoreErrorFor(null);
    try {
      const next = await searchDirectory({
        query: normalizedQuery,
        entityType,
        pageSize: PAGE_SIZE,
        pageOffset: current.rows.length,
        ...(parentType && parentId ? { parentType, parentId } : {}),
      });
      if (generation.current !== requestId) return;
      setResult((previous) => previous?.key === key
        ? {
            ...previous,
            rows: [...previous.rows, ...next],
            hasMore: next.length === PAGE_SIZE,
          }
        : previous,
      );
    } catch {
      if (generation.current === requestId) setLoadMoreErrorFor(key);
    } finally {
      if (generation.current === requestId) setLoadingMoreFor(null);
    }
  }

  function openRow(row: SocialDirectorySummary) {
    if (row.action !== "joined") {
      setSelectedSummary({ key, row });
      return;
    }
    if (row.entity_type === "organization") onOpenOrganization(row.entity_id);
    else if (row.entity_type === "space") onOpenSpace(row.entity_id);
    else onOpenSquad(row.entity_id);
  }

  async function performAction(row: SocialDirectorySummary) {
    if (!userId || data.viewer_id !== userId) return;
    const id = row.entity_id;
    if (row.action === "join") {
      if (row.entity_type === "organization") await act("join_organization", { organization_id: id });
      else if (row.entity_type === "space") await act("join_space", { space_id: id });
      else await act("join_squad", { squad_id: id });
    } else if (row.action === "request") {
      if (row.entity_type === "organization") await act("request_organization_join", { organization_id: id });
      else if (row.entity_type === "space") await act("request_space_join", { space_id: id });
      else await act("request_squad_join", { squad_id: id });
    } else if (row.action === "requested") {
      if (row.entity_type === "organization") await act("cancel_organization_join_request", { organization_id: id });
      else if (row.entity_type === "space") await act("cancel_space_join_request", { space_id: id });
      else await act("cancel_squad_join_request", { squad_id: id });
    } else if (row.action === "invited") {
      if (row.entity_type === "organization") {
        await act("respond_organization_invite", { organization_id: id, accept: true });
      } else if (row.entity_type === "space") {
        await act("respond_space_invite", { space_id: id, accept: true });
      } else {
        const invitation = data.squad_invites.find(
          (invite) => invite.squad_id === id && invite.recipient_id === userId,
        );
        if (!invitation) return;
        await act("accept_squad", { id: invitation.id });
      }
    } else {
      return;
    }
    setRevision((value) => value + 1);
  }

  const groups = (["organization", "space", "squad"] as const)
    .map((type) => ({ type, rows: rows.filter((row) => row.entity_type === type) }))
    .filter((group) => group.rows.length > 0);

  return (
    <View style={{ gap: 10 }}>
      {normalizedQuery.length === 1 ? (
        <Txt muted>Enter at least two characters to search communities.</Txt>
      ) : !current ? (
        <Txt muted>{explore ? "Loading discoverable communities…" : "Searching communities…"}</Txt>
      ) : current.error ? (
        <Empty title="Couldn’t load communities" body="Try the search again in a moment." />
      ) : !groups.length ? (
        <Empty
          title={explore ? "Nothing to discover yet" : "No matching communities"}
          body={explore ? "Eligible public and parent-community results will appear here." : "Try another name or description."}
        />
      ) : (
        groups.map(({ type, rows: groupRows }) => {
          const Icon = type === "organization" ? Building2 : type === "space" ? Layers3 : UsersRound;
          return (
            <View key={type} style={{ gap: 7 }}>
              <Text style={styles.label}>{entityTitle[type].toUpperCase()}</Text>
              {groupRows.map((row) => {
                const actionTitle = row.action === "join"
                  ? "Join"
                  : row.action === "request"
                    ? "Request"
                    : row.action === "requested"
                      ? "Cancel request"
                      : row.action === "invited"
                        ? "Accept invite"
                        : null;
                const canAcceptSquadInvite = row.entity_type !== "squad" || data.squad_invites.some(
                  (invite) => invite.squad_id === row.entity_id && invite.recipient_id === userId,
                );
                const parent = row.parent_name
                  ? `${row.parent_type === "organization" ? "Inside" : "In"} ${row.parent_name}`
                  : null;
                const children = row.child_count > 0
                  ? `${row.child_count} ${row.entity_type === "space" ? "Squads" : "communities"}`
                  : null;
                const subtitle = [
                  entitySingular[type],
                  `${row.member_count.toLocaleString()} ${row.member_count === 1 ? "member" : "members"}`,
                  children,
                  parent,
                ].filter(Boolean).join(" · ");
                return (
                  <View key={`${row.entity_type}:${row.entity_id}`} style={[styles.card, { padding: 10, gap: 6 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}>
                        <Icon size={19} color={colors.green} />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Preview ${entitySingular[type]} ${row.name}`}
                        onPress={() => openRow(row)}
                        style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", gap: 2 }}
                      >
                        <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{row.name}</Text>
                        <Text numberOfLines={1} style={styles.muted}>{subtitle}</Text>
                      </Pressable>
                    </View>
                    {row.description ? <Text numberOfLines={2} style={styles.muted}>{row.description}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      {actionTitle && canAcceptSquadInvite ? (
                        <Action compact title={actionTitle} run={() => performAction(row)} />
                      ) : row.action === "invite_required" ? (
                        <Text style={styles.muted}>Invite required</Text>
                      ) : row.action === "invited" ? (
                        <Text style={styles.muted}>Invitation pending</Text>
                      ) : row.action === "requested" ? (
                        <Text style={styles.muted}>Request pending</Text>
                      ) : row.action === "joined" ? (
                        <Text style={styles.muted}>Joined</Text>
                      ) : null}
                      <Button compact secondary title="Preview" onPress={() => openRow(row)} />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })
      )}
      {current?.hasMore && (
        <View style={{ gap: 6 }}>
          {loadMoreErrorFor === key ? <Txt muted>Couldn’t load more results. You can try again.</Txt> : null}
          <Button compact secondary title={loadingMore ? "Loading…" : loadMoreErrorFor === key ? "Try again" : "Load more"} disabled={loadingMore} onPress={loadMore} />
        </View>
      )}
      <ProfilePreviewFrame
        title="Community preview"
        visible={!!selected}
        onClose={() => setSelectedSummary(null)}
        renderBeaconPreview={(_, onBack) => (
          <View style={{ gap: 10 }}>
            <Empty title="Beacon unavailable" body="This summary does not include private activity details." />
            <Button secondary title="Back to community" onPress={onBack} />
          </View>
        )}
      >
        {() => selected ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.h2}>{selected.name}</Text>
            <Text style={styles.label}>{entitySingular[selected.entity_type].toUpperCase()}</Text>
            <Text style={styles.body}>
              {selected.member_count.toLocaleString()} {selected.member_count === 1 ? "member" : "members"}
              {selected.child_count > 0
                ? ` · ${selected.child_count} ${selected.entity_type === "space" ? "Squads" : "communities"}`
                : ""}
            </Text>
            {!!selected.parent_name && <Text style={styles.muted}>In {selected.parent_name}</Text>}
            {!!selected.description && <Txt>{selected.description}</Txt>}
            {selected.action === "joined" ? (
              <Button
                title="Open community profile"
                onPress={() => {
                  openRow(selected);
                  setSelectedSummary(null);
                }}
              />
            ) : selected.action === "invite_required" ? (
              <Txt muted>An invitation is required to join this community.</Txt>
            ) : selected.action === "invited" && selected.entity_type === "squad" &&
              !data.squad_invites.some((invite) => invite.squad_id === selected.entity_id && invite.recipient_id === userId) ? (
              <Txt muted>The Squad invitation is no longer available.</Txt>
            ) : (
              <Action
                title={selected.action === "join" ? "Join now" : selected.action === "request" ? "Request to join" : selected.action === "requested" ? "Cancel join request" : "Accept invitation"}
                run={async () => {
                  await performAction(selected);
                  setSelectedSummary(null);
                }}
              />
            )}
          </View>
        ) : null}
      </ProfilePreviewFrame>
    </View>
  );
}
