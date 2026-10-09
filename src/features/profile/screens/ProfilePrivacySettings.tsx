import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import type {
  Data,
  ID,
  Payload,
  ProfileVisibilityGrant,
} from "@/src/shared/types";
import {
  Action,
  Button,
  Field,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { SegmentedControl } from "@/src/shared/design-system";
import { activeOrganizationRole } from "@/src/features/organizations/domain";

type Visibility = "public" | "friends" | "custom";

function selectedTargets(grants: ProfileVisibilityGrant[], ownerId: ID) {
  return {
    organizations: grants
      .filter(
        (grant) => grant.owner_id === ownerId && grant.kind === "organization",
      )
      .map((grant) => grant.target_id),
    people: grants
      .filter((grant) => grant.owner_id === ownerId && grant.kind === "person")
      .map((grant) => grant.target_id),
    squads: grants
      .filter((grant) => grant.owner_id === ownerId && grant.kind === "squad")
      .map((grant) => grant.target_id),
    lists: grants
      .filter((grant) => grant.owner_id === ownerId && grant.kind === "list")
      .map((grant) => grant.target_id),
  };
}

function AudienceToggle({
  id,
  label,
  selected,
  onToggle,
  disabled = false,
}: {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      aria-checked={selected}
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.card,
        {
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          minHeight: 44,
          gap: 12,
          borderColor: selected ? colors.green : colors.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderWidth: 1,
          borderColor: selected ? colors.green : colors.line,
          borderRadius: 7,
          backgroundColor: selected ? colors.ink : colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <Text style={{ color: colors.white }}>✓</Text>}
      </View>
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  );
}

export default function ProfilePrivacySettings() {
  return <Screen title="Profile visibility" eyebrow="PRIVACY" create={false}>
    <ProfileVisibilityContent />
    <Button secondary title="Back to profile" onPress={() => router.back()} />
  </Screen>;
}

export function ProfileVisibilityContent({ onSaved }: { onSaved?: () => void }) {
  const { data, userId, act } = useBeacon();
  const profile = data.profiles.find((item) => item.id === userId);
  if (!profile || !userId || data.viewer_id !== userId)
    return (
      <Txt muted>Profile settings are unavailable.</Txt>
    );
  const saved = selectedTargets(data.profile_visibility_grants, userId ?? "");
  const savedSignature = JSON.stringify({
    userId,
    visibility: profile.profile_visibility ?? "public",
    people: saved.people.sort(),
    squads: saved.squads.sort(),
    lists: saved.lists.sort(),
    organizations: saved.organizations.sort(),
  });
  return (
    <ProfilePrivacyForm
      key={savedSignature}
      data={data}
      userId={userId}
      act={act}
      savedSignature={savedSignature}
      onSaved={onSaved}
    />
  );
}

function ProfilePrivacyForm({
  data,
  userId,
  act,
  savedSignature,
  onSaved,
}: {
  data: Data;
  userId: ID | null;
  act: (action: string, payload?: Payload) => Promise<Record<string, unknown>>;
  savedSignature: string;
  onSaved?: () => void;
}) {
  const { styles } = useTheme();
  const saved = JSON.parse(savedSignature) as {
    visibility: Visibility;
    people: string[];
    squads: string[];
    lists: string[];
    organizations: string[];
  };
  const [visibility, setVisibility] = useState<Visibility>(saved.visibility);
  const [people, setPeople] = useState<string[]>(saved.people);
  const [squads, setSquads] = useState<string[]>(saved.squads);
  const [lists, setLists] = useState<string[]>(saved.lists);
  const [organizations, setOrganizations] = useState<string[]>(
    saved.organizations ?? [],
  );
  const [peopleQuery, setPeopleQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const selectablePeople = data.profiles.filter(
    (person) =>
      person.id !== userId &&
      !data.blocks.some(
        (block) =>
          (block.blocker_id === userId && block.blocked_id === person.id) ||
          (block.blocker_id === person.id && block.blocked_id === userId),
      ),
  );
  const selectableSquads = data.squads.filter((squad) =>
    data.squad_members.some(
      (member) => member.squad_id === squad.id && member.user_id === userId,
    ),
  );
  const selectableLists = data.lists.filter((list) => list.owner_id === userId);
  const selectableOrganizations = data.organizations.filter(
    (org) =>
      !!userId &&
      !!activeOrganizationRole(org, data.organization_members, userId),
  );
  const visiblePeople = selectablePeople.filter((person) => {
    const query = peopleQuery.trim().toLowerCase();
    return (
      !query ||
      person.name.toLowerCase().includes(query) ||
      person.username.toLowerCase().includes(query)
    );
  });

  const toggle =
    (current: string[], setter: (next: string[]) => void) => (id: string) =>
      setter(
        current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id],
      );

  return (
    <View style={{ gap: 16 }} testID="profile-visibility-form">
      <View style={styles.card}>
        <Text style={styles.h2}>Who can see your full profile?</Text>
        <Txt muted>
          Your name may still appear in places you’re already allowed to use.
          This controls your bio, interests, aspirations, and other profile
          details.
        </Txt>
        <SegmentedControl
          options={[{ value: "public", label: "Public" }, { value: "friends", label: "Friends" }, { value: "custom", label: "Custom" }]}
          value={visibility}
          onChange={(value) => { if (!saving) setVisibility(value); }}
          accessibilityLabel="Full profile audience"
          testID="profile-visibility-segments"
        />
        <Txt muted>These grants control profile details only. They never grant Beacon access or share your location.</Txt>
        {visibility === "public" && (
          <Txt muted>
            People who can already find you in the app. This preserves the
            current relationship-based discovery in friends, squads, lists, and
            shared beacons; your profile is not public on the internet.
          </Txt>
        )}
        {visibility === "friends" && (
          <Txt muted>Only people you have accepted as friends.</Txt>
        )}
        {visibility === "custom" && (
          <Txt muted>
            Only chosen people or current members of your chosen squads,
            organizations, or lists. Friends not selected here won’t see full
            details.
          </Txt>
        )}
      </View>
      {visibility === "custom" && (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Current organization members</Text>
            {!selectableOrganizations.length ? (
              <Txt muted>You don’t currently belong to any organizations.</Txt>
            ) : null}
            {selectableOrganizations.map((org) => (
              <AudienceToggle
                key={org.id}
                id={org.id}
                label={org.name}
                selected={organizations.includes(org.id)}
                disabled={saving}
                onToggle={toggle(organizations, setOrganizations)}
              />
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>Chosen people</Text>
            <Field
              label="Find a person"
              value={peopleQuery}
              onChangeText={setPeopleQuery}
              autoCapitalize="none"
              editable={!saving}
            />
            {!visiblePeople.length && (
              <Txt muted>No people are available to select right now.</Txt>
            )}
            {visiblePeople.map((person) => (
              <AudienceToggle
                key={person.id}
                id={person.id}
                label={person.name}
                selected={people.includes(person.id)}
                disabled={saving}
                onToggle={toggle(people, setPeople)}
              />
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>Current squad members</Text>
            {!selectableSquads.length && (
              <Txt muted>You don’t currently belong to any squads.</Txt>
            )}
            {selectableSquads.map((squad) => (
              <AudienceToggle
                key={squad.id}
                id={squad.id}
                label={squad.name}
                selected={squads.includes(squad.id)}
                disabled={saving}
                onToggle={toggle(squads, setSquads)}
              />
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>Your private lists</Text>
            {!selectableLists.length && (
              <Txt muted>You don’t have any private lists yet.</Txt>
            )}
            {selectableLists.map((list) => (
              <AudienceToggle
                key={list.id}
                id={list.id}
                label={list.name}
                selected={lists.includes(list.id)}
                disabled={saving}
                onToggle={toggle(lists, setLists)}
              />
            ))}
          </View>
        </>
      )}
      <Action
        title="Save profile privacy"
        disabled={saving || !userId || data.viewer_id !== userId}
        run={async () => {
          if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before changing visibility.");
          setSaving(true);
          setSavedMessage("");
          try {
            await act("save_profile_privacy", {
            profile_visibility: visibility,
            person_ids: visibility === "custom" ? people.filter((id) => selectablePeople.some((person) => person.id === id)) : [],
            squad_ids: visibility === "custom" ? squads.filter((id) => selectableSquads.some((squad) => squad.id === id)) : [],
            list_ids: visibility === "custom" ? lists.filter((id) => selectableLists.some((list) => list.id === id)) : [],
            organization_ids: visibility === "custom" ? organizations.filter((id) => selectableOrganizations.some((organization) => organization.id === id)) : [],
            });
            setSavedMessage("Profile visibility saved.");
            onSaved?.();
          } finally { setSaving(false); }
        }}
      />
      {!!savedMessage && <Txt>{savedMessage}</Txt>}
    </View>
  );
}
