import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Circle, Clock3, Sparkles, Trash2 } from "lucide-react-native";
import type { Profile } from "@/src/shared/types";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { useNow } from "@/src/shared/useNow";
import {
  Card,
  Chip,
  PrimaryButton,
  SecondaryButton,
  useDesignTheme,
  uiHaptics,
} from "@/src/shared/design-system";
import { Action, Field, Sheet } from "@/src/shared/ui";
import { radius, space, type } from "@/src/theme/data";

export type FeedStatus = {
  id: string;
  title: string;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

export type FeedStatusSave = {
  title: string;
  available: boolean;
  endsAt: string;
};

type DurationPreset = "hour" | "tonight" | "busy" | "custom";

export type StatusPanelProps = {
  profile?: Profile;
  status: FeedStatus | null;
  editorVisible: boolean;
  saving: boolean;
  error?: string | null;
  onCreate: () => void;
  onEdit: () => void;
  onCloseEditor: () => void;
  onSave: (value: FeedStatusSave) => void | Promise<unknown>;
  onClear: () => void | Promise<unknown>;
  onConvert: () => void;
};

export function StatusPanel({
  profile,
  status,
  editorVisible,
  saving,
  error,
  onCreate,
  onEdit,
  onCloseEditor,
  onSave,
  onClear,
  onConvert,
}: StatusPanelProps) {
  const { colors, tokens } = useDesignTheme();
  const now = useNow();
  const [title, setTitle] = useState("");
  const [available, setAvailable] = useState(true);
  const [preset, setPreset] = useState<DurationPreset>("custom");
  const [customMinutes, setCustomMinutes] = useState("60");
  const [preservedEndsAt, setPreservedEndsAt] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [localError, setLocalError] = useState("");
  const availability = status?.available ? "available" : "unavailable";
  const token = tokens.availability[availability];
  const AvailabilityIcon = token.icon;
  const expiry = status ? Date.parse(status.endsAt) : NaN;
  const remainingMinutes = Number.isFinite(expiry)
    ? Math.max(0, Math.ceil((expiry - now) / 60_000))
    : 0;
  const timeLabel = Number.isFinite(expiry)
    ? new Date(expiry).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingPartMinutes = remainingMinutes % 60;
  const remainingLabel =
    remainingHours === 0
      ? `${remainingMinutes} min remaining`
      : remainingPartMinutes === 0
        ? `${remainingHours} hr${remainingHours === 1 ? "" : "s"} remaining`
        : `${remainingHours} hr${remainingHours === 1 ? "" : "s"} ${remainingPartMinutes} min remaining`;

  const initializeEditor = (editingStatus: FeedStatus | null) => {
    const current = Date.now();
    setTitle(editingStatus?.title ?? "");
    setAvailable(editingStatus?.available ?? true);
    setPreset("custom");
    setTitleTouched(false);
    const endAt = editingStatus ? Date.parse(editingStatus.endsAt) : NaN;
    const duration = Number.isFinite(endAt)
      ? Math.ceil((endAt - current) / 60_000)
      : 60;
    setCustomMinutes(String(Math.max(5, Math.min(1440, duration || 60))));
    setPreservedEndsAt(
      Number.isFinite(endAt) && endAt > current
        ? (editingStatus?.endsAt ?? null)
        : null,
    );
    setLocalError("");
  };

  const beginCreate = () => {
    initializeEditor(null);
    onCreate();
    void uiHaptics.light();
  };

  const beginEdit = () => {
    initializeEditor(status);
    onEdit();
    void uiHaptics.light();
  };

  const choosePreset = (next: DurationPreset) => {
    setPreset(next);
    setLocalError("");
    if (next !== "custom") setPreservedEndsAt(null);
    if (!titleTouched) {
      setTitle(
        next === "hour"
          ? "Free for 1 hr"
          : next === "tonight"
            ? "Free tonight"
            : next === "busy"
              ? "Busy"
              : available
                ? "Free to hang"
                : "Busy",
      );
    }
    if (next === "hour") {
      setAvailable(true);
      setCustomMinutes("60");
    } else if (next === "tonight") {
      setAvailable(true);
    } else if (next === "busy") {
      setAvailable(false);
      setCustomMinutes("60");
    }
  };

  const chooseAvailability = (next: boolean) => {
    setAvailable(next);
    if (!titleTouched) setTitle(next ? "Free to hang" : "Busy");
    setPreset("custom");
    setLocalError("");
  };

  const getEndAt = () => {
    if (preset === "custom" && preservedEndsAt) return preservedEndsAt;
    if (preset === "tonight") {
      const evening = new Date(now);
      evening.setHours(23, 59, 0, 0);
      if (evening.getTime() <= now) evening.setDate(evening.getDate() + 1);
      return evening.toISOString();
    }
    const minutes =
      preset === "hour" || preset === "busy" ? 60 : Number(customMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
      throw new Error("Choose a duration from 5 to 1440 minutes.");
    }
    return new Date(now + minutes * 60_000).toISOString();
  };

  const save = async () => {
    setLocalError("");
    try {
      const presetTitle =
        preset === "hour"
          ? "Free for 1 hr"
          : preset === "tonight"
            ? "Free tonight"
            : preset === "busy"
              ? "Busy"
              : available
                ? "Free to hang"
                : "Busy";
      await onSave({
        title: title.trim() || presetTitle,
        available,
        endsAt: getEndAt(),
      });
    } catch (failure) {
      setLocalError(
        failure instanceof Error && failure.message.trim()
          ? failure.message
          : "Could not save your status. Try again.",
      );
    }
  };

  const clear = async () => {
    setLocalError("");
    try {
      await onClear();
    } catch (failure) {
      setLocalError(
        failure instanceof Error && failure.message.trim()
          ? failure.message
          : "Could not clear your status. Try again.",
      );
    }
  };

  return (
    <>
      <Card style={{ gap: space.md, padding: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          accessibilityLabel={
            status ? "Edit your status" : "Share what you are up to"
          }
          onPress={status ? beginEdit : beginCreate}
          style={{
            minHeight: tokens.layout.minTapTarget,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
          }}
        >
          <ProfileAvatar profile={profile} size={48} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text
              style={{
                color: colors.textSecondary,
                ...type.caption,
                fontWeight: "700",
              }}
            >
              YOUR STATUS
            </Text>
            <Text
              numberOfLines={2}
              style={{ color: colors.textPrimary, ...type.headline }}
            >
              {status?.title ||
                (status
                  ? status.available
                    ? "Free to hang"
                    : "Busy"
                  : "What are you up to?")}
            </Text>
          </View>
          {status ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={status.available ? "Available" : "Busy"}
              style={{
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.circle,
                backgroundColor: token.tint,
              }}
            >
              <AvailabilityIcon size={20} color={token.color} />
            </View>
          ) : (
            <Circle size={14} color={colors.textSecondary} />
          )}
        </Pressable>

        {status ? (
          <View style={{ gap: space.xs }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
              }}
            >
              <Chip
                label={status.available ? "Available" : "Busy"}
                icon={<AvailabilityIcon size={15} color={token.color} />}
                selected
                onPress={() => undefined}
                accessibilityRole="text"
                accessibilityState={{ disabled: true }}
                disabled
              />
              {timeLabel ? (
                <View
                  style={{
                    minHeight: tokens.layout.minTapTarget,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.xs,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <Clock3 size={14} color={colors.textSecondary} />
                  <Text
                    style={{ color: colors.textSecondary, ...type.caption }}
                  >
                    {remainingLabel} · {timeLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.textSecondary, ...type.caption }}>
              Availability only. This does not RSVP you to a Beacon.
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, ...type.secondary }}>
            Let your people know when you are free or busy.
          </Text>
        )}

        {status ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <SecondaryButton
                title="Edit"
                disabled={saving}
                icon={<Sparkles size={16} color={colors.textPrimary} />}
                compact
                style={{ flex: 1 }}
                onPress={beginEdit}
              />
              <SecondaryButton
                title="Clear"
                disabled={saving}
                icon={<Trash2 size={16} color={colors.danger} />}
                compact
                style={{ flex: 1 }}
                onPress={() => void clear()}
              />
            </View>
            <SecondaryButton
              title="Turn into a Beacon"
              disabled={saving}
              compact
              onPress={onConvert}
            />
            {localError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.danger, ...type.caption }}
              >
                {localError}
              </Text>
            ) : null}
          </View>
        ) : (
          <PrimaryButton
            title="Share your status"
            disabled={saving}
            onPress={beginCreate}
          />
        )}
      </Card>

      <Sheet
        title={status ? "Edit your status" : "Share your status"}
        visible={editorVisible}
        onClose={onCloseEditor}
      >
        <View style={{ gap: space.md }}>
          <Text style={{ color: colors.textSecondary, ...type.secondary }}>
            Share availability only. This will not RSVP you to a Beacon.
          </Text>
          <Field
            label="Status note"
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              setTitleTouched(true);
            }}
            placeholder={
              available ? "Free for a walk or coffee" : "Taking a quiet night"
            }
            maxLength={120}
            returnKeyType="done"
          />
          <View style={{ gap: space.xs }}>
            <Text
              style={{
                color: colors.textSecondary,
                ...type.secondary,
                fontWeight: "600",
              }}
            >
              Availability
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Chip
                label="Free"
                selected={available}
                onPress={() => chooseAvailability(true)}
              />
              <Chip
                label="Busy"
                selected={!available}
                onPress={() => chooseAvailability(false)}
              />
            </View>
          </View>
          <View style={{ gap: space.xs }}>
            <Text
              style={{
                color: colors.textSecondary,
                ...type.secondary,
                fontWeight: "600",
              }}
            >
              Quick duration
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}
            >
              <Chip
                label="Free for 1 hr"
                selected={preset === "hour"}
                onPress={() => choosePreset("hour")}
              />
              <Chip
                label="Free tonight"
                selected={preset === "tonight"}
                onPress={() => choosePreset("tonight")}
              />
              <Chip
                label="Busy"
                selected={preset === "busy"}
                onPress={() => choosePreset("busy")}
              />
              <Chip
                label="Custom"
                selected={preset === "custom"}
                onPress={() => choosePreset("custom")}
              />
            </View>
          </View>
          {preset === "custom" ? (
            <Field
              label="Duration in minutes (5 to 1440)"
              value={customMinutes}
              onChangeText={(value) => {
                setCustomMinutes(value);
                setPreservedEndsAt(null);
              }}
              keyboardType="number-pad"
              maxLength={4}
            />
          ) : null}
          {localError || error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger, ...type.secondary }}
            >
              {localError || error}
            </Text>
          ) : null}
          <View style={{ gap: space.sm }}>
            <PrimaryButton
              title="Save status"
              loading={saving}
              disabled={saving}
              onPress={() => void save()}
            />
            {status ? (
              <Action
                title="Clear status"
                secondary
                disabled={saving}
                run={clear}
              />
            ) : null}
          </View>
        </View>
      </Sheet>
    </>
  );
}
