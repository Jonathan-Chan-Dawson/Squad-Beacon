import React, { useRef, useState } from "react";
import { router } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ChevronDown,
  Settings2,
  Circle,
  Clock3,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import type { Activity, Audience, Category, Profile } from "@/src/shared/types";
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
import { AudiencePicker, Field, Sheet } from "@/src/shared/ui";
import { radius, space, type } from "@/src/theme/data";
import { statusEndAt, type StatusDraft } from "./statusActions";
import { HomeAction } from "../HomeAction";
import { NoteSpeechBubble } from "./StatusNoteBubble";
import type {
  StatusAttachment,
  StatusPresentation,
} from "../../statusAttachments";
import {
  StatusAttachmentEditor,
  StatusAttachmentPreview,
} from "./StatusAttachmentEditor";
import { resolveStatusAttachment } from "../../statusAttachments";
import { useBeacon } from "@/src/shared/store";
import { eligibleCurrentBeacons } from "../../currentStatusBeacon";
import { BeaconIcon } from "../BeaconIcon";
import { CurrentBeaconPreview } from "./CurrentBeaconPreview";
import { beaconRoleFor } from "../../permissions";

export type FeedStatus = {
  attachment?: StatusAttachment | null;
  presentation?: StatusPresentation;
  sharing?: boolean;
  noteHidden?: boolean;
  showCurrentBeacon?: boolean;
  currentBeaconId?: string | null;
  currentBeacon?: {
    id: string;
    role: "hosting" | "cohosting" | "going";
  } | null;
  id: string;
  title: string;
  available?: boolean | null;
  startsAt: string;
  endsAt: string;
  description?: string;
  category?: Category;
  audience?: Audience;
  audienceId?: string | null;
};

export type FeedStatusSave = StatusDraft;

type DurationPreset = "hour" | "tonight" | "busy" | "custom";

function CurrentBeaconStatusSetting({
  show,
  onShow,
  beaconId,
  onBeaconId,
  chooseSpecific,
  onChooseSpecific,
  options,
  disabled,
}: {
  show: boolean;
  onShow(value: boolean): void;
  beaconId: string | null;
  onBeaconId(value: string | null): void;
  chooseSpecific: boolean;
  onChooseSpecific(value: boolean): void;
  options: Activity[];
  disabled: boolean;
}) {
  const { colors } = useDesignTheme();
  const selected = options.find((activity) => activity.id === beaconId);
  const stale = show && beaconId !== null && !selected;
  const needsSelection =
    show && options.length > 1 && chooseSpecific && beaconId === null;

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 48,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.textPrimary }}>
            Show My Current Beacon
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Share one Beacon you are hosting, co-hosting, or attending.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Show My Current Beacon"
          value={show}
          disabled={disabled}
          onValueChange={onShow}
        />
      </View>
      {show ? (
        <View style={{ gap: 8, paddingLeft: 4 }}>
          {stale ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Your selected Beacon is no longer eligible. Reset it or choose
                an available Beacon.
              </Text>
              <SecondaryButton
                compact
                title="Use Automatically"
                disabled={disabled}
                onPress={() => {
                  onBeaconId(null);
                  onChooseSpecific(false);
                }}
              />
            </View>
          ) : null}
          {options.length > 1 ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.xs,
                }}
              >
                <Chip
                  label="Choose Automatically"
                  selected={!chooseSpecific}
                  disabled={disabled}
                  onPress={() => {
                    onChooseSpecific(false);
                    onBeaconId(null);
                  }}
                />
                <Chip
                  label="Choose a Beacon"
                  selected={chooseSpecific}
                  disabled={disabled}
                  onPress={() => onChooseSpecific(true)}
                />
              </View>
              {chooseSpecific ? (
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 184 }}
                  contentContainerStyle={{ gap: 4 }}
                >
                  {options.map((activity) => {
                    const isSelected = beaconId === activity.id;
                    return (
                      <Pressable
                        key={activity.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected, disabled }}
                        accessibilityLabel={`Choose ${activity.title}`}
                        disabled={disabled}
                        onPress={() => onBeaconId(activity.id)}
                        style={{
                          minHeight: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 8,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.border,
                          backgroundColor: isSelected
                            ? colors.accent + "10"
                            : colors.surfaceRaised,
                        }}
                      >
                        <BeaconIcon
                          category={activity.category}
                          emoji={activity.decoration_emoji}
                          size={26}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: colors.textPrimary,
                            fontSize: 13,
                          }}
                        >
                          {activity.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </>
          ) : options.length === 1 && selected ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Showing {selected.title} while you are there.
            </Text>
          ) : options.length === 1 && beaconId === null ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Automatically show {options[0].title} while you are there.
            </Text>
          ) : options.length === 0 && beaconId === null ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              No eligible Beacon is happening right now.
            </Text>
          ) : null}
          {needsSelection ? (
            <Text
              accessibilityRole="alert"
              style={{ color: colors.textSecondary, fontSize: 12 }}
            >
              Choose a Beacon from the list to continue.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type StatusPanelProps = {
  initialDraft?: StatusDraft;
  advanced?: boolean;
  compact?: boolean;
  avatarControl?: boolean;
  profilePill?: boolean;
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
  onQuick?: () => void;
  onQuickOptions?: () => void;
  quickHint?: string;
  observedNow?: number;
  onAvailability?: () => void;
  availabilityAnchorRef?: React.RefObject<View | null>;
  statusAccessory?: React.ReactNode;
};

export function StatusPanel({
  initialDraft,
  advanced = false,
  compact = false,
  avatarControl = false,
  profilePill = false,
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
  onQuick,
  onQuickOptions,
  quickHint,
  observedNow,
  onAvailability,
  availabilityAnchorRef,
  statusAccessory,
}: StatusPanelProps) {
  const { colors, tokens } = useDesignTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const { data, userId } = useBeacon();
  const supportsAttachments =
    data.is_demo || data.capabilities?.status_attachments === true;
  const supportsCurrentBeacon =
    data.is_demo || data.capabilities?.status_current_beacon === true;
  const tick = useNow();
  const now = Math.max(tick, observedNow ?? 0);
  const currentBeaconOptions = supportsCurrentBeacon
    ? eligibleCurrentBeacons(data, userId, now)
    : [];
  const seededSource = initialDraft?.sourceId
    ? data.activities.find((activity) => activity.id === initialDraft.sourceId)
    : undefined;
  const seededSourceWasLive =
    !!seededSource &&
    Date.parse(seededSource.starts_at) <= now &&
    Date.parse(seededSource.ends_at) > now;
  const futureDraftFromLiveSource =
    !status &&
    seededSourceWasLive &&
    !!initialDraft?.startsAt &&
    Date.parse(initialDraft.startsAt) > now;
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [attachment, setAttachment] = useState<StatusAttachment | null>(
    initialDraft?.attachment ?? null,
  );
  const [presentation, setPresentation] = useState<StatusPresentation>(
    initialDraft?.presentation ?? "text_only",
  );
  const [sharing, setSharing] = useState(initialDraft?.sharing ?? true);
  const [noteHidden, setNoteHidden] = useState(
    initialDraft?.noteHidden ?? false,
  );
  const [showCurrentBeacon, setShowCurrentBeacon] = useState(
    futureDraftFromLiveSource
      ? false
      : (initialDraft?.showCurrentBeacon ?? false),
  );
  const [currentBeaconId, setCurrentBeaconId] = useState<string | null>(
    futureDraftFromLiveSource ? null : (initialDraft?.currentBeaconId ?? null),
  );
  const [chooseSpecificCurrentBeacon, setChooseSpecificCurrentBeacon] =
    useState(!futureDraftFromLiveSource && !!initialDraft?.currentBeaconId);
  const [picking, setPicking] = useState(false);
  const [description, setDescription] = useState(
    initialDraft?.description ?? "",
  );
  const [category, setCategory] = useState<Category>(
    initialDraft?.category ?? "Social",
  );
  const [audience, setAudience] = useState<Audience>(
    initialDraft?.audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    initialDraft?.audienceId ?? null,
  );
  const [settingsOpen, setSettingsOpen] = useState(advanced);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [available, setAvailable] = useState(initialDraft?.available ?? true);
  const [preset, setPreset] = useState<DurationPreset>("custom");
  const [customMinutes, setCustomMinutes] = useState("60");
  const [preservedEndsAt, setPreservedEndsAt] = useState<string | null>(
    initialDraft?.endsAt ?? null,
  );
  const [localError, setLocalError] = useState("");
  const [startsAt, setStartsAt] = useState(initialDraft?.startsAt ?? "");
  const [sourceWasLiveAtEdit, setSourceWasLiveAtEdit] = useState(() => {
    const sourceId = status?.id ?? initialDraft?.sourceId;
    const source = data.activities.find((activity) => activity.id === sourceId);
    const sourceStartsAt = status?.startsAt ?? source?.starts_at;
    const sourceEndsAt = status?.endsAt ?? source?.ends_at;
    return (
      !!sourceStartsAt &&
      !!sourceEndsAt &&
      Date.parse(sourceStartsAt) <= now &&
      Date.parse(sourceEndsAt) > now
    );
  });
  const [timezone, setTimezone] = useState(initialDraft?.timezone ?? "UTC");
  const [placeLabel, setPlaceLabel] = useState(initialDraft?.label ?? "");
  const [latitude, setLatitude] = useState(
    initialDraft?.latitude == null ? "" : String(initialDraft.latitude),
  );
  const [longitude, setLongitude] = useState(
    initialDraft?.longitude == null ? "" : String(initialDraft.longitude),
  );
  const [onlineUrl, setOnlineUrl] = useState(initialDraft?.onlineUrl ?? "");
  const advancedValues = advanced
    ? {
        startsAt,
        timezone,
        label: placeLabel,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        onlineUrl: onlineUrl || null,
        sourceId: initialDraft?.sourceId,
      }
    : {};
  const expiryBase = () =>
    advanced ? Math.max(Date.now(), Date.parse(startsAt)) : Date.now();
  const availability = status?.available ? "available" : "unavailable";
  const token = tokens.availability[availability];
  const AvailabilityIcon = token.icon;
  const statusIsLive =
    !!status &&
    Date.parse(status.startsAt) <= now &&
    Date.parse(status.endsAt) > now &&
    status.sharing !== false;
  const liveStatusColor = statusIsLive ? token.color : colors.textSecondary;
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
  const noteText =
    status &&
    status.sharing !== false &&
    !status.noteHidden &&
    status.presentation !== "activity_only"
      ? status.title.trim()
      : "";
  const savedAttachment = supportsAttachments
    ? resolveStatusAttachment(data, status?.attachment, userId, now)
    : null;
  const featuredAttachment =
    status?.sharing !== false &&
    !status?.noteHidden &&
    status?.presentation !== "text_only"
      ? savedAttachment
      : null;
  const draftAttachment =
    supportsAttachments &&
    sharing &&
    !noteHidden &&
    presentation !== "text_only"
      ? resolveStatusAttachment(data, attachment, userId, now)
      : null;
  const draftNote =
    sharing && !noteHidden && presentation !== "activity_only"
      ? title.trim()
      : "";
  const draftStartsInFuture = Date.parse(startsAt) > now;
  const draftCurrent =
    sharing &&
    showCurrentBeacon &&
    supportsCurrentBeacon &&
    !draftStartsInFuture
      ? currentBeaconId === null
        ? currentBeaconOptions[0]
        : currentBeaconOptions.find((item) => item.id === currentBeaconId)
      : undefined;
  const draftSource = `${userId}:${status?.id ?? initialDraft?.sourceId ?? "new"}`;
  const initializedDraft = useRef<string | null>(
    editorVisible ? draftSource : null,
  );
  const selectedCurrentBeacon = currentBeaconOptions.find(
    (activity) => activity.id === currentBeaconId,
  );
  const staleCurrentBeacon =
    supportsCurrentBeacon &&
    showCurrentBeacon &&
    currentBeaconId !== null &&
    !selectedCurrentBeacon;
  const needsCurrentBeaconSelection =
    supportsCurrentBeacon &&
    showCurrentBeacon &&
    currentBeaconOptions.length > 1 &&
    chooseSpecificCurrentBeacon &&
    currentBeaconId === null;

  const initializeEditor = (editingStatus: FeedStatus | null) => {
    // Reopening the note, picker, or settings resumes this source's draft.
    // A different account/source starts with its own saved values.
    if (initializedDraft.current === draftSource) return;
    initializedDraft.current = draftSource;
    const current = Date.now();
    setTitle(editingStatus?.title ?? "");
    setAttachment(editingStatus?.attachment ?? null);
    setPresentation(editingStatus?.presentation ?? "text_only");
    setSharing(editingStatus?.sharing ?? true);
    setNoteHidden(editingStatus?.noteHidden ?? false);
    setShowCurrentBeacon(editingStatus?.showCurrentBeacon ?? false);
    setCurrentBeaconId(editingStatus?.currentBeaconId ?? null);
    setChooseSpecificCurrentBeacon(!!editingStatus?.currentBeaconId);
    const sourceId = editingStatus?.id ?? initialDraft?.sourceId;
    const source = data.activities.find((activity) => activity.id === sourceId);
    const sourceStartsAt = editingStatus?.startsAt ?? source?.starts_at;
    const sourceEndsAt = editingStatus?.endsAt ?? source?.ends_at;
    setSourceWasLiveAtEdit(
      !!sourceStartsAt &&
        !!sourceEndsAt &&
        Date.parse(sourceStartsAt) <= current &&
        Date.parse(sourceEndsAt) > current,
    );
    setStartsAt(editingStatus?.startsAt ?? initialDraft?.startsAt ?? "");
    setPicking(false);
    setDescription(editingStatus?.description ?? "");
    setCategory(editingStatus?.category ?? "Social");
    setAudience(editingStatus?.audience ?? "friends");
    setAudienceId(editingStatus?.audienceId ?? null);
    setSettingsOpen(advanced);
    setDetailsOpen(false);
    setAvailable(editingStatus?.available ?? true);
    setPreset("custom");
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

  const beginAttach = () => {
    initializeEditor(status);
    setPicking(true);
    if (status) onEdit();
    else onCreate();
    void uiHaptics.light();
  };

  const beginCreate = () => {
    initializeEditor(null);
    setPicking(false);
    onCreate();
    void uiHaptics.light();
  };

  const beginEdit = () => {
    initializeEditor(status);
    setPicking(false);
    onEdit();
    void uiHaptics.light();
  };

  const beginSettings = () => {
    initializeEditor(status);
    setPicking(false);
    setSettingsOpen(true);
    if (status) onEdit();
    else onCreate();
  };

  const openFeaturedActivity = () => {
    // Recheck lifecycle and access immediately before opening the canonical destination.
    const fresh = resolveStatusAttachment(
      data,
      status?.attachment,
      userId,
      Date.now(),
    );
    if (
      !fresh ||
      !status ||
      status.sharing === false ||
      status.noteHidden ||
      status.presentation === "text_only"
    )
      return;
    router.push(
      fresh.type === "beacon"
        ? { pathname: "/activity/[id]", params: { id: fresh.id } }
        : { pathname: "/council/[id]", params: { id: fresh.id } },
    );
  };

  const choosePreset = (next: DurationPreset) => {
    setPreset(next);
    setLocalError("");
    if (next !== "custom") setPreservedEndsAt(null);
    if (next === "hour") {
      setCustomMinutes("60");
    } else if (next === "busy") {
      setCustomMinutes("60");
    }
  };

  const chooseAvailability = (next: boolean) => {
    setAvailable(next);
    setLocalError("");
    void uiHaptics.light();
  };

  const save = async () => {
    setLocalError("");
    try {
      if (
        initializedDraft.current !== null &&
        initializedDraft.current !== draftSource
      ) {
        throw new Error(
          "Your Status changed while editing. Close and reopen the editor before saving.",
        );
      }
      await onSave({
        title: title.trim(),
        attachment,
        presentation,
        sharing,
        noteHidden,
        ...(supportsCurrentBeacon
          ? { showCurrentBeacon, currentBeaconId }
          : {}),
        available,
        endsAt: statusEndAt(
          preset,
          customMinutes,
          preservedEndsAt,
          expiryBase(),
        ),
        description,
        category,
        audience,
        audienceId,
        ...advancedValues,
      });
      initializedDraft.current = null;
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
      initializedDraft.current = null;
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
      {profilePill ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit your status"
          disabled={saving}
          onPress={status ? beginEdit : beginCreate}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 18,
            backgroundColor: colors.surfaceRaised,
            opacity: pressed ? 0.75 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          })}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: liveStatusColor,
            }}
          />
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              color: liveStatusColor,
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            {saving
              ? "Saving…"
              : status
                ? `${Date.parse(status.startsAt) > now ? "Scheduled" : Date.parse(status.endsAt) <= now ? "Ended" : status.available ? "Available" : "Unavailable"}`
                : "Set your availability"}
          </Text>
          <ChevronDown size={13} color={colors.textSecondary} />
        </Pressable>
      ) : avatarControl ? (
        <Pressable
          testID="profile-status-control"
          accessibilityRole="button"
          accessibilityLabel={status ? "Edit your status" : "Share your status"}
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={status ? beginEdit : beginCreate}
          style={{
            minWidth: tokens.layout.minTapTarget,
            minHeight: tokens.layout.minTapTarget,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.surfaceRaised,
              borderWidth: 2,
              borderColor: status ? token.color : colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil
              size={13}
              color={status ? token.color : colors.textPrimary}
            />
          </View>
        </Pressable>
      ) : compact ? (
        <View
          testID="compact-own-status"
          style={{
            padding: 12,
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: 18,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: -8,
              marginBottom: -4,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              MY STATUS
            </Text>
            <View style={{ flexDirection: "row" }}>
              <HomeAction
                label="Status settings"
                onPress={onQuickOptions ?? beginSettings}
                disabled={saving}
                plain
                icon={<Clock3 size={17} color={colors.textSecondary} />}
              />
              <HomeAction
                label="Status options"
                onPress={beginSettings}
                disabled={saving}
                plain
                icon={<Settings2 size={17} color={colors.textSecondary} />}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View testID="own-status-avatar">
              {profile && <ProfileAvatar profile={profile} size={44} />}
            </View>
            <Pressable
              testID="own-status-note"
              accessibilityRole="button"
              disabled={saving}
              accessibilityLabel={
                status ? "Edit your status note" : "Add a status note"
              }
              onPress={status ? beginEdit : beginCreate}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                paddingRight: 22,
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: noteText ? colors.textPrimary : colors.textSecondary,
                  fontSize: 15,
                  lineHeight: 21,
                  fontWeight: noteText ? "500" : "400",
                }}
              >
                {noteText ||
                  (status?.sharing === false
                    ? "Sharing paused"
                    : status?.noteHidden
                      ? "Note hidden"
                      : status?.presentation === "activity_only"
                        ? "Activity only"
                        : "Add a note")}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                {quickHint}
                {status
                  ? ` · ${
                      Date.parse(status.startsAt) > now
                        ? `Scheduled ${new Date(status.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · Until ${new Date(status.endsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : `Until ${timeLabel}`
                    }`
                  : ""}
              </Text>
              <Pencil
                size={14}
                color={colors.textSecondary}
                pointerEvents="none"
                style={{ position: "absolute", right: 0, top: 12 }}
              />
            </Pressable>
          </View>
          {featuredAttachment ? (
            <View
              testID="own-status-featured"
              style={{
                padding: 10,
                borderRadius: 12,
                gap: 8,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 10,
                    fontWeight: "500",
                  }}
                >
                  FEATURED ACTIVITY
                </Text>
                <StatusAttachmentPreview
                  activity={featuredAttachment}
                  compact
                  onPress={openFeaturedActivity}
                />
              </View>
              <HomeAction
                title="Change"
                label="Change attached activity"
                plain
                disabled={saving}
                onPress={beginAttach}
              />
            </View>
          ) : supportsAttachments ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              accessibilityLabel={
                status?.attachment
                  ? "Change attached activity"
                  : "Attach Activity"
              }
              onPress={beginAttach}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.accent, fontSize: 13 }}>
                {!status?.attachment
                  ? "+ Attach activity"
                  : !savedAttachment
                    ? "Activity unavailable · Change"
                    : status.sharing === false
                      ? "Activity attached · sharing paused · Change"
                      : status.noteHidden
                        ? "Activity attached · hidden with note · Change"
                        : "Activity attached · hidden · Change"}
              </Text>
            </Pressable>
          ) : null}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 8,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View ref={availabilityAnchorRef} collapsable={false}>
              <HomeAction
                title={
                  saving
                    ? "Saving…"
                    : status
                      ? Date.parse(status.startsAt) > now
                        ? "Scheduled"
                        : status.sharing === false
                          ? "Paused"
                          : status.available
                            ? "Available"
                            : "Busy"
                      : "Not sharing"
                }
                label="Availability choices"
                primary={!!status?.available && status.sharing !== false}
                tone={statusIsLive ? token : undefined}
                disabled={saving}
                onPress={onAvailability ?? onQuick ?? beginCreate}
                icon={
                  <ChevronDown
                    size={14}
                    color={
                      statusIsLive
                        ? token.color
                        : status?.available && status.sharing !== false
                          ? colors.onAccent
                          : colors.textSecondary
                    }
                  />
                }
                testID="availability-dropdown"
              />
            </View>
            {statusAccessory}
          </View>
        </View>
      ) : (
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
                {noteText ||
                  (status
                    ? status.sharing === false
                      ? "Sharing paused"
                      : status.noteHidden
                        ? "Note hidden"
                        : "No note shared"
                    : "Share a note or Current Beacon")}
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
                  style={{
                    backgroundColor: token.tint,
                    borderColor: token.color,
                    opacity: 1,
                  }}
                  textStyle={{ color: token.color }}
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
        </Card>
      )}

      <Sheet
        title={status ? "Edit your status" : "Share your status"}
        visible={editorVisible}
        onClose={onCloseEditor}
        centered={Platform.OS === "web" && viewportWidth >= 768}
        maxHeightPercent={90}
        footer={
          !picking ? (
            <PrimaryButton
              title="Save Status"
              loading={saving}
              disabled={
                saving || staleCurrentBeacon || needsCurrentBeaconSelection
              }
              onPress={() => void save()}
            />
          ) : undefined
        }
      >
        <View style={{ gap: space.md }}>
          {!picking && (
            <View style={{ gap: 6, alignItems: "center" }}>
              <NoteSpeechBubble>
                <Field
                  label="Activity Note"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  multiline
                  style={{ minHeight: 92, fontSize: 19, lineHeight: 27 }}
                  editable={!saving}
                />
              </NoteSpeechBubble>
              {profile && <ProfileAvatar profile={profile} size={44} />}
              {presentation === "activity_only" ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Your note is retained, but hidden in Activity mode.
                </Text>
              ) : null}
            </View>
          )}
          <StatusAttachmentEditor
            attachment={attachment}
            presentation={presentation}
            disabled={saving}
            picking={picking}
            onPicking={setPicking}
            onAttachment={(value) => {
              setAttachment(value);
              if (value && !attachment && presentation === "text_only")
                setPresentation(
                  title.trim() ? "text_activity" : "activity_only",
                );
            }}
            onPresentation={setPresentation}
          />
          {!picking && supportsCurrentBeacon ? (
            <CurrentBeaconStatusSetting
              show={showCurrentBeacon}
              onShow={setShowCurrentBeacon}
              beaconId={currentBeaconId}
              onBeaconId={setCurrentBeaconId}
              chooseSpecific={chooseSpecificCurrentBeacon}
              onChooseSpecific={setChooseSpecificCurrentBeacon}
              options={currentBeaconOptions}
              disabled={saving}
            />
          ) : null}
          {!picking && (
            <View
              testID="status-draft-preview"
              style={{
                padding: 12,
                gap: 8,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                PREVIEW
              </Text>
              {!sharing ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Sharing paused. Nothing is shared.
                </Text>
              ) : (
                <>
                  {!!draftNote && (
                    <Text
                      testID="draft-preview-note"
                      style={{
                        color: colors.textPrimary,
                        fontSize: 15,
                        lineHeight: 21,
                      }}
                    >
                      {draftNote}
                    </Text>
                  )}
                  {draftAttachment && (
                    <StatusAttachmentPreview
                      activity={draftAttachment}
                      compact
                    />
                  )}
                  {draftCurrent &&
                  !(
                    draftAttachment?.type === "beacon" &&
                    draftAttachment.id === draftCurrent.id
                  ) ? (
                    <CurrentBeaconPreview
                      activity={draftCurrent}
                      role={
                        beaconRoleFor(data, draftCurrent, userId ?? "") ===
                        "owner"
                          ? "hosting"
                          : beaconRoleFor(data, draftCurrent, userId ?? "") ===
                              "coowner"
                            ? "cohosting"
                            : "going"
                      }
                      now={now}
                      compact
                    />
                  ) : draftCurrent ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Featured · Happening now
                    </Text>
                  ) : null}
                  {!draftNote && !draftAttachment && !draftCurrent && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      No note or activity to show.
                    </Text>
                  )}
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {available ? "Available" : "Busy"} ·{" "}
                    {audience === "private"
                      ? "Only you"
                      : "Your selected audience"}
                  </Text>
                  {(draftAttachment || draftCurrent) && (
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Activity access still applies to each viewer.
                    </Text>
                  )}
                  {showCurrentBeacon &&
                    supportsCurrentBeacon &&
                    draftStartsInFuture && (
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 11 }}
                      >
                        Current Beacon will be checked when this Status starts.
                      </Text>
                    )}
                </>
              )}
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                Save Status publishes your changes.
              </Text>
            </View>
          )}
          {!picking && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Status audience, timing and privacy"
              accessibilityState={{ expanded: settingsOpen }}
              onPress={() => setSettingsOpen((value) => !value)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 8,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {available ? "Available" : "Busy"} ·{" "}
                {audience === "friends"
                  ? "Friends"
                  : audience === "private"
                    ? "Only me"
                    : "Selected audience"}{" "}
                ·{" "}
                {preservedEndsAt
                  ? `Until ${new Date(preservedEndsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  : `${customMinutes} min`}{" "}
                · {settingsOpen ? "Fewer settings" : "Settings"}
              </Text>
            </Pressable>
          )}
          <View
            style={{
              display: !picking && settingsOpen ? "flex" : "none",
              gap: space.md,
            }}
          >
            {supportsAttachments && (
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 44,
                  }}
                >
                  <Text style={{ flex: 1, color: colors.textPrimary }}>
                    Pause Status Sharing
                  </Text>
                  <Switch
                    accessibilityLabel="Pause Status Sharing"
                    value={!sharing}
                    disabled={saving}
                    onValueChange={(value) => setSharing(!value)}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 44,
                  }}
                >
                  <Text style={{ flex: 1, color: colors.textPrimary }}>
                    Hide Note
                  </Text>
                  <Switch
                    accessibilityLabel="Hide Note"
                    value={noteHidden}
                    disabled={saving}
                    onValueChange={setNoteHidden}
                  />
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {!sharing
                    ? "Sharing is paused. Your note, featured activity, and Current Beacon are hidden."
                    : noteHidden
                      ? showCurrentBeacon
                        ? "Availability and Current Beacon stay shared. The note and featured activity are hidden."
                        : "Availability stays shared. The note and featured activity are hidden."
                      : "Preview updates here. Save publishes your changes."}
                </Text>
              </View>
            )}
            {supportsAttachments && (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Hide Note hides your note and featured activity. Availability
                and separately enabled Current Beacon sharing stay on. Pause
                Status Sharing hides everything and retains your settings.
                Changes apply when you save.
              </Text>
            )}
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Availability"
              style={{ flexDirection: "row", gap: space.sm }}
            >
              {[true, false].map((choice) => {
                const selected = available === choice;
                const choiceToken =
                  tokens.availability[choice ? "available" : "unavailable"];
                const Icon = choiceToken.icon;
                return (
                  <Pressable
                    key={String(choice)}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    accessibilityState={{ checked: selected, disabled: saving }}
                    accessibilityLabel={choice ? "Available" : "Busy"}
                    disabled={saving}
                    onPress={() => chooseAvailability(choice)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 76,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: selected ? choiceToken.color : colors.border,
                      backgroundColor: selected
                        ? choiceToken.color + "15"
                        : colors.surfaceRaised,
                      padding: space.md,
                      gap: 6,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Icon
                      size={22}
                      color={
                        selected ? choiceToken.color : colors.textSecondary
                      }
                    />
                    <Text
                      style={{ color: colors.textPrimary, ...type.headline }}
                    >
                      {choice ? "Available" : "Busy"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ gap: space.sm }}>
              <SecondaryButton
                compact
                title={
                  detailsOpen ? "Fewer Details" : "More Details & Settings"
                }
                onPress={() => setDetailsOpen((value) => !value)}
              />
              {detailsOpen ? (
                <View style={{ gap: space.sm }}>
                  <Field
                    label="Description"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="A little more about what you are up to"
                    multiline
                  />
                  <Text
                    style={{ color: colors.textSecondary, ...type.secondary }}
                  >
                    Category
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: space.xs,
                    }}
                  >
                    {(
                      [
                        "Fitness",
                        "Study",
                        "Gaming",
                        "Creative",
                        "Social",
                        "Other",
                      ] as const
                    ).map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={category === option}
                        onPress={() => setCategory(option)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
            <View style={{ gap: space.sm }}>
              <Text style={{ color: colors.textSecondary, ...type.secondary }}>
                Visibility
              </Text>
              {advanced ? (
                <AudiencePicker
                  value={audience}
                  id={audienceId}
                  onChange={(value, id) => {
                    setAudience(value);
                    setAudienceId(id);
                  }}
                />
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.xs,
                  }}
                >
                  <Chip
                    label="Friends"
                    selected={audience === "friends"}
                    onPress={() => {
                      setAudience("friends");
                      setAudienceId(null);
                    }}
                  />
                  <Chip
                    label="Only me"
                    selected={audience === "private"}
                    onPress={() => {
                      setAudience("private");
                      setAudienceId(null);
                    }}
                  />
                  {status?.audience &&
                  status.audience !== "friends" &&
                  status.audience !== "private" ? (
                    <Chip
                      label="Existing audience"
                      selected={audience === status.audience}
                      onPress={() => {
                        setAudience(status.audience!);
                        setAudienceId(status.audienceId ?? null);
                      }}
                    />
                  ) : null}
                </View>
              )}
            </View>
            <View style={{ gap: space.xs }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  ...type.secondary,
                  fontWeight: "600",
                }}
              >
                Duration
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.xs,
                }}
              >
                <Chip
                  label="1 Hour"
                  selected={preset === "hour"}
                  disabled={saving}
                  onPress={() => choosePreset("hour")}
                />
                <Chip
                  label="Tonight"
                  selected={preset === "tonight"}
                  disabled={saving}
                  onPress={() => choosePreset("tonight")}
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
            {advanced && detailsOpen ? (
              <View style={{ gap: space.sm }}>
                <Field
                  label="Starts at (ISO date/time with offset)"
                  value={startsAt}
                  onChangeText={(value) => {
                    setStartsAt(value);
                    if (sourceWasLiveAtEdit && Date.parse(value) > Date.now()) {
                      setShowCurrentBeacon(false);
                      setCurrentBeaconId(null);
                      setChooseSpecificCurrentBeacon(false);
                    }
                  }}
                  editable={!saving}
                />
                <Field
                  label="Ends at (ISO date/time with offset)"
                  value={preservedEndsAt ?? ""}
                  onChangeText={(value) => {
                    setPreset("custom");
                    setPreservedEndsAt(value);
                  }}
                  editable={!saving}
                />
                <Field
                  label="Timezone"
                  value={timezone}
                  onChangeText={setTimezone}
                  editable={!saving}
                />
                <Field
                  label="Place label"
                  value={placeLabel}
                  onChangeText={setPlaceLabel}
                  editable={!saving}
                />
                <Field
                  label="Latitude (optional)"
                  value={latitude}
                  onChangeText={setLatitude}
                  editable={!saving}
                />
                <Field
                  label="Longitude (optional)"
                  value={longitude}
                  onChangeText={setLongitude}
                  editable={!saving}
                />
                <Field
                  label="Online destination (optional)"
                  value={onlineUrl}
                  onChangeText={setOnlineUrl}
                  editable={!saving}
                />
              </View>
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
            {status ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear Status"
                  disabled={saving}
                  onPress={() => void clear()}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    flexDirection: "row",
                    gap: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving || pressed ? 0.6 : 1,
                  })}
                >
                  <Trash2 size={16} color={colors.textSecondary} />
                  <Text
                    style={{ color: colors.textSecondary, ...type.caption }}
                  >
                    Clear Status
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create Beacon from Status"
                  disabled={saving}
                  onPress={onConvert}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    flexDirection: "row",
                    gap: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving || pressed ? 0.6 : 1,
                  })}
                >
                  <Sparkles size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, ...type.caption }}>
                    Create Beacon
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {!settingsOpen && !!(localError || error) && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {localError || error}
            </Text>
          )}
        </View>
      </Sheet>
    </>
  );
}
