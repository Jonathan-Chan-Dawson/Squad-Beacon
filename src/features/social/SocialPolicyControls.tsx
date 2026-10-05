import React, { useState } from "react";
import { Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { Discoverability, InvitePolicy, JoinMode, SocialEntityType } from "./types";
import { Action, Txt, useTheme } from "@/src/shared/ui";
import { MotionPressable } from "@/src/shared/MotionPressable";

export type SocialPolicyValue = {
  discoverability: Discoverability;
  join_mode: JoinMode;
  invite_policy: InvitePolicy;
};

const discoverabilityOptions: readonly { value: Discoverability; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "community", label: "Community" },
  { value: "private", label: "Private" },
];
const joinModeOptions: readonly { value: JoinMode; label: string }[] = [
  { value: "open", label: "Anyone can join" },
  { value: "request", label: "Request to join" },
  { value: "invite", label: "Invite only" },
];
const invitePolicyOptions: readonly { value: InvitePolicy; label: string }[] = [
  { value: "admins", label: "Admins" },
  { value: "elders", label: "Elders & admins" },
  { value: "members", label: "All members" },
];

const discoverabilityLabel = (value: Discoverability) => discoverabilityOptions.find((item) => item.value === value)?.label ?? "Private";
const joinModeLabel = (value: JoinMode) => joinModeOptions.find((item) => item.value === value)?.label ?? "Invite only";
const invitePolicyLabel = (value: InvitePolicy) => invitePolicyOptions.find((item) => item.value === value)?.label ?? "Admins";

function PolicyChoices<T extends string>({
  value,
  options,
  prefix,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  prefix: string;
  onChange: (value: T) => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <MotionPressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`${prefix}: ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { minHeight: 44, justifyContent: "center" },
              selected && { backgroundColor: colors.ink, borderColor: colors.ink },
            ]}
          >
            <Text style={[styles.chipText, selected && { color: colors.white }]}>{option.label}</Text>
          </MotionPressable>
        );
      })}
    </View>
  );
}

export function SocialPolicyFields({
  value,
  onChange,
  collapsible = false,
}: {
  value: SocialPolicyValue;
  onChange: (value: SocialPolicyValue) => void;
  collapsible?: boolean;
}) {
  const { styles, colors } = useTheme();
  const [expanded, setExpanded] = useState(!collapsible);
  return (
    <View style={{ gap: 12 }}>
      {collapsible ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Access and joining settings"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={[styles.row, { minHeight: 48, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.body}>Access & joining</Text>
            <Text style={styles.muted}>
              {discoverabilityLabel(value.discoverability)} · {joinModeLabel(value.join_mode)} · {invitePolicyLabel(value.invite_policy)}
            </Text>
          </View>
          {expanded ? <ChevronUp size={17} color={colors.muted} /> : <ChevronDown size={17} color={colors.muted} />}
        </MotionPressable>
      ) : null}
      {expanded ? (
        <>
          <View style={{ gap: 5 }}>
            <Text style={styles.label}>WHO CAN FIND IT</Text>
            <Txt muted>Community discovery only includes linked community members. Private communities stay out of discovery.</Txt>
            <PolicyChoices
              prefix="Discoverability"
              options={discoverabilityOptions}
              value={value.discoverability}
              onChange={(discoverability) => onChange({ ...value, discoverability })}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={styles.label}>HOW PEOPLE JOIN</Text>
            <Txt muted>Requests are reviewed by community admins. Invitations can still be accepted directly.</Txt>
            <PolicyChoices
              prefix="Join mode"
              options={joinModeOptions}
              value={value.join_mode}
              onChange={(join_mode) => onChange({ ...value, join_mode })}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={styles.label}>WHO CAN INVITE</Text>
            <PolicyChoices
              prefix="Invite policy"
              options={invitePolicyOptions}
              value={value.invite_policy}
              onChange={(invite_policy) => onChange({ ...value, invite_policy })}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

export function SocialPolicySettings({
  entityType,
  initial,
  onSave,
}: {
  entityType: SocialEntityType;
  initial: SocialPolicyValue;
  onSave: (value: SocialPolicyValue) => Promise<unknown>;
}) {
  const [value, setValue] = useState(initial);
  const label = entityType === "organization" ? "Organization" : entityType === "space" ? "Space" : "Squad";
  return (
    <View style={{ gap: 10 }}>
      <SocialPolicyFields value={value} onChange={setValue} />
      <Action title={`Save ${label} access`} run={() => onSave(value)} />
    </View>
  );
}
