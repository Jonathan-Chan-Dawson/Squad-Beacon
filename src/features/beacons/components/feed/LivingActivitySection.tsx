import { DiscoveryBeaconCard } from "@/src/features/discovery/DiscoveryBeaconCard";
import { ActivityCategoryChoices } from "../ActivityCategoryChoices";
import { activeAvailability, availabilityColors } from "../../availability";
import { useAvailabilityNow } from "../../availabilityClock";
import { TimedAvailabilitySheet } from "./TimedAvailabilitySheet";
import { GuestShareButton } from "@/src/features/sharing/GuestShareSheet";
import { DurationControl } from "@/src/shared/DurationControl";
import {canReadPlanningThread} from "@/src/features/planning/domain";
import { ProfileSonarCard } from "@/src/features/profile/components/ProfileSonarCard";
import { SpontaneityEntry } from "../../spontaneity/SpontaneityEntry";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";
import { QuickChoiceDialog } from "@/src/shared/Dialogs";
import { useBeacon } from "@/src/shared/store";
import type { Activity, Audience, Category, Payload } from "@/src/shared/types";
import {
  AudiencePicker,
  Button,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  MoreHorizontal,
  Minus,
  Pencil,
  Plus,
  Radio,
  Send,
  Vote,
  Zap,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { eligibleCurrentBeacons } from "../../currentStatusBeacon";
import {
  activeAt,
  currentActivity,
  isStatusNote,
  ownActivityNote,
  presenceFor,
  upNext,
} from "../../livingActivity";
import {
  eligibleStatusAttachments,
  statusNoteText,
  visibleStatusAttachment,
  type StatusAttachment,
} from "../../statusAttachments";
import { BeaconIcon } from "../BeaconIcon";
import { CurrentBeaconPreview } from "./CurrentBeaconPreview";
import { StatusAttachmentPreview } from "./StatusAttachmentEditor";
import { NoteSpeechBubble } from "./StatusNoteBubble";
import { liveOwnedStatuses, saveOwnStatus } from "./statusActions";

type NoteDraft = {
  id?: string;
  title: string;
  description: string;
  category: Category;
  emoji: string;
  minutes: string;
  endsAt?: string;
  audience: Audience;
  audienceId: string | null;
  label: string;
};
const drafts = new Map<string, NoteDraft>();
const freshDraft = (): NoteDraft => ({
  title: "",
  description: "",
  category: "Social",
  emoji: "",
  minutes: "60",
  audience: "friends",
  audienceId: null,
  label: "",
});

export function ActivityNoteEditor({
  visible,
  note,
  onClose,
  inline = false,
  onBusyChange,
}: {
  visible: boolean;
  note?: Activity;
  onClose(): void;
  inline?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { styles } = useTheme();
  const noteNow = useNow();
  const key = `${userId}:${note?.id ?? "new"}`;
  const initial = (): NoteDraft =>
    drafts.get(key) ??
    (note
      ? {
          id: note.id,
          title: note.title,
          description: note.description ?? "",
          category: note.category,
          emoji: note.decoration_emoji ?? "",
          minutes: "60",
          endsAt: note.ends_at,
          audience: note.audience,
          audienceId: note.audience_id,
          label:
            data.places.find((p) => p.activity_id === note.id)?.label ?? "",
        }
      : {
          ...freshDraft(),
          audience: (() => {
            const value = data.profiles.find(
              (p) => p.id === userId,
            )?.default_audience;
            return value && ["friends", "private"].includes(value)
              ? value
              : "friends";
          })() as Audience,
        });
  const [draft, setDraft] = useState<NoteDraft>(initial);
  const [details, setDetails] = useState(!!note?.description);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ payload: Payload; id: string } | null>(null);
  const update = (value: Partial<NoteDraft>) =>
    setDraft((old) => {
      const next = { ...old, ...value };
      drafts.set(key, next);
      attempt.current = null;
      return next;
    });
  const save = async () => {
    if (busy || !userId || data.viewer_id !== userId) return;
    const epoch = getViewerEpoch();
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      if (!draft.title.trim())
        throw new Error("Tell people what you’re doing.");
      if (
        !draft.endsAt &&
        (!Number.isInteger(Number(draft.minutes)) ||
          Number(draft.minutes) < 5 ||
          Number(draft.minutes) > 1440)
      )
        throw new Error("Choose 5 to 1440 minutes.");
      if (
        !["friends", "private"].includes(draft.audience) &&
        !eligibleDefaultTargets(data, userId, draft.audience).some(
          (t) => t.id === draft.audienceId,
        )
      )
        throw new Error("Choose an audience you can share with.");
      attempt.current ??= {
        id: randomUUID(),
        payload: {
          expected_actor_id: userId,
          id: draft.id,
          title: draft.title.trim(),
          description: draft.description,
          category: draft.category,
          decoration_emoji: draft.emoji || null,
          ends_at:
            draft.endsAt ??
            new Date(Date.now() + Number(draft.minutes) * 60000).toISOString(),
          audience: draft.audience,
          audience_id: draft.audienceId,
          label: draft.label,
          timezone:
            data.profiles.find((p) => p.id === userId)?.timezone ?? "UTC",
        },
      };
      const result = await act(
        "save_activity_note",
        attempt.current.payload,
        attempt.current.id,
      );
      if (epoch !== getViewerEpoch()) return;
      if (
        result.event !== "save_activity_note" ||
        typeof result.id !== "string"
      )
        throw new Error(
          "Your activity could not be verified. Retry with this draft.",
        );
      drafts.delete(key);
      attempt.current = null;
      onClose();
    } catch (failure) {
      if (epoch === getViewerEpoch())
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not save your activity.",
        );
    } finally {
      if (epoch === getViewerEpoch()) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };
  const footer = <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Button secondary title="Cancel" disabled={busy} onPress={onClose} /></View><View style={{ flex: 2 }}><Button title={busy ? "Saving…" : note ? "Save Changes" : "Share Activity"} disabled={busy} onPress={() => void save()} /></View></View>;
  const body = (
      <View style={{ gap: 10 }}>
        <Field
          label="What are you up to?"
          value={draft.title}
          maxLength={120}
          onChangeText={(title) => update({ title })}
          placeholder="Shooting hoops, studying, taking a walk…"
        />
        <ActivityCategoryChoices value={draft.category} onChange={(category, idea) => update({ category, ...(idea && !draft.title.trim() ? { title: idea } : {}) })} />
        {draft.endsAt ? (
          <>
            <Txt muted>
              Until{" "}
              {new Date(draft.endsAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Txt>
            <Button
              compact
              secondary
              title="Change duration"
              onPress={() => update({ endsAt: undefined })}
            />
          </>
        ) : (
          <View style={{ gap: 4 }}><DurationControl value={Number(draft.minutes)} minimum={5} maximum={1440} presets={[15, 30, 60, 120]} onChange={(minutes) => update({ minutes: String(minutes) })} />{Number.isFinite(Number(draft.minutes)) && <Txt muted>Ends at {new Date(noteNow + Number(draft.minutes) * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Txt>}</View>
        )}
        <AudiencePicker
          triggerLabel={`Visible to: ${draft.audience === "friends" ? "Friends" : draft.audience === "private" ? "Only me" : eligibleDefaultTargets(data, userId ?? "", draft.audience).find((row) => row.id === draft.audienceId)?.name ?? "Selected audience"} · Change`}
          value={draft.audience}
          id={draft.audienceId}
          onChange={(audience, audienceId) => update({ audience, audienceId })}
        />
        <Button
          secondary
          compact
          title={details ? "Less details" : "More details"}
          onPress={() => setDetails(!details)}
        />
        {details && (
          <>
            <Field
              label="Emoji · Optional"
              value={draft.emoji}
              maxLength={24}
              onChangeText={(emoji) => update({ emoji })}
              placeholder="Use category artwork, or add an emoji"
            />

            <Field
              label="Description · Optional"
              multiline
              value={draft.description}
              maxLength={2000}
              onChangeText={(description) => update({ description })}
            />
            <Field
              label="Add a place · Optional"
              value={draft.label}
              maxLength={160}
              onChangeText={(label) => update({ label })}
              placeholder="Campus Courts"
            />
            <Txt muted>
              A fixed place for this activity. This does not share your live
              location.
            </Txt>
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

      </View>
  );
  if (inline) return <View style={{ gap: 12 }}>{body}{footer}</View>;
  return (
    <Sheet title={note ? "Edit Activity Note" : "What are you doing?"} centered maxHeightPercent={92} footer={footer} visible={visible} onClose={() => { if (!busy) onClose(); }}>
      {body}
    </Sheet>
  );
}

export function LivingStatusHeader({
  onEditStatus,
  variant = "profile",
  renderIdentity,
  noteAccessory,
  onLegacyAvailability,
}: {
  onEditStatus(): void;
  variant?: "compact" | "profile" | "card";
  renderIdentity?: (availability: React.ReactNode) => React.ReactNode;
  noteAccessory?: React.ReactNode;
  onLegacyAvailability?: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const now = useNow(1000);
  const initialPresence = userId && data.viewer_id === userId ? presenceFor(data, userId) : undefined;
  const availabilityNow = useAvailabilityNow(Date.parse(initialPresence?.availability_until ?? ""));
  const timed = data.is_demo || data.capabilities?.timed_availability === true;
  const availabilityAnchor = useRef<View>(null);
  const viewport = useWindowDimensions();
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const { colors, styles, tokens } = useTheme();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [audience, setAudience] = useState<Audience>(
    initialPresence?.availability_audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    initialPresence?.availability_audience_id ?? null,
  );
  const [minutes, setMinutes] = useState("60");
  const [editorKey, setEditorKey] = useState(0);
  const saving = useRef(false);
  const [settings, setSettings] = useState(false);
  if (!userId) return null;
  const presence = initialPresence;
  const status = data.activities
    .filter((a) => a.owner_id === userId && isStatusNote(a) && activeAt(a, now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const text = statusNoteText(status);
  const availabilityDetail = activeAvailability(presence, availabilityNow);
  const availability = presence
    ? availabilityDetail?.status ?? null
    : status?.available === true
      ? "available"
      : status?.available === false
        ? "busy"
        : null;
  const setPresence = async (payload: Payload) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        !timed && payload.availability &&
        (!Number.isInteger(Number(minutes)) ||
          Number(minutes) < 5 ||
          Number(minutes) > 1440)
      )
        throw new Error("Choose a duration from 5 to 1440 minutes.");
      if (!timed && payload.availability)
        payload.availability_until = new Date(
          now + Number(minutes) * 60000,
        ).toISOString();
      await act("update_presence", payload);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update sharing.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const availabilityTone =
    tokens.availability[
      availability === "available"
        ? "available"
        : availability === "busy"
          ? "unavailable"
          : "unknown"
    ];
  const availabilityControl = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 8,
        flexShrink: variant === "profile" ? 0 : 1,
        minWidth: 0,
      }}
    >
      <Pressable
        accessibilityRole="button"
        ref={availabilityAnchor}
        accessibilityLabel="Change availability"
        accessibilityState={{ expanded: open, disabled: busy }}
        disabled={busy}
        onPress={onLegacyAvailability ?? (() => {
          setError("");
          if (timed) {
            setEditorKey((value) => value + 1);
            setOpen(true);
            return;
          }
          availabilityAnchor.current?.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y, width, height });
            setOpen(true);
          });
        })}
        style={{
          minHeight: 44,
          flexShrink: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          justifyContent: "center",
        }}
      >
        <View
          testID="availability-pill-visual"
          style={{
            minHeight: 30,
            flexShrink: 1,
            paddingHorizontal: variant === "compact" ? 7 : 9,
            flexDirection: "row",
            alignItems: "center",
            gap: variant === "compact" ? 4 : 6,
            borderWidth: 1,
            borderColor: availabilityTone.color + "35",
            backgroundColor: availabilityTone.tint,
            borderRadius: 999,
          }}
        >
          {timed && availability === "available" ? <Check size={13} color={availabilityTone.color} strokeWidth={2.5} /> : timed && availability === "busy" ? <Minus size={13} color={availabilityTone.color} strokeWidth={2.5} /> : <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: availability ? availabilityColors[availability] : availabilityTone.color,
            }}
          />}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: colors.ink,
              flexShrink: 1,
            }}
          >
            {availability === "available"
              ? timed || variant === "compact"
                ? "Free"
                : "Available"
              : availability === "busy"
                ? "Busy"
                : variant === "compact"
                  ? "Hidden"
                  : "Not sharing"}
          </Text>
          {variant !== "compact" && <ChevronDown size={13} color={colors.muted} />}
        </View>
      </Pressable>
      {presence?.sharing === false && <EyeOff size={17} color={colors.muted} />}
    </View>
  );
  const noteContent = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text
        style={[styles.body, {
          flexShrink: 1,
          minWidth: 0,
          fontSize: variant === "compact" ? 13 : 14,
          lineHeight: 20,
          color: text ? colors.ink : colors.muted,
        }]}
      >
        {text || "Add a status message…"}
      </Text>
      <Pencil size={15} color={colors.muted} />
    </View>
  );
  const noteControl = (
    <Pressable
      testID="living-status-message"
      accessibilityRole="button"
      accessibilityLabel="Edit Status Note"
      onPress={onEditStatus}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: "stretch",
        minWidth: 0,
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <NoteSpeechBubble dialogue={variant === "compact" ? "side" : "top"}>
        {noteContent}
      </NoteSpeechBubble>
    </Pressable>
  );
  const profile = data.profiles.find((person) => person.id === userId);
  return (
    <View
      testID={
        variant !== "profile"
          ? "home-identity-status"
          : "profile-identity-status"
      }
      style={{ gap: 4 }}
    >
      {variant === "card" ? (
        <View style={{ padding: 10, gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push("/(tabs)/profile")}>
            <ProfileAvatar profile={profile} size={48} />
          </Pressable>
          <Text style={styles.label}>You</Text>
          {availabilityControl}
          <Pressable testID="living-status-message" accessibilityRole="button" accessibilityLabel="Edit Status Note" onPress={onEditStatus}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text numberOfLines={2} style={[styles.muted, { flex: 1 }]}>{text || "Add a status note"}</Text>
            <Pencil size={15} color={colors.accent} />
          </Pressable>
          <ProfileSonarCard compact pill />
        </View>
      ) : variant === "compact" ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Pressable
            testID="home-status-avatar"
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={() => router.push("/(tabs)/profile")}
            style={{
              minWidth: 76,
              minHeight: 76,
              justifyContent: "center",
            }}
          >
            <ProfileAvatar profile={profile} size={76} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  flex: 1,
                  minWidth: 0,
                  alignSelf: "center",
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.ink,
                }}
              >
                {profile?.name || "Your status"}
              </Text>
              {availabilityControl}
              <ProfileSonarCard compact iconOnly />
            </View>
            {noteControl}
          </View>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          {renderIdentity ? (
            <>
              {renderIdentity(undefined)}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {availabilityControl}
                <ProfileSonarCard compact pill />
              </View>
            </>
          ) : null}
          {noteAccessory ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ flex: 1, minWidth: 0 }}>{noteControl}</View>
              {noteAccessory}
            </View>
          ) : noteControl}
          {!renderIdentity && availabilityControl}
        </View>
      )}
      {status && variant !== "card" && <GuestShareButton label="Share selected Status Note" kind="status" target={status.id} title="A note from Squad Beacon" statusText={status.title} expiresAt={status.ends_at} readOnly />}
      {timed ? (editorKey > 0 && <TimedAvailabilitySheet key={`${userId}:${editorKey}`} current={availabilityDetail} presence={presence} busy={busy} error={error} now={now} visible={open} onClose={() => setOpen(false)} onApply={setPresence} />) : (
      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Dismiss availability menu" onPress={() => setOpen(false)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
        <View role="dialog" accessibilityViewIsModal accessibilityLabel="Availability & sharing" style={{
          position: "absolute",
          top: anchor.y + anchor.height + 2,
          left: Math.max(8, Math.min(anchor.x + anchor.width - 280, viewport.width - Math.min(280, viewport.width - 16) - 8)),
          width: Math.min(280, viewport.width - 16),
          maxHeight: Math.max(120, viewport.height - anchor.y - anchor.height - 18),
          backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
          borderColor: colors.muted + "40", padding: 8,
          boxShadow: "0px 8px 28px rgba(0,0,0,0.25)",
        }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 4 }}>
        <View style={{ gap: 3 }}>
          {(["available", "busy", null] as const).map((value) => {
            const tone =
              tokens.availability[
                value === "available"
                  ? "available"
                  : value === "busy"
                    ? "unavailable"
                    : "unknown"
              ];
            const selected = availability === value;
            const label =
              value === "available"
                ? "Available"
                : value === "busy"
                  ? "Busy"
                  : "Not sharing availability";
            return (
              <Pressable
                key={String(value)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected, disabled: busy }}
                aria-pressed={selected}
                disabled={busy}
                onPress={() =>
                  void setPresence({
                    availability: value,
                    availability_audience: audience,
                    availability_audience_id: audienceId,
                  })
                }
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingVertical: 5,
                  paddingHorizontal: 7,
                  borderRadius: 10,
                  backgroundColor: selected ? tone.tint : "transparent",
                  borderWidth: 1,
                  borderColor: selected ? tone.color + "35" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor:
                        value === null ? "transparent" : tone.color,
                      borderWidth: value === null ? 1.5 : 0,
                      borderColor: tone.color,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 0 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    {label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {value === "available"
                      ? "Open to hanging out"
                      : value === "busy"
                        ? "Doing my own thing"
                        : "Keep availability private"}
                  </Text>
                </View>
                {selected && <Check size={19} color={tone.color} />}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            settings ? "Hide audience & duration" : "Audience & duration"
          }
          accessibilityState={{ expanded: settings }}
          onPress={() => setSettings(!settings)}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>
            Audience & duration
          </Text>
          <ChevronDown
            size={15}
            color={colors.muted}
            style={{ transform: [{ rotate: settings ? "180deg" : "0deg" }] }}
          />
        </Pressable>
        {settings && (
          <>
            <AudiencePicker
              value={audience}
              id={audienceId}
              onChange={(value, id) => {
                setAudience(value);
                setAudienceId(id);
              }}
            />
            <Field
              label="Availability duration · minutes"
              value={minutes}
              keyboardType="numeric"
              onChangeText={setMinutes}
            />
          </>
        )}
        <Button
          secondary
          title={
            presence?.sharing === false ? "Resume Sharing" : "Pause Sharing"
          }
          disabled={busy}
          onPress={() =>
            void setPresence({ sharing: presence?.sharing === false })
          }
        />
        {settings && <Txt muted>
          Pause hides your Status Note, Featured, and Current Activity. Sonar
          and Beacon participation stay independent.
        </Txt>}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        </ScrollView>
        </View>
      </Modal>
      )}
    </View>
  );
}

export function LivingActivitySection({
  personId,
  showLower = true,
  sonar = false,
  compact = false,
  divider = false,
  dashboard = false,
  suggestIdeas = false,
}: {
  personId: string;
  showLower?: boolean;
  sonar?: boolean;
  compact?: boolean;
  divider?: boolean;
  dashboard?: boolean;
  suggestIdeas?: boolean;
}) {
  const { data, userId, act, getViewerEpoch, getCurrentData } = useBeacon();
  const now = useNow(1000);
  const { colors, styles, tokens } = useTheme();
  const own = userId === personId;
  const current = currentActivity(data, personId, userId, now);
  const activeStatus = dashboard ? liveOwnedStatuses(data, own ? userId : null, now)[0] ?? data.activities.find(
    (item) => item.owner_id === personId && isStatusNote(item) && activeAt(item, now),
  ) : undefined;
  const featured = dashboard && presenceFor(data, personId)?.sharing !== false
    ? visibleStatusAttachment(data, activeStatus, userId, now)
    : null;
  const note = own && dashboard ? ownActivityNote(data, personId, now) : undefined;
  const canFeature = data.is_demo || (data.capabilities?.status_attachments && data.capabilities?.status_current_beacon);
  const [manage, setManage] = useState<"home" | "note" | "feature" | "live" | null>(null);
  const featureOptions = manage === "feature" ? eligibleStatusAttachments(data, userId, now) : [];
  const featureBusy = useRef(false);
  const [editorSource, setEditorSource] = useState<Activity | undefined>();
  const [editor, setEditor] = useState(false),
    [menu, setMenu] = useState(false),
    [social, setSocial] = useState(false),
    [choose, setChoose] = useState(false),
    [selection, setSelection] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [details, setDetails] = useState(false);
  const ownerPresence = presenceFor(data, personId);
  const [currentAudience, setCurrentAudience] = useState<Audience>(
    ownerPresence?.current_audience ?? "friends",
  );
  const [currentAudienceId, setCurrentAudienceId] = useState<string | null>(
    ownerPresence?.current_audience_id ?? null,
  );
  const options = own ? eligibleCurrentBeacons(data, userId, now) : [];
  const place = current
    ? data.places.find((p) => p.activity_id === current.activity.id)
    : undefined;
  const perform = async (action: string, payload: Payload) => {
    const epoch = getViewerEpoch();
    setBusy(true);
    setError("");
    try {
      await act(action, payload);
      if (epoch === getViewerEpoch()) {
        setManage(null);
        setMenu(false);
        setChoose(false);
        setSelection(null);
      }
    } catch (e) {
      if (epoch === getViewerEpoch())
        setError(e instanceof Error ? e.message : "Could not update activity.");
    } finally {
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  };
  const saveFeature = async (attachment: StatusAttachment | null) => {
    const snapshot = getCurrentData();
    if (!snapshot || snapshot.viewer_id !== userId || featureBusy.current) return;
    const epoch = getViewerEpoch();
    const time = Date.now();
    const source = liveOwnedStatuses(snapshot, userId, time)[0];
    if (!attachment && !source?.status_attachment) return;
    featureBusy.current = true;
    setBusy(true);
    setError("");
    try {
      const title = source?.own_status_note?.title ?? source?.title ?? "";
      const description = source?.own_status_note?.description ?? source?.description;
      const keepNoteHidden = source?.status_presentation === "activity_only" && !!(title || description);
      await saveOwnStatus(snapshot, userId, {
        sourceId: source?.id,
        attachment,
        presentation: keepNoteHidden || (attachment && !title) ? "activity_only" : attachment ? "text_activity" : "text_only",
        title,
        description,
        available: source?.available ?? false,
        endsAt: source?.ends_at ?? new Date(time + 60 * 60_000).toISOString(),
      }, act, time);
      if (epoch === getViewerEpoch()) setManage(null);
    } catch (failure) {
      if (epoch === getViewerEpoch()) setError(failure instanceof Error ? failure.message : "Could not update your featured activity.");
    } finally {
      featureBusy.current = false;
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  };
  const launch = (kind: "ping" | "council" | "draw" | "beacon") => {
    setSocial(false);
    if (!current) return;
    const params = {
      activityNoteId: current.activity.id,
      ...(kind !== "beacon"
        ? {
            kind:
              kind === "council" ? "vote" : kind === "draw" ? "draw" : "ping",
            sessionId: randomUUID(),
          }
        : {}),
    };
    router.push({
      pathname: kind === "beacon" ? "/create" : "/planning/create",
      params,
    });
  };
  const categoryTone =
    tokens.categories[current?.activity.category ?? "Social"];
  const surface = {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
  };
  const livePicker = (
    <>
      {options.map((item) => (
        <Button key={item.id} secondary={selection !== item.id} title={item.title} onPress={() => setSelection(item.id)} />
      ))}
      {selection && (
        <>
          <Txt muted>An active activity note will end. Only people in this audience who can access the Beacon can see it.</Txt>
          <AudiencePicker value={currentAudience} id={currentAudienceId} onChange={(audience, id) => {
            setCurrentAudience(audience);
            setCurrentAudienceId(id);
          }} />
          <Button title="Use as My Current Activity" disabled={busy} onPress={() => void perform("update_presence", {
            show_current_beacon: true,
            current_beacon_id: selection,
            current_audience: currentAudience,
            current_audience_id: currentAudienceId,
          })} />
        </>
      )}
      {current?.type === "beacon" && (
        <Button secondary title="Stop sharing Current Beacon" disabled={busy} onPress={() => void perform("update_presence", { show_current_beacon: false })} />
      )}
    </>
  );
  return (
    <View style={{ gap: compact ? 4 : 12 }}>
      {(own || current || featured) && (
        <View
          testID={dashboard || divider ? "current-activity-section" : undefined}
          style={[
            { gap: 8 },
            divider && {
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 8,
            },
          ]}
        >
          {(dashboard || !compact || current) && (
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}
            >
              {compact && <Zap size={14} color={colors.green} />}
              <Text style={[styles.label, { color: colors.ink, marginRight: "auto" }]}>
                Current Activity
              </Text>
              {suggestIdeas && own && <SpontaneityEntry compact />}
              {dashboard && own && (current || featured) && (
                <Button compact secondary title="Edit activity" onPress={() => setManage("home")} />
              )}
            </View>
          )}
          {featured ? (
            <>
              <Txt muted>Featured activity</Txt>
              <StatusAttachmentPreview compact activity={featured} onPress={() => router.push({
                pathname: featured.type === "beacon" ? "/activity/[id]" : "/council/[id]",
                params: { id: featured.id },
              })} />
              {note && <Button compact secondary title="Do with others" onPress={() => setSocial(true)} />}
            </>
          ) : !current && own && dashboard ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add activity"
              onPress={() => setManage("home")}
              style={({ pressed }) => ({
                minHeight: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: colors.surfaceRaised,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent + "20" }}>
                <Plus size={17} color={colors.accent} accessible={false} />
              </View>
              <Text style={[styles.body, { flex: 1, color: colors.muted }]}>Share what you&apos;re up to</Text>
            </Pressable>
          ) : !current && own ? (
            <View>
              <Pressable
                testID="add-activity-note"
                accessibilityRole="button"
                accessibilityLabel="Add Activity Note"
                onPress={() => {
                  setEditorSource(undefined);
                  setEditor(true);
                }}
                style={({ pressed }) => ({
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text style={[styles.body, { flex: 1, fontWeight: "600", fontSize: 14 }]}>
                  What are you up to?
                </Text>
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    borderWidth: 1, borderColor: colors.line, borderRadius: 8,
                    paddingHorizontal: 9, paddingVertical: 5,
                  }}>
                    <Plus size={15} color={colors.accent} />
                    <Text style={[styles.label, { color: colors.accent }]}>Add</Text>
                  </View>
              </Pressable>
              {options.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose live Beacon"
                  onPress={() => setChoose(true)}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    Choose live Beacon
                  </Text>
                  <ChevronRight size={13} color={colors.muted} />
                </Pressable>
              )}
            </View>
          ) : current?.type === "beacon" ? (
            <View style={[surface, { padding: compact ? 8 : 12, gap: 4 }]}>
              <CurrentBeaconPreview
                compact={compact}
                activity={current.activity}
                role={current.role ?? "going"}
                now={now}
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: current.activity.id },
                  })
                }
              />
              {own && !dashboard && (
                <Button
                  compact
                  secondary
                  title="Manage Current Activity"
                  onPress={() => setChoose(true)}
                />
              )}
            </View>
          ) : current ? (
            <View
              testID="activity-note-card"
              style={[
                surface,
                {
                  backgroundColor: compact ? colors.green + "0C" : colors.surfaceRaised,
                  borderColor: categoryTone.color + "28",
                  padding: compact ? 8 : 12,
                  gap: compact ? 4 : 8,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 4,
                  alignItems: "flex-start",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    own
                      ? "Edit Activity Note"
                      : `Open ${current.activity.title}`
                  }
                  onPress={() => {
                    if (own) {
                      if (dashboard) { setManage("home"); return; }
                      setEditorSource(current.activity);
                      setEditor(true);
                    } else setDetails(true);
                  }}
                  style={{
                    flex: 1,
                    minHeight: compact ? 48 : 64,
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <BeaconIcon
                    category={current.activity.category}
                    emoji={current.activity.decoration_emoji}
                    size={compact ? 30 : 46}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={{
                        color: categoryTone.color,
                        fontSize: 11,
                        fontWeight: "500",
                      }}
                    >
                      Solo · {current.activity.category}
                    </Text>
                    <Text style={[styles.body, { fontWeight: "600" }]}>
                      {current.activity.title}
                    </Text>
                    {!compact && !!place?.label && (
                      <Text
                        numberOfLines={1}
                        style={[styles.muted, { fontSize: 12 }]}
                      >
                        {place.label}
                      </Text>
                    )}
                    <Text
                      numberOfLines={compact ? 1 : undefined}
                      style={[styles.muted, { fontSize: 12 }]}
                    >
                      {compact && place?.label ? `${place.label} · ` : ""}Until{" "}
                      {new Date(current.activity.ends_at).toLocaleTimeString(
                        [],
                        { hour: "numeric", minute: "2-digit" },
                      )}
                    </Text>
                    {!compact && !!current.activity.description && (
                      <Text numberOfLines={2} style={styles.muted}>
                        {current.activity.description}
                      </Text>
                    )}
                  </View>
                </Pressable>
                {own && !dashboard && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Activity Note options"
                    onPress={() => setMenu(true)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MoreHorizontal size={20} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              {data.planning_threads.filter(t=>t.source_activity_note_id===current.activity.id && userId && canReadPlanningThread(data,t,userId)).slice(-1).map(t=><Button key={t.id} compact secondary title={`Continue planning: ${t.title}`} onPress={()=>router.push({pathname:"/responses",params:{threadId:t.id}})}/>)}
              {own && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Do with others"
                  onPress={() => setSocial(true)}
                  style={{
                    alignSelf: "flex-end",
                    flexDirection: "row",
                    gap: 8,
                    minHeight: 44,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.green,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    Do with others
                  </Text>
                  <ChevronRight size={16} color={colors.green} />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      )}
      {own && sonar && <ProfileSonarCard compact row />}
      {showLower && <UpNextCard personId={personId} />}
      {!!error && !manage && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {dashboard && own && (
        <Sheet title="What are you up to?" visible={manage !== null} onClose={() => { if (!busy) { setManage(null); setSelection(null); } }}>
          {manage === "home" && (
            <>
              {featured && note && <Txt muted>Your activity note is saved. Clear the feature to show it here.</Txt>}
              <Button secondary title={note ? "Edit activity note" : "Write a quick update"} onPress={() => setManage("note")} />
              {canFeature && <Button secondary title="Feature an activity" onPress={() => setManage("feature")} />}
              {activeStatus?.status_attachment && <Button secondary title="Clear featured activity" disabled={busy} onPress={() => void saveFeature(null)} />}
              {note && <Button secondary title="End activity note" disabled={busy} onPress={() => void perform("end_activity_note", { id: note.id })} />}
              {(options.length > 0 || current?.type === "beacon") && <Button secondary title="Manage live Beacon" onPress={() => setManage("live")} />}
            </>
          )}
          {manage === "note" && <ActivityNoteEditor inline visible note={note} onBusyChange={setBusy} onClose={() => setManage(null)} />}
          {manage === "feature" && (
            <>
              <Button secondary compact title="Back to activity choices" onPress={() => { setManage("home"); setError(""); }} />
              <Txt muted>{presenceFor(data, personId)?.sharing === false || activeStatus?.status_sharing === false || activeStatus?.status_note_hidden
                ? "Your current sharing settings keep this feature hidden."
                : activeStatus ? "Uses your current status audience and expiry." : "Shared with friends for one hour."}</Txt>
              {featureOptions.map((item) => (
                <Button key={`${item.type}:${item.id}`} secondary title={item.title} disabled={busy} onPress={() => void saveFeature({ type: item.type, id: item.id })} />
              ))}
              {!featureOptions.length && <Txt muted>No eligible activities to feature.</Txt>}
            </>
          )}
          {manage === "live" && (
            <>
              <Button secondary compact title="Back to activity choices" onPress={() => { setManage("home"); setSelection(null); }} />
              {livePicker}
            </>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </Sheet>
      )}
      {editor && (
        <ActivityNoteEditor
          key={`${userId}:${editorSource?.id ?? "new"}`}
          visible
          note={editorSource}
          onClose={() => setEditor(false)}
        />
      )}
      <QuickChoiceDialog
        title="Activity Note"
        visible={menu}
        onClose={() => setMenu(false)}
        items={[
          ...(options.length
            ? [
                {
                  label: "Switch to live Beacon",
                  onPress: () => setChoose(true),
                },
              ]
            : []),
          {
            label: "End Activity",
            disabled: busy,
            onPress: () => {
              if (current)
                void perform("end_activity_note", { id: current.activity.id });
            },
          },
        ]}
      />
      <QuickChoiceDialog
        title="Do with others"
        visible={social}
        onClose={() => setSocial(false)}
        description="Planning something ahead keeps your current activity active."
        items={[
          {
            label: "Ping",
            description: "See who’s interested",
            icon: <Send size={21} color={colors.green} />,
            onPress: () => launch("ping"),
          },
          {
            label: "Vote",
            description: "Decide together",
            icon: <Vote size={21} color={colors.green} />,
            onPress: () => launch("council"),
          },
          {
            label: "Draw",
            description: "Let chance choose",
            icon: <Vote size={21} color={colors.green} />,
            onPress: () => launch("draw"),
          },
          {
            label: "Beacon",
            description: "Invite people to join",
            icon: <Radio size={21} color={colors.green} />,
            onPress: () => launch("beacon"),
          },
        ]}
      />
      <Sheet
        title="Choose live Beacon"
        visible={choose}
        onClose={() => {
          if (!busy) {
            setChoose(false);
            setSelection(null);
          }
        }}
      >
        {livePicker}
      </Sheet>
      <Sheet
        title={current?.activity.title ?? "Activity"}
        visible={details && !!current}
        onClose={() => setDetails(false)}
      >
        <Txt>{current?.activity.description}</Txt>
        {!!place?.label && <Txt muted>{place.label}</Txt>}
      </Sheet>
    </View>
  );
}

export function UpNextCard({ personId }: { personId: string }) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  if (personId !== userId || data.viewer_id !== userId) return null;
  const next = upNext(data, userId, now);

  return (
    <View testID="up-next" style={{ gap: 6 }}>
      <Text style={styles.label}>Up Next</Text>
      {next ? (
        <DiscoveryBeaconCard
          density="mini" activityId={next.id}
          title={next.title.replace(/^Plan stop \d+\s*:\s*(?=\S)/i, "")} category={next.category}
          decorationEmoji={next.decoration_emoji} mapIcon={next.map_icon}
          detailsLabel={`Open upcoming Beacon: ${next.title}`}
          whenLabel={new Date(next.starts_at).toLocaleString(undefined, {
            weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })}
          onDetails={() => router.push({ pathname: "/activity/[id]", params: { id: next.id } })}
        />
      ) : (
        <View style={{ gap: 6, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
          <Txt muted>Nothing coming up yet.</Txt>
          <Button compact secondary title="Create Beacon" onPress={() => router.push({ pathname: "/create", params: { editor: "yes" } })} />
        </View>
      )}
    </View>
  );
}
