import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, ChevronRight, Layers3, UsersRound } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { matchesSearch } from "@/src/shared/search";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import { SocialPolicyFields, type SocialPolicyValue } from "@/src/features/social/SocialPolicyControls";
import {
  Action,
  Button,
  Empty,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { activeSpaceRole, canReadSpace, visibleSpaceSquads } from "./domain";
import { SpaceProfilePreview } from "./SpaceProfilePreview";

export function SpacesDirectory({
  query = "",
  showHeader = true,
  createOpen: controlledCreateOpen,
  onCreateOpenChange,
  onOpen,
  hideWhenEmpty = false,
}: {
  query?: string;
  showHeader?: boolean;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  onOpen?: (id: string) => void;
  hideWhenEmpty?: boolean;
}) {
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const [previewSpaceId, setPreviewSpaceId] = useState<string | null>(null);
  const createOpen = controlledCreateOpen ?? localCreateOpen;
  const setCreateOpen = onCreateOpenChange ?? setLocalCreateOpen;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupExistingSquads, setGroupExistingSquads] = useState(false);
  const [selectedSquadIds, setSelectedSquadIds] = useState<string[]>([]);
  const [policy, setPolicy] = useState<SocialPolicyValue>({
    discoverability: "private",
    join_mode: "invite",
    invite_policy: "admins",
  });
  const manageableSquads = data.squads
    .filter((squad) => {
      if (!userId || data.viewer_id !== userId || !canOpenSquadProfile(data, squad.id, userId)) return false;
      const role = data.squad_members.find(
        (member) => member.squad_id === squad.id && member.user_id === userId,
      )?.role;
      return !!role && SOCIAL_ROLE_RANK[role] >= SOCIAL_ROLE_RANK.admin;
    })
    .sort((first, second) => first.name.localeCompare(second.name));
  const spaces = data.spaces.filter(
    (space) =>
      canReadSpace(data, space.id, userId) &&
      !!userId &&
      !!activeSpaceRole(space, data.space_members, userId) &&
      matchesSearch(query, space.name, space.description),
  );
  const invitations = data.space_members
    .filter(
      (member) =>
        data.viewer_id === userId &&
        member.user_id === userId &&
        member.status === "invited",
    )
    .flatMap((member) => {
      const space = data.spaces.find((item) => item.id === member.space_id);
      if (
        !space ||
        !matchesSearch(query, space.name, space.description) ||
        data.blocks.some(
          (block) =>
            (block.blocker_id === userId &&
              block.blocked_id === space.owner_id) ||
            (block.blocker_id === space.owner_id &&
              block.blocked_id === userId),
        )
      )
        return [];
      return [space];
    });
  const open = (id: string) =>
    onOpen
      ? onOpen(id)
      : setPreviewSpaceId(id);
  function closeCreate() {
    setCreateOpen(false);
    setGroupExistingSquads(false);
    setSelectedSquadIds([]);
    setName("");
    setDescription("");
    setPolicy({ discoverability: "private", join_mode: "invite", invite_policy: "admins" });
  }
  return (
    <View style={{ gap: 10 }}>
      {showHeader && (
        <View style={styles.between}>
          <Text style={styles.h2}>Spaces</Text>
          <Button
            compact
            secondary
            title="Create Space"
            onPress={() => setCreateOpen(true)}
          />
        </View>
      )}
      {invitations.map((space) => (
        <View key={space.id} style={[styles.card, { padding: 12, gap: 8 }]}>
          <Text style={styles.body}>{space.name}</Text>
          <Txt muted>You’re invited to this Space.</Txt>
          <View style={styles.row}>
            <Action
              compact
              title="Join Space"
              run={() =>
                act("respond_space_invite", {
                  space_id: space.id,
                  accept: true,
                })
              }
            />
            <Action
              compact
              secondary
              title="Decline"
              run={() =>
                act("respond_space_invite", {
                  space_id: space.id,
                  accept: false,
                })
              }
            />
          </View>
        </View>
      ))}
      {spaces.map((space) => {
        const squads = visibleSpaceSquads(data, space.id, userId);
        const count = data.space_members.filter(
          (member) =>
            member.space_id === space.id && member.status === "active",
        ).length;
        return (
          <Pressable
            key={space.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview Space ${space.name}`}
            onPress={() => open(space.id)}
            style={({ pressed }) => [
              styles.card,
              {
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.lime,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers3 size={21} color={colors.green} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text
                style={[styles.body, { fontWeight: "700" }]}
                numberOfLines={1}
              >
                {space.name}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {space.description || "A shared home for your Squads"}
              </Text>
              <Text style={styles.label}>
                {count} {count === 1 ? "person" : "people"} · {squads.length}{" "}
                {squads.length === 1 ? "Squad" : "Squads"} you can open
              </Text>
            </View>
            <ChevronRight size={17} color={colors.muted} />
          </Pressable>
        );
      })}
      {!hideWhenEmpty && !spaces.length && !invitations.length && (
        <Empty
          title={
            query.trim()
              ? "No matching Spaces"
              : "Give your Squads a shared home"
          }
          body={
            query.trim()
              ? "Try another name."
              : "A Space gathers Squads without the setup of an Organization. Start small and add people when you’re ready."
          }
        />
      )}
      <Sheet
        title="Create a Space"
        visible={createOpen}
        onClose={closeCreate}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button compact secondary={groupExistingSquads} title="Start a Space" onPress={() => setGroupExistingSquads(false)} />
          <Button compact secondary={!groupExistingSquads} title="Group Squads" onPress={() => setGroupExistingSquads(true)} />
        </View>
        <Txt muted>
          {groupExistingSquads
            ? "Choose existing Squads you manage. This creates a Space and links them; memberships, chat, and Beacon access stay separate."
            : "A lightweight home for Squads. No Organization needed. You can add people and connect Squads later."}
        </Txt>
        {groupExistingSquads ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>SQUADS YOU CAN MANAGE · UP TO 20</Text>
            {!manageableSquads.length ? (
              <Empty title="No manageable Squads" body="You need active admin access to group a Squad in a new Space." />
            ) : manageableSquads.map((squad) => {
              const selected = selectedSquadIds.includes(squad.id);
              const disabled = !selected && selectedSquadIds.length >= 20;
              return (
                <Pressable
                  key={squad.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Select Squad ${squad.name}`}
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => setSelectedSquadIds((previous) => selected
                    ? previous.filter((id) => id !== squad.id)
                    : [...previous, squad.id],
                  )}
                  style={[styles.row, { minHeight: 48, paddingHorizontal: 9, borderWidth: 1, borderColor: selected ? colors.green : colors.line, borderRadius: 14, opacity: disabled ? 0.55 : 1 }]}
                >
                  <Check size={17} color={selected ? colors.green : colors.muted} />
                  <UsersRound size={17} color={colors.green} />
                  <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{squad.name}</Text>
                  <Text style={styles.muted}>
                    {data.squad_members.filter((member) => member.squad_id === squad.id).length}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.muted}>{selectedSquadIds.length} of 20 selected. Creating the Space does not copy or add any Squad members.</Text>
          </View>
        ) : null}
        <Field
          label="Space name"
          placeholder="Weekend circle"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Field
          label="A few words about it (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
        />
        <SocialPolicyFields value={policy} onChange={setPolicy} collapsible />
        <Action
          title="Create Space"
          run={async () => {
            if (!name.trim()) throw new Error("Give your Space a name.");
            if (groupExistingSquads && !selectedSquadIds.length) throw new Error("Choose at least one Squad.");
            const shouldOpenFullProfile = groupExistingSquads;
            const result = shouldOpenFullProfile
              ? await act("create_space_from_squads", {
                  name: name.trim(),
                  description: description.trim(),
                  squad_ids: selectedSquadIds,
                  ...policy,
                })
              : await act("create_space", {
                  name: name.trim(),
                  description: description.trim(),
                  ...policy,
                });
            closeCreate();
            const id =
              typeof result.space_id === "string"
                ? result.space_id
                : typeof result.id === "string"
                  ? result.id
                  : "";
            if (id && shouldOpenFullProfile) {
              setTimeout(() => router.push({ pathname: "/space/[id]", params: { id } }), 300);
            } else if (id) {
              open(id);
            }
          }}
        />
      </Sheet>
      {previewSpaceId && (
        <SpaceProfilePreview
          spaceId={previewSpaceId}
          visible
          onClose={() => setPreviewSpaceId(null)}
        />
      )}
    </View>
  );
}
