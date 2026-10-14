import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Circle, Clock3, Pencil, Sparkles, Trash2 } from "lucide-react-native";
import type { Audience, Category, Profile } from "@/src/shared/types";
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
import { Action, AudiencePicker, Field, Sheet } from "@/src/shared/ui";
import { radius, space, type } from "@/src/theme/data";
import { statusEndAt, type StatusDraft } from "./statusActions";

export type FeedStatus = {
  id: string;
  title: string;
  available: boolean;
  startsAt: string;
  endsAt: string;
  description?: string;
  category?: Category;
  audience?: Audience;
  audienceId?: string | null;
};

export type FeedStatusSave = StatusDraft;

type DurationPreset = "hour" | "tonight" | "busy" | "custom";

export type StatusPanelProps = {
  initialDraft?: StatusDraft;
  advanced?: boolean;
  compact?: boolean;
  avatarControl?: boolean;
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
  initialDraft,
  advanced = false,
  compact = false,
  avatarControl = false,
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
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [category, setCategory] = useState<Category>(initialDraft?.category ?? "Social");
  const [audience, setAudience] = useState<Audience>(initialDraft?.audience ?? "friends");
  const [audienceId, setAudienceId] = useState<string | null>(initialDraft?.audienceId ?? null);
  const [noteOpen, setNoteOpen] = useState(advanced);
  const [available, setAvailable] = useState(initialDraft?.available ?? true);
  const [preset, setPreset] = useState<DurationPreset>("custom");
  const [customMinutes, setCustomMinutes] = useState("60");
  const [preservedEndsAt, setPreservedEndsAt] = useState<string | null>(initialDraft?.endsAt ?? null);
  const [titleTouched, setTitleTouched] = useState(!!initialDraft?.title);
  const [localError, setLocalError] = useState("");
  const [startsAt, setStartsAt] = useState(initialDraft?.startsAt ?? "");
  const [timezone, setTimezone] = useState(initialDraft?.timezone ?? "UTC");
  const [placeLabel, setPlaceLabel] = useState(initialDraft?.label ?? "");
  const [latitude, setLatitude] = useState(initialDraft?.latitude == null ? "" : String(initialDraft.latitude));
  const [longitude, setLongitude] = useState(initialDraft?.longitude == null ? "" : String(initialDraft.longitude));
  const [onlineUrl, setOnlineUrl] = useState(initialDraft?.onlineUrl ?? "");
  const advancedValues = advanced ? { startsAt, timezone, label: placeLabel, latitude: latitude.trim() ? Number(latitude) : null, longitude: longitude.trim() ? Number(longitude) : null, onlineUrl: onlineUrl || null, sourceId: initialDraft?.sourceId } : {};
  const expiryBase = () => advanced ? Math.max(Date.now(), Date.parse(startsAt)) : Date.now();
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
    setDescription(editingStatus?.description ?? "");
    setCategory(editingStatus?.category ?? "Social");
    setAudience(editingStatus?.audience ?? "friends");
    setAudienceId(editingStatus?.audienceId ?? null);
    setNoteOpen(false);
    setAvailable(editingStatus?.available ?? true);
    setPreset("custom");
    setTitleTouched(!!editingStatus?.title);
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
        endsAt: statusEndAt(preset, customMinutes, preservedEndsAt, expiryBase()),
        description, category, audience, audienceId, ...advancedValues,
      });
    } catch (failure) {
      setLocalError(
        failure instanceof Error && failure.message.trim()
          ? failure.message
          : "Could not save your status. Try again.",
      );
    }
  };

  const quickAvailability = async (next: boolean) => {
    if (saving) return;
    if (noteOpen) { chooseAvailability(next); return; }
    setLocalError("");
    setAvailable(next);
    const quickTitle = titleTouched ? title.trim() : next ? "Free to hang" : "Busy";
    setTitle(quickTitle);
    try {
      await onSave({ title: quickTitle || (next ? "Free to hang" : "Busy"), available: next,
        endsAt: statusEndAt(preset, customMinutes, preservedEndsAt, expiryBase()), description, category, audience, audienceId, ...advancedValues });
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : "Could not update your availability. Try again.");
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
      {avatarControl ? <Pressable testID="profile-status-control" accessibilityRole="button"
        accessibilityLabel={status ? "Edit your status" : "Share your status"} accessibilityState={{ disabled: saving }}
        disabled={saving} onPress={status ? beginEdit : beginCreate}
        style={{ minWidth: tokens.layout.minTapTarget, minHeight: tokens.layout.minTapTarget, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: status ? token.color : colors.border, alignItems: "center", justifyContent: "center" }}>
          <Pencil size={13} color={status ? token.color : colors.textPrimary} />
        </View>
      </Pressable> : compact ? <Pressable accessibilityRole="button" disabled={saving}
        accessibilityLabel={status ? "Edit your status" : "Share your status"}
        onPress={status ? beginEdit : beginCreate}
        style={{ minHeight: tokens.layout.minTapTarget, padding: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
        <ProfileAvatar profile={profile} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textSecondary, ...type.caption }}>Your status{status ? ` · ${status.available ? "Available" : "Busy"}${timeLabel ? ` · ${timeLabel}` : ""}` : ""}</Text>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, ...type.secondary }}>{status?.title || "Share what you are up to"}</Text>
        </View>
        <Sparkles size={16} color={colors.accent} />
      </Pressable> : <Card style={{ gap: space.md, padding: space.md }}>
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
              title="Create Beacon from Status"
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
      </Card>}

      <Sheet
        title={status ? "Edit your status" : "Share your status"}
        visible={editorVisible}
        onClose={onCloseEditor}
      >
        <View style={{ gap: space.md }}>
          <Text style={{ color: colors.textSecondary, ...type.secondary }}>
            Share availability only. This will not RSVP you to a Beacon.
          </Text>
          <SecondaryButton compact disabled={saving} title={noteOpen ? "Hide Activity Note" : status ? "Edit Activity Note" : "Add Activity Note"} onPress={() => setNoteOpen((current) => !current)} />
          {noteOpen ? <View style={{ gap: space.sm }}><Field
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
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="A little more about what you are up to" multiline />
          <Text style={{ color: colors.textSecondary, ...type.secondary }}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {(["Fitness", "Study", "Gaming", "Creative", "Social", "Other"] as const).map((option) => <Chip key={option} label={option} selected={category === option} onPress={() => setCategory(option)} />)}
          </View>
          <Text style={{ color: colors.textSecondary, ...type.secondary }}>Share with</Text>
          {advanced ? <AudiencePicker value={audience} id={audienceId} onChange={(value, id) => { setAudience(value); setAudienceId(id); }} /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            <Chip label="Friends" selected={audience === "friends"} onPress={() => { setAudience("friends"); setAudienceId(null); }} />
            <Chip label="Only me" selected={audience === "private"} onPress={() => { setAudience("private"); setAudienceId(null); }} />
            {status?.audience && status.audience !== "friends" && status.audience !== "private" ? <Chip label="Existing audience" selected={audience === status.audience} onPress={() => { setAudience(status.audience!); setAudienceId(status.audienceId ?? null); }} /> : null}
          </View>}</View> : null}
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
                disabled={saving}
                onPress={() => void quickAvailability(true)}
              />
              <Chip
                label="Busy"
                selected={!available}
                disabled={saving}
                onPress={() => void quickAvailability(false)}
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
                disabled={saving}
                onPress={() => choosePreset("hour")}
              />
              <Chip
                label="Free tonight"
                selected={preset === "tonight"}
                disabled={saving}
                onPress={() => choosePreset("tonight")}
              />
              <Chip
                label="Busy"
                selected={preset === "busy"}
                disabled={saving}
                onPress={() => choosePreset("busy")}
              />
              <Chip
                label="Custom"
                selected={preset === "custom"}
                disabled={saving}
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
          {advanced ? <View style={{ gap: space.sm }}>
            <Field label="Starts at (ISO date/time with offset)" value={startsAt} onChangeText={setStartsAt} editable={!saving} />
            <Field label="Ends at (ISO date/time with offset)" value={preservedEndsAt ?? ""} onChangeText={(value) => { setPreset("custom"); setPreservedEndsAt(value); }} editable={!saving} />
            <Field label="Timezone" value={timezone} onChangeText={setTimezone} editable={!saving} />
            <Field label="Place label" value={placeLabel} onChangeText={setPlaceLabel} editable={!saving} />
            <Field label="Latitude (optional)" value={latitude} onChangeText={setLatitude} editable={!saving} />
            <Field label="Longitude (optional)" value={longitude} onChangeText={setLongitude} editable={!saving} />
            <Field label="Online destination (optional)" value={onlineUrl} onChangeText={setOnlineUrl} editable={!saving} />
          </View> : null}
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
            {status ? <SecondaryButton title="Create Beacon from Status" disabled={saving} onPress={onConvert} /> : null}
          </View>
        </View>
      </Sheet>
    </>
  );
}
