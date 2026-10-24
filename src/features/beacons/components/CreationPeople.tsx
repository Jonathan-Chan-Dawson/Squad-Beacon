import React, { useState } from "react";
import { Pressable, Text, View, type TextInput } from "react-native";
import { AudiencePicker, Button, Field, Txt, useTheme } from "@/src/shared/ui";
import type { SocialEntityType } from "@/src/features/social/types";
import type { Audience } from "@/src/shared/types";
import type { BeaconControlValues } from "../controls";
import { CreationSwitch } from "./CreationControls";
import { CreationDisclosure } from "./CreationDisclosure";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";

export function CreationLink({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
    >
      <Text
        style={[
          styles.body,
          { color: colors.ink, fontWeight: "600", fontSize: 13 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function Choice({
  title,
  selected,
  onPress,
  detail,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  detail?: string;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        accessible={false}
        style={{
          color: selected ? colors.primary : colors.muted,
          fontSize: 20,
        }}
      >
        {selected ? "◉" : "○"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{title}</Text>
        {detail ? <Txt muted>{detail}</Txt> : null}
      </View>
    </Pressable>
  );
}
export function CreationCapacity({
  value,
  onChange,
  inputRef,
}: {
  value: BeaconControlValues;
  onChange: (value: BeaconControlValues) => void;
  inputRef?: React.Ref<TextInput>;
}) {
  const { styles } = useTheme();
  const maximum = value.capacity_limit;
  const [editingMaximum, setEditingMaximum] = useState(false);
  const configured = maximum != null || editingMaximum;
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text style={styles.label}>Maximum spots</Text>
        <CreationLink
          title={configured ? "Clear maximum" : "Set maximum"}
          onPress={() => {
            setEditingMaximum(!configured);
            onChange({ ...value, capacity_limit: configured ? null : 2 });
          }}
        />
      </View>
      {!configured ? (
        <Txt muted>Unlimited</Txt>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Button
            compact
            secondary
            title="−"
            accessibilityLabel="Decrease maximum spots"
            disabled={maximum == null || maximum <= 2}
            onPress={() =>
              onChange({
                ...value,
                capacity_limit: Math.max(2, (maximum ?? 2) - 1),
              })
            }
          />
          <View style={{ flex: 1 }}>
            <Field
              inputRef={inputRef}
              label="Maximum spots (2–500)"
              keyboardType="number-pad"
              value={maximum == null ? "" : String(maximum)}
              onFocus={() => setEditingMaximum(true)}
              onBlur={() => {
                if (maximum == null) setEditingMaximum(false);
              }}
              onChangeText={(text) =>
                /^\d*$/.test(text) &&
                onChange({
                  ...value,
                  capacity_limit: text ? Number(text) : null,
                })
              }
            />
          </View>
          <Button
            compact
            secondary
            title="+"
            accessibilityLabel="Increase maximum spots"
            disabled={maximum != null && maximum >= 500}
            onPress={() =>
              onChange({
                ...value,
                capacity_limit: Math.min(500, (maximum ?? 1) + 1),
              })
            }
          />
        </View>
      )}
      <CreationSwitch
        title="Enforce maximum"
        value={value.capacity_policy === "strict"}
        onChange={(strict) =>
          onChange({ ...value, capacity_policy: strict ? "strict" : "soft" })
        }
        detail="Off: advisory. On: joining stops when full. Counts the host and accepted seats."
      />
    </View>
  );
}
export type CreationPeoplePanel =
  "none" | "visibility" | "community" | "joining";
export type CreationCommunityChoice = {
  entity_type: SocialEntityType;
  entity_id: string;
  name: string;
  joined: boolean;
};
export function CreationPeople({
  audience,
  audienceId,
  audienceLabel,
  onAudience,
  invitations,
  community,
  communityChoices,
  selectedCommunity,
  onCommunity,
  approval,
  onApproval,
  controls,
  onControls,
  notice,
  capacityRef,
  review,
  panel,
  onPanel,
}: {
  audience: Audience;
  audienceId: string | null;
  audienceLabel: string;
  onAudience: (value: Audience, id: string | null) => void;
  invitations: React.ReactNode;
  community?: string;
  communityChoices: CreationCommunityChoice[];
  selectedCommunity: {
    entity_type: SocialEntityType;
    entity_id: string;
  } | null;
  onCommunity: (
    value: { entity_type: SocialEntityType; entity_id: string } | null,
  ) => void;
  approval: string;
  onApproval: (value: string) => void;
  controls: BeaconControlValues;
  onControls: (value: BeaconControlValues) => void;
  notice?: string;
  capacityRef?: React.Ref<TextInput>;
  review?: React.ReactNode;
  panel: CreationPeoplePanel;
  onPanel: (value: CreationPeoplePanel) => void;
}) {
  const { styles, colors } = useTheme();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  const toggle = (value: CreationPeoplePanel) =>
    onPanel(panel === value ? "none" : value);
  const kind = (value: SocialEntityType) =>
    value === "organization"
      ? "Network"
      : value === "space"
        ? "Organization"
        : "Squad";
  const selected = (row: CreationCommunityChoice) =>
    row.entity_type === selectedCommunity?.entity_type &&
    row.entity_id === selectedCommunity.entity_id;
  const choices = [...communityChoices]
    .sort(
      (a, b) =>
        Number(selected(b)) - Number(selected(a)) ||
        Number(b.joined) - Number(a.joined) ||
        a.name.localeCompare(b.name),
    )
    .filter((row) =>
      `${row.name} ${kind(row.entity_type)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  return (
    <View
      style={{
        gap: 6,
        borderTopWidth: 1,
        borderColor: colors.line,
        paddingTop: 12,
      }}
    >
      <Text accessibilityRole="header" style={styles.h2}>
        People & Community
      </Text>
      <CreationDisclosure
        compact
        title="Visibility"
        summary={audienceLabel}
        open={panel === "visibility"}
        onToggle={() => toggle("visibility")}
      >
        <AudiencePicker
          inline
          value={audience}
          id={audienceId}
          onChange={(value, id) => {
            onAudience(value, id);
            onPanel("none");
          }}
        />
      </CreationDisclosure>
      <Txt muted>{"Visibility doesn't send invitations."}</Txt>
      {notice ? <Txt muted>{notice}</Txt> : null}
      <View
        style={{
          gap: 2,
          borderTopWidth: 1,
          borderColor: colors.line,
          paddingTop: 8,
        }}
      >
        <Text style={styles.label}>Invite People</Text>
        {invitations}
      </View>
      <CreationDisclosure
        compact
        title="Community"
        icon={
          selectedCommunity ? (
            <CommunityAvatar type={selectedCommunity.entity_type} size={26} />
          ) : undefined
        }
        summary={community ?? "No community selected"}
        open={panel === "community"}
        onToggle={() => toggle("community")}
      >
        <Field
          label="Search communities"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setLimit(6);
          }}
          placeholder="Squads, Organizations, Networks…"
        />
        <Choice
          title="No community selected"
          selected={!selectedCommunity}
          onPress={() => {
            onCommunity(null);
            onPanel("none");
          }}
        />
        {choices.slice(0, limit).map((row) => (
          <Choice
            key={`${row.entity_type}:${row.entity_id}`}
            title={row.name}
            detail={kind(row.entity_type)}
            selected={selected(row)}
            onPress={() => {
              onCommunity({
                entity_type: row.entity_type,
                entity_id: row.entity_id,
              });
              onPanel("none");
            }}
          />
        ))}
        {!choices.length ? <Txt muted>No matching communities.</Txt> : null}
        {choices.length > limit ? (
          <CreationLink
            title="Show more communities"
            onPress={() => setLimit(limit + 6)}
          />
        ) : null}
        {selectedCommunity ? (
          <CreationLink
            title="Clear community"
            onPress={() => {
              onCommunity(null);
              onPanel("none");
            }}
          />
        ) : null}
      </CreationDisclosure>
      <CreationDisclosure
        compact
        title="Joining & Capacity"
        summary={`${approval === "Host approval" ? "Host Approval" : "Open Joining"} · ${controls.capacity_limit == null ? "Unlimited" : `${controls.capacity_limit} spots`}${controls.capacity_policy === "strict" ? " · Enforced" : ""}`}
        open={panel === "joining"}
        onToggle={() => toggle("joining")}
      >
        {["Open joining", "Host approval"].map((value) => (
          <Choice
            key={value}
            title={value === "Open joining" ? "Open Joining" : "Host Approval"}
            selected={approval === value}
            onPress={() => onApproval(value)}
          />
        ))}
        <CreationCapacity
          value={controls}
          onChange={onControls}
          inputRef={capacityRef}
        />
        <Txt muted>
          Invitations send to selected eligible friends on publication, up to
          20. Community association does not change access or invite members.
        </Txt>
        <Txt muted>
          After creating, open People → Organizer roles. People must be approved
          and Going before receiving a role. Invitations never grant leadership.
        </Txt>
      </CreationDisclosure>
      {review}
    </View>
  );
}
