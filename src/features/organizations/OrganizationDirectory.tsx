import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight, Building2 } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { matchesSearch } from "@/src/shared/search";
import {
  Action,
  Button,
  Empty,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { activeOrganizationRole } from "./domain";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { OrganizationProfilePreview } from "./OrganizationProfilePreview";
import { SocialPolicyFields, type SocialPolicyValue } from "@/src/features/social/SocialPolicyControls";

export function OrganizationDirectory({
  onOpen,
  compact = false,
  query,
  showSearch = true,
  showHeader = true,
  createOpen: controlledCreateOpen,
  onCreateOpenChange,
}: {
  onOpen?: (organizationId: string) => void;
  compact?: boolean;
  query?: string;
  showSearch?: boolean;
  showHeader?: boolean;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}) {
  const { styles, colors } = useTheme();
  const { data, userId, act } = useBeacon();
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const [previewOrganizationId, setPreviewOrganizationId] = useState<string | null>(null);
  const createOpen = controlledCreateOpen ?? localCreateOpen;
  const setCreateOpen = onCreateOpenChange ?? setLocalCreateOpen;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [policy, setPolicy] = useState<SocialPolicyValue>({
    discoverability: "private",
    join_mode: "invite",
    invite_policy: "admins",
  });
  const [localSearch, setSearch] = useState("");
  const search = query ?? localSearch;
  const visibleOwner = (ownerId: string) =>
    !data.blocks.some(
      (block) =>
        (block.blocker_id === userId && block.blocked_id === ownerId) ||
        (block.blocker_id === ownerId && block.blocked_id === userId),
    );
  const pending = data.organization_members.filter(
    (member) =>
      data.viewer_id === userId &&
      member.user_id === userId &&
      member.status === "invited" &&
      data.organizations.some(
        (org) =>
          org.id === member.organization_id && visibleOwner(org.owner_id),
      ),
  );
  const organizations = data.organizations
    .filter(
      (organization) =>
        data.viewer_id === userId &&
        visibleOwner(organization.owner_id) &&
        !data.organization_bans.some(
          (ban) =>
            ban.organization_id === organization.id && ban.user_id === userId,
        ) &&
        (organization.owner_id === userId ||
          data.organization_members.some(
            (member) =>
              member.organization_id === organization.id &&
              member.user_id === userId &&
              member.status === "active",
          )),
    )
    .sort((first, second) => first.name.localeCompare(second.name));
  const visibleOrganizations = organizations.filter(
    (organization) =>
      !search.trim() ||
      matchesSearch(search, organization.name, organization.description),
  );
  const visiblePending = pending.filter((invitation) => {
    if (!search.trim()) return true;
    const organization = data.organizations.find(
      (item) => item.id === invitation.organization_id,
    );
    return (
      !!organization &&
      matchesSearch(
        search,
        organization.name,
        organization.description,
        invitation.role,
      )
    );
  });

  function openOrganization(organizationId: string) {
    if (onOpen) onOpen(organizationId);
    else setPreviewOrganizationId(organizationId);
  }

  return (
    <View style={{ gap: 12 }}>
      {showHeader && !compact && (
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.h2}>Organizations</Text>
            <Txt muted>Shared homes for the Squads you bring together.</Txt>
          </View>
          <Button
            compact
            title="+ Create"
            onPress={() => setCreateOpen(true)}
          />
        </View>
      )}
      {showHeader && compact && (
        <View style={styles.between}>
          <Text style={styles.h2}>Organizations</Text>
          <Button
            compact
            title="+ Create"
            onPress={() => setCreateOpen(true)}
          />
        </View>
      )}

      {showSearch && (
        <Field
          label="Search your organizations"
          placeholder="Name or description"
          value={search}
          onChangeText={setSearch}
        />
      )}

      {visiblePending.map((invitation) => {
        const organization = data.organizations.find(
          (item) => item.id === invitation.organization_id,
        );
        if (!organization) return null;
        return (
          <View key={invitation.organization_id} style={styles.card}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.h2}>{organization.name}</Text>
                <Txt muted>Invited as {invitation.role}</Txt>
              </View>
              <Building2 size={21} color={colors.green} />
            </View>
            <Txt muted>
              {organization.description ||
                "An organization invited you to join."}
            </Txt>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Action
                compact
                title="Accept"
                run={async () => {
                  await act("respond_organization_invite", {
                    organization_id: organization.id,
                    accept: true,
                  });
                  openOrganization(organization.id);
                }}
              />
              <Action
                compact
                secondary
                title="Decline"
                run={() =>
                  act("respond_organization_invite", {
                    organization_id: organization.id,
                    accept: false,
                  })
                }
              />
            </View>
          </View>
        );
      })}

      {visibleOrganizations.map((organization) => {
        const role = activeOrganizationRole(
          organization,
          data.organization_members,
          userId ?? "",
        );
        const memberCount =
          organization.member_count ??
          1 +
            data.organization_members.filter(
              (member) =>
                member.organization_id === organization.id &&
                member.status === "active" &&
                member.user_id !== organization.owner_id,
            ).length;
        const memberSquadIds = data.organization_squads
          .filter((link) => link.organization_id === organization.id)
          .filter((link) =>
            data.squad_members.some(
              (member) =>
                member.squad_id === link.squad_id && member.user_id === userId,
            ),
          )
          .map((link) => link.squad_id);
        const visibleSquadCount = data.squads.filter((squad) =>
          memberSquadIds.includes(squad.id),
        ).length;
        const visibleActivityCount = data.activities.filter(
          (activity) =>
            activity.status !== "cancelled" &&
            !!userId &&
            canReadBeaconActivity(data, activity, userId) &&
            activity.audience === "organization" &&
            activity.audience_id === organization.id,
        ).length;
        return (
          <Pressable
            key={organization.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${organization.name}`}
            onPress={() => openOrganization(organization.id)}
            style={({ pressed }) => [
              styles.card,
              {
                padding: 13,
                borderRadius: 17,
                opacity: pressed ? 0.78 : 1,
                gap: 8,
              },
            ]}
          >
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.h2}>{organization.name}</Text>
                <Text style={styles.muted}>
                  {memberCount.toLocaleString()} members
                  {role ? ` · ${role}` : ""}
                </Text>
              </View>
              <ArrowUpRight size={19} color={colors.green} />
            </View>
            {organization.description ? (
              <Text numberOfLines={2} style={styles.muted}>
                {organization.description}
              </Text>
            ) : null}
            <Text style={styles.muted}>
              {visibleSquadCount} Squads you belong to · {visibleActivityCount}{" "}
              activities visible
            </Text>
          </Pressable>
        );
      })}

      {!organizations.length && !pending.length ? (
        <Empty
          title="Your people, gathered together"
          body="Create an organization to connect several Squads and give everyone one shared place to coordinate."
        />
      ) : !visibleOrganizations.length && !visiblePending.length ? (
        <Empty
          title="No matches"
          body="Try another organization name or description."
        />
      ) : null}
      {compact && visibleOrganizations.length > 0 && (
        <Button
          secondary
          title="See all organizations"
          onPress={() => router.push("/organizations")}
        />
      )}

      <Sheet
        title="Create an organization"
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      >
        <Txt muted>
          Start with a name and short description. You can invite people and
          connect Squads next.
        </Txt>
        <Field
          label="Organization name"
          placeholder="Lakefront Collective"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Field
          label="Description"
          placeholder="What brings your people together?"
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
        />
        <SocialPolicyFields value={policy} onChange={setPolicy} collapsible />
        <Action
          title="Create organization"
          run={async () => {
            if (!name.trim())
              throw new Error("Give your organization a name first.");
            const result = await act("create_organization", {
              name: name.trim(),
              description: description.trim(),
              ...policy,
            });
            setCreateOpen(false);
            setPolicy({ discoverability: "private", join_mode: "invite", invite_policy: "admins" });
            const id =
              typeof result.organization_id === "string"
                ? result.organization_id
                : typeof result.id === "string"
                  ? result.id
                  : "";
            if (id) openOrganization(id);
          }}
        />
      </Sheet>
      {previewOrganizationId && (
        <OrganizationProfilePreview
          organizationId={previewOrganizationId}
          visible
          onClose={() => setPreviewOrganizationId(null)}
        />
      )}
    </View>
  );
}
