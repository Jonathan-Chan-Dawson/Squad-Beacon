import React, { useState } from "react";
import { Text, View } from "react-native";
import { CalendarClock, Plus } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import DateField from "@/components/DateField";
import { CreationPicker } from "@/src/features/beacons/components/CreationPicker";
import { localDateTimeField } from "@/src/shared/dateTime";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { suggestedSlots } from "./connected";
import {
  planningTimeOnDay,
  planningTimeSummary,
  planningTimezone,
  planningZoneLabel,
} from "./creationTiming";
import { PlanningCreationRow } from "./PlanningCreationFields";
import type { PlanningSlot } from "./types";

export function PlanningTimeSlots({
  slots,
  timezone,
  now,
  deadline,
  duration,
  onChange,
}: {
  slots: PlanningSlot[];
  timezone: string;
  now: number;
  deadline: string;
  duration?: Partial<Pick<PlanningSlot, "starts_at" | "ends_at">>;
  onChange: (slots: PlanningSlot[]) => void;
}) {
  const { colors, styles } = useTheme();
  const [editing, setEditing] = useState<{
    original?: string;
    slot: PlanningSlot;
  }>();
  const [valid, setValid] = useState({ start: true, end: true });
  const slot = editing?.slot;
  const zoneLabel = slot && planningZoneLabel(slot.timezone, now);
  function open(next?: { original?: string; slot: PlanningSlot }) {
    setValid({ start: true, end: true });
    setEditing(next);
  }
  function add() {
    const last = slots.at(-1);
    const basis = Math.max(now, Date.parse(deadline));
    if (last) {
      try {
        const localTime = localDateTimeField(last.starts_at, timezone).slice(11);
        const starts_at = planningTimeOnDay(Date.parse(last.starts_at), 1, localTime, timezone);
        const length = Date.parse(last.ends_at) - Date.parse(last.starts_at);
        const ends_at = new Date(Date.parse(starts_at) + length).toISOString();
        if (Date.parse(starts_at) > basis && !slots.some((row) => row.starts_at === starts_at && row.ends_at === ends_at)) {
          open({ slot: { ...last, id: randomUUID(), starts_at, ends_at } });
          return;
        }
      } catch {
        // The copied wall time can fall in a daylight saving gap.
      }
    }
    const suggestions = suggestedSlots(basis, randomUUID, {
      ...(last ?? duration),
      timezone,
    });
    const choice = suggestions.find(
      (option) =>
        !slots.some(
          (row) =>
            row.starts_at === option.starts_at &&
            row.ends_at === option.ends_at,
        ),
    );
    open({ slot: choice ?? suggestions[0] });
  }
  function update(field: "starts_at" | "ends_at", value: string) {
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current.slot, [field]: value };
      if (field === "starts_at") {
        const previousDuration =
          Date.parse(current.slot.ends_at) - Date.parse(current.slot.starts_at);
        if (previousDuration > 0)
          next.ends_at = new Date(
            Date.parse(value) + previousDuration,
          ).toISOString();
      }
      return { ...current, slot: next };
    });
    if (field === "starts_at")
      setValid((current) => ({ ...current, end: true }));
  }
  const start = Date.parse(slot?.starts_at ?? "");
  const end = Date.parse(slot?.ends_at ?? "");
  const issue =
    !slot || !valid.start || !valid.end
      ? ""
      : start <= Math.max(now, Date.parse(deadline))
        ? "Choose a start after responses close."
        : end - start < 300000 || end - start > 86400000
          ? "Choose an end 5 minutes to 24 hours after the start."
          : slots.some(
                (row) =>
                  row.id !== editing?.original &&
                  Date.parse(row.starts_at) === start &&
                  Date.parse(row.ends_at) === end,
              )
            ? "You already added this time."
            : "";
  return (
    <View style={{ gap: 6 }}>
      <Txt>Proposed times</Txt>
      {slots.length < 2 && <Txt muted>Add at least two times to compare.</Txt>}
      {slots.map((option) => (
        <PlanningCreationRow
          key={option.id}
          label={planningTimeSummary(
            option.starts_at,
            planningTimezone(),
            now,
            option.ends_at,
          )}
          actionLabel="Edit time"
          icon={
            <CalendarClock size={18} color={colors.green} aria-hidden />
          }
          onPress={() => open({ original: option.id, slot: option })}
        />
      ))}
      {slots.length < 10 && (
        <Button
          compact
          secondary
          title="Add a time"
          icon={<Plus size={17} color={colors.green} />}
          onPress={add}
        />
      )}
      <CreationPicker
        visible={!!editing}
        title={editing?.original ? "Edit time" : "Add a time"}
        onClose={() => open()}
        footer={<Button compact secondary title="Close" onPress={() => open()} />}
      >
        {!!slot && (
          <View style={{ gap: 10 }}>
            {!!zoneLabel && <Txt muted>{zoneLabel}</Txt>}
            <DateField
              label="Starts"
              timezone={slot.timezone}
              showTimezone={false}
              value={slot.starts_at}
              onChange={(value) => update("starts_at", value)}
              onValidityChange={(start) =>
                setValid((current) => ({ ...current, start }))
              }
            />
            <DateField
              label="Ends"
              timezone={slot.timezone}
              showTimezone={false}
              value={slot.ends_at}
              onChange={(value) => update("ends_at", value)}
              onValidityChange={(end) =>
                setValid((current) => ({ ...current, end }))
              }
            />
            {!!issue && (
              <Text accessibilityRole="alert" style={styles.error}>
                {issue}
              </Text>
            )}
            <Button
              title={editing?.original ? "Save time" : "Add this time"}
              disabled={!valid.start || !valid.end || !!issue}
              onPress={() => {
                const original = editing?.original;
                onChange(
                  original
                    ? slots.map((row) =>
                        row.id === original
                          ? { ...slot, id: randomUUID() }
                          : row,
                      )
                    : [...slots, slot],
                );
                open();
              }}
            />
            {!!editing?.original && (
              <Button
                compact
                secondary
                title="Remove time"
                onPress={() => {
                  onChange(slots.filter((row) => row.id !== editing.original));
                  open();
                }}
              />
            )}
          </View>
        )}
      </CreationPicker>
    </View>
  );
}
