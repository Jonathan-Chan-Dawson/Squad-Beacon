import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarClock, ChevronRight, Users } from "lucide-react-native";
import DateField from "@/components/DateField";
import { CreationPicker } from "@/src/features/beacons/components/CreationPicker";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";
import { Chip } from "@/src/shared/design-system";
import { localDate } from "@/src/shared/domain";
import { useBeacon } from "@/src/shared/store";
import type { Audience } from "@/src/shared/types";
import { AudiencePicker, Button, Txt, useTheme } from "@/src/shared/ui";
import {
  planningTimeOnDay,
  planningTimeSummary,
  planningTimezone,
  planningZoneLabel,
} from "./creationTiming";

export function PlanningCreationRow({
  label,
  summary,
  actionLabel,
  icon,
  onPress,
}: {
  label: string;
  summary?: string;
  actionLabel?: string;
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  const { colors, styles } = useTheme();
  const content = (
    <>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={summary ? styles.label : styles.body}>{label}</Text>
        {!!summary && <Text style={styles.body}>{summary}</Text>}
      </View>
      {!!actionLabel && <Text style={styles.muted}>{actionLabel}</Text>}
      {!!onPress && (
        <ChevronRight size={17} color={colors.muted} aria-hidden />
      )}
    </>
  );
  const style = {
    minHeight: 52,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, summary, actionLabel]
        .filter(Boolean)
        .join(" · ")}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

export function PlanningAudienceField({
  value,
  id,
  fixedLabel,
  locked,
  onChange,
}: {
  value: Audience;
  id: string | null;
  fixedLabel?: string;
  locked?: boolean;
  onChange: (value: Audience, id: string | null) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected =
    value === "friends"
      ? "Friends"
      : value === "private"
        ? "Only me"
        : eligibleDefaultTargets(data, userId ?? "", value).find(
            (group) => group.id === id,
          )?.name;
  return (
    <>
      <PlanningCreationRow
        label="Who can respond?"
        summary={fixedLabel ? `${selected ?? "Plan audience"} · ${fixedLabel}` : selected ?? "Choose an audience"}
        icon={<Users size={19} color={colors.green} aria-hidden />}
        onPress={fixedLabel || locked ? undefined : () => setOpen(true)}
      />
      <CreationPicker
        visible={open}
        title="Who can respond?"
        onClose={() => setOpen(false)}
        footer={<Button compact secondary title="Close" onPress={() => setOpen(false)} />}
      >
        {open && (
          <View style={{ gap: 10 }}>
            <Txt muted>
              People in this audience can see and respond to your post.
            </Txt>
            <AudiencePicker
              inline
              value={value}
              id={id}
              onChange={(next, nextId) => {
                onChange(next, nextId);
                setOpen(false);
              }}
            />
          </View>
        )}
      </CreationPicker>
    </>
  );
}

export function PlanningDateField({
  label,
  value,
  seed,
  timezone,
  now,
  min,
  max,
  allowFlexible,
  onChange,
}: {
  label: string;
  value: string;
  seed?: string;
  timezone: string;
  now: number;
  min: number;
  max?: number;
  allowFlexible?: boolean;
  onChange: (value: string) => void;
}) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [pending, setPending] = useState("");
  const [valid, setValid] = useState(true);
  const zoneLabel = planningZoneLabel(timezone, now);
  const allowed = (instant: string) =>
    Date.parse(instant) > min &&
    (max === undefined || Date.parse(instant) < max);
  const daysToSaturday =
    (13 -
      new Date(`${localDate(new Date(now), timezone)}T12:00:00Z`).getUTCDay()) %
    7;
  const presets = [
    { label: "Tonight", value: planningTimeOnDay(now, 0, allowFlexible ? "18:00" : "23:59", timezone) },
    { label: "Tomorrow", value: planningTimeOnDay(now, 1, "18:00", timezone) },
    ...(allowFlexible && daysToSaturday >= 2
      ? [
          {
            label: "This weekend",
            value: planningTimeOnDay(now, daysToSaturday, "18:00", timezone),
          },
        ]
      : []),
    ...(!allowFlexible && max !== undefined
      ? [
          {
            label: "Before activity",
            value: new Date(max - 60 * 60000).toISOString(),
          },
        ]
      : []),
  ];
  function apply(next: string) {
    onChange(next);
    setOpen(false);
  }
  return (
    <>
      <PlanningCreationRow
        label={label}
        summary={
          value
            ? planningTimeSummary(value, planningTimezone(), now)
            : "Flexible"
        }
        icon={
          <CalendarClock size={19} color={colors.green} aria-hidden />
        }
        onPress={() => {
          setPending(
            value || seed || planningTimeOnDay(now, 1, "18:00", timezone),
          );
          setValid(true);
          setCustom(false);
          setOpen(true);
        }}
      />
      <CreationPicker
        visible={open}
        title={label}
        onClose={() => setOpen(false)}
        footer={<Button compact secondary title="Cancel" onPress={() => setOpen(false)} />}
      >
        {open && (
          <View style={{ gap: 12 }}>
            {!!zoneLabel && <Txt muted>{zoneLabel}</Txt>}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {allowFlexible && (
                <Chip
                  label="Flexible"
                  selected={!value && !custom}
                  onPress={() => apply("")}
                />
              )}
              {presets
                .filter((preset) => allowed(preset.value))
                .map((preset) => (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    selected={!custom && value === preset.value}
                    onPress={() => apply(preset.value)}
                  />
                ))}
              <Chip
                label="Custom date & time"
                selected={custom}
                onPress={() => setCustom(true)}
              />
            </View>
            {custom && (
              <>
                <DateField
                  label={label}
                  value={pending}
                  timezone={timezone}
                  showTimezone={false}
                  onChange={setPending}
                  onValidityChange={setValid}
                />
                {valid && !allowed(pending) && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {allowFlexible
                      ? "Choose a time after responses close."
                      : max === undefined
                        ? "Choose a future deadline."
                        : "Choose a deadline before the activity and after now."}
                  </Text>
                )}
                <Button
                  title="Use this time"
                  disabled={!valid || !allowed(pending)}
                  onPress={() => apply(pending)}
                />
              </>
            )}
          </View>
        )}
      </CreationPicker>
    </>
  );
}
