import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Check,
  ChevronDown,
  Clock3,
  Minus,
  Plus,
  UsersRound,
  X,
} from "lucide-react-native";
import DateField from "@/components/DateField";
import {
  AudiencePicker,
  Button,
  Field,
  Sheet,
  useTheme,
} from "@/src/shared/ui";
import type { Audience, Payload, Presence } from "@/src/shared/types";
import {
  activeAvailability,
  availabilityColors,
  availabilityEnd,
  availabilityOptions,
  type AvailabilityOption,
} from "../../availability";

type Props = {
  current: ReturnType<typeof activeAvailability>;
  presence?: Presence;
  busy: boolean;
  error: string;
  now: number;
  visible: boolean;
  onClose(): void;
  onApply(payload: Payload): Promise<void>;
};

export function TimedAvailabilitySheet({
  current,
  presence,
  busy,
  error,
  now,
  visible,
  onClose,
  onApply,
}: Props) {
  const { colors, tokens } = useTheme();
  const [status, setStatus] = useState(current?.status ?? "available");
  const [duration, setDuration] = useState<AvailabilityOption>(
    current?.indefinite ? "Until cleared" : current ? "Custom" : "1 hour",
  );
  const [customEnd, setCustomEnd] = useState(
    presence?.availability_until ?? "",
  );
  const [editingCustomEnd, setEditingCustomEnd] = useState(false);
  const [note, setNote] = useState(current?.note ?? "");
  const [audience, setAudience] = useState<Audience>(
    presence?.availability_audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState(
    presence?.availability_audience_id ?? null,
  );
  const [section, setSection] = useState<"duration" | "sharing" | null>(null);
  const [validation, setValidation] = useState("");
  const CurrentIcon = current?.status === "busy" ? Minus : Check;

  function save() {
    setValidation("");
    try {
      const end = availabilityEnd(duration, now, customEnd);
      void onApply({
        availability: status,
        availability_mode: end ? "timed" : "indefinite",
        ...(end ? { availability_until: end } : {}),
        availability_note: note.trim(),
        availability_audience: audience,
        availability_audience_id: audienceId,
      });
    } catch (failure) {
      setValidation(
        failure instanceof Error ? failure.message : "Choose an end time.",
      );
    }
  }

  return (
    <Sheet
      title="Availability & sharing"
      visible={visible}
      onClose={onClose}
      snapHeight={710}
      footer={
        <Button
          title={busy ? "Saving…" : "Save availability"}
          disabled={busy}
          onPress={save}
        />
      }
    >
      {current && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 12,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: current.color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CurrentIcon size={16} color="#25342E" strokeWidth={2.5} />
            </View>
            <Text
              style={{
                flex: 1,
                color: colors.ink,
                ...tokens.type.secondary,
                fontWeight: "700",
              }}
            >
              {current.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear availability"
              disabled={busy}
              onPress={() => void onApply({ availability: null })}
              style={{
                minHeight: 44,
                minWidth: 44,
                flexDirection: "row",
                gap: 4,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  ...tokens.type.secondary,
                }}
              >
                Clear
              </Text>
            </Pressable>
          </View>
          {!current.indefinite && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
              }}
            >
              {([30, 60] as const).map((minutes) => (
                <Pressable
                  key={minutes}
                  accessibilityRole="button"
                  accessibilityLabel={minutes === 30 ? "+30 min" : "+1 hour"}
                  disabled={busy}
                  onPress={() =>
                    void onApply({ availability_extend_minutes: minutes })
                  }
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={14} color={colors.primary} />
                  <Text style={{ color: colors.ink, ...tokens.type.secondary }}>
                    {minutes === 30 ? "30 min" : "1 hour"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.ink,
            ...tokens.type.secondary,
            fontWeight: "700",
          }}
        >
          Status
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["available", "busy"] as const).map((value) => {
            const Icon = value === "available" ? Check : Minus;
            const selected = status === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => setStatus(value)}
                style={{
                  flex: 1,
                  minHeight: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected
                    ? availabilityColors[value]
                    : colors.line,
                  backgroundColor: selected
                    ? `${availabilityColors[value]}18`
                    : colors.surface,
                }}
              >
                <View
                  style={{
                    width: 25,
                    height: 25,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: availabilityColors[value],
                    borderRadius: 8,
                  }}
                >
                  <Icon size={15} color="#25342E" strokeWidth={2.5} />
                </View>
                <Text
                  style={{
                    color: colors.ink,
                    ...tokens.type.secondary,
                    fontWeight: selected ? "700" : "500",
                  }}
                >
                  {value === "available" ? "Free" : "Busy"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change end time"
          accessibilityState={{ expanded: section === "duration" }}
          onPress={() => setSection(section === "duration" ? null : "duration")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 50,
            gap: 9,
          }}
        >
          <Clock3 size={17} color={colors.textSecondary} />
          <Text
            style={{ color: colors.ink, flex: 1, ...tokens.type.secondary }}
          >
            End time
          </Text>
          <Text
            style={{ color: colors.textSecondary, ...tokens.type.secondary }}
          >
            {duration === "Custom" &&
            current?.end &&
            customEnd === presence?.availability_until
              ? new Date(current.end).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : duration}
          </Text>
          <ChevronDown size={16} color={colors.textSecondary} />
        </Pressable>
        {section === "duration" &&
          availabilityOptions.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: option === duration }}
              onPress={() => {
                setDuration(option);
                setEditingCustomEnd(option === "Custom");
                setSection(null);
              }}
              style={{
                minHeight: 44,
                marginLeft: 26,
                flexDirection: "row",
                alignItems: "center",
                borderTopWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                style={{ color: colors.ink, flex: 1, ...tokens.type.secondary }}
              >
                {option === "Tonight"
                  ? "Until tonight"
                  : option === "Custom"
                    ? "Custom time"
                    : option}
              </Text>
              {option === duration && (
                <Check size={16} color={colors.primary} />
              )}
            </Pressable>
          ))}
      </View>
      {duration === "Custom" && editingCustomEnd && (
        <DateField
          label="End date and time"
          value={customEnd}
          onChange={setCustomEnd}
          showTimezone={false}
        />
      )}
      <Field
        label="Availability note (optional)"
        placeholder="Up for coffee?"
        value={note}
        maxLength={120}
        onChangeText={setNote}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Who can see this"
        accessibilityState={{ expanded: section === "sharing" }}
        onPress={() => setSection(section === "sharing" ? null : "sharing")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
          gap: 9,
        }}
      >
        <UsersRound size={17} color={colors.textSecondary} />
        <Text style={{ flex: 1, color: colors.ink, ...tokens.type.secondary }}>
          Who can see this
        </Text>
        {(audience === "friends" || audience === "private") && (
          <Text
            style={{ color: colors.textSecondary, ...tokens.type.secondary }}
          >
            {audience === "friends" ? "Friends" : "Only me"}
          </Text>
        )}
        <ChevronDown size={16} color={colors.textSecondary} />
      </Pressable>
      {section === "sharing" && (
        <AudiencePicker
          value={audience}
          id={audienceId}
          onChange={(value, id) => {
            setAudience(value);
            setAudienceId(id);
          }}
        />
      )}
      {section === "sharing" && (
        <Button
          secondary
          title={
            presence?.sharing === false
              ? "Resume status sharing"
              : "Pause status sharing"
          }
          disabled={busy}
          onPress={() => void onApply({ sharing: presence?.sharing === false })}
        />
      )}
      {validation || error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, ...tokens.type.secondary }}
        >
          {validation || error}
        </Text>
      ) : null}
    </Sheet>
  );
}
