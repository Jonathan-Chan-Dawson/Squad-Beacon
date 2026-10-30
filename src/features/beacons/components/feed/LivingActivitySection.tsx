import { ActivityCategoryChoices } from "../ActivityCategoryChoices";
import { GuestShareButton } from "@/src/features/sharing/GuestShareSheet";
import { DurationControl } from "@/src/shared/DurationControl";
import {canReadPlanningThread} from "@/src/features/planning/domain";
import { ProfileSonarCard } from "@/src/features/profile/components/ProfileSonarCard";
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
  presenceFor,
  upNext,
} from "../../livingActivity";
import {
  statusNoteText,
  visibleStatusAttachment,
} from "../../statusAttachments";
import { BeaconIcon } from "../BeaconIcon";
import { CurrentBeaconPreview } from "./CurrentBeaconPreview";
import { StatusAttachmentPreview } from "./StatusAttachmentEditor";
import { NoteSpeechBubble } from "./StatusNoteBubble";

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
}: {
  visible: boolean;
  note?: Activity;
  onClose(): void;
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
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  };
  return (
    <Sheet
      title={note ? "Edit Activity Note" : "What are you doing?"}
      centered
      maxHeightPercent={92}
      footer={<View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Button secondary title="Cancel" disabled={busy} onPress={onClose} /></View><View style={{ flex: 2 }}><Button title={busy ? "Saving…" : note ? "Save Changes" : "Share Activity"} disabled={busy} onPress={() => void save()} /></View></View>}
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
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
    </Sheet>
  );
}

export function LivingStatusHeader({
  onEditStatus,
  variant = "profile",
  renderIdentity,
}: {
  onEditStatus(): void;
  variant?: "compact" | "profile";
  renderIdentity?: (availability: React.ReactNode) => React.ReactNode;
}) {
  const { data, userId, act } = useBeacon();
  const now = useNow(1000);
  const availabilityAnchor = useRef<View>(null);
  const viewport = useWindowDimensions();
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const { colors, styles, tokens } = useTheme();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialPresence = userId ? presenceFor(data, userId) : undefined;
  const [audience, setAudience] = useState<Audience>(
    initialPresence?.availability_audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    initialPresence?.availability_audience_id ?? null,
  );
  const [minutes, setMinutes] = useState("60");
  const [settings, setSettings] = useState(false);
  if (!userId) return null;
  const presence = presenceFor(data, userId);
  const status = data.activities
    .filter((a) => a.owner_id === userId && isStatusNote(a) && activeAt(a, now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const text = statusNoteText(status);
  const availability = presence
    ? !presence.availability_until ||
      Date.parse(presence.availability_until) > now
      ? presence.availability
      : null
    : status?.available === true
      ? "available"
      : status?.available === false
        ? "busy"
        : null;
  const setPresence = async (payload: Payload) => {
    setBusy(true);
    setError("");
    try {
      if (
        Object.hasOwn(payload, "availability") &&
        (!Number.isInteger(Number(minutes)) ||
          Number(minutes) < 5 ||
          Number(minutes) > 1440)
      )
        throw new Error("Choose a duration from 5 to 1440 minutes.");
      if (Object.hasOwn(payload, "availability"))
        payload.availability_until = new Date(
          now + Number(minutes) * 60000,
        ).toISOString();
      await act("update_presence", payload);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update sharing.");
    } finally {
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
        flexShrink: variant === "compact" ? 1 : 0,
        minWidth: 0,
      }}
    >
      <Pressable
        accessibilityRole="button"
        ref={availabilityAnchor}
        accessibilityLabel="Change availability"
        accessibilityState={{ expanded: open, disabled: busy }}
        disabled={busy}
        onPress={() => availabilityAnchor.current?.measureInWindow((x, y, width, height) => {
          setAnchor({ x, y, width, height });
          setOpen(true);
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
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: availabilityTone.color,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: colors.ink,
              flexShrink: 1,
            }}
          >
            {availability === "available"
              ? variant === "compact"
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
  const noteControl = (
    <Pressable
      testID="living-status-message"
      accessibilityRole="button"
      accessibilityLabel="Edit Status Note"
      onPress={onEditStatus}
      style={{
        minHeight: 44,
        alignSelf: "stretch",
        minWidth: 0,
        justifyContent: "center",
      }}
    >
      <NoteSpeechBubble
        compact
        tailTowardIdentity
        dense={variant === "compact"}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            style={[
              styles.body,
              {
                flex: 1,
                minWidth: 0,
                fontSize: variant === "compact" ? 13 : 14,
                lineHeight: 20,
                color: text ? colors.ink : colors.muted,
              },
            ]}
          >
            {text || "Add a status message…"}
          </Text>
          <Pencil size={15} color={colors.muted} />
        </View>
      </NoteSpeechBubble>
    </Pressable>
  );
  const profile = data.profiles.find((person) => person.id === userId);
  return (
    <View
      testID={
        variant === "compact"
          ? "home-identity-status"
          : "profile-identity-status"
      }
      style={{ gap: 4 }}
    >
      {variant === "compact" ? (
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
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {availabilityControl}
                <ProfileSonarCard compact pill />
              </View>
              {renderIdentity(undefined)}
            </>
          ) : null}
          {noteControl}
          {!renderIdentity && availabilityControl}
        </View>
      )}
      {status && <GuestShareButton label="Share selected Status Note" kind="status" target={status.id} title="A note from Squad Beacon" statusText={status.title} expiresAt={status.ends_at} readOnly />}
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
    </View>
  );
}

export function LivingActivitySection({
  personId,
  showLower = true,
  sonar = false,
  compact = false,
}: {
  personId: string;
  showLower?: boolean;
  sonar?: boolean;
  compact?: boolean;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow(1000);
  const { colors, styles, tokens } = useTheme();
  const own = userId === personId;
  const current = currentActivity(data, personId, userId, now);
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
  return (
    <View style={{ gap: compact ? 4 : 12 }}>
      {(own || current) && (
        <View style={{ gap: 8 }}>
          {(!compact || current) && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {compact && <Zap size={14} color={colors.green} />}
              <Text style={[styles.label, { color: colors.ink }]}>
                Current Activity
              </Text>
            </View>
          )}
          {!current && own ? (
            <View style={{ gap: 4 }}>
              <Pressable
                testID="add-activity-note"
                accessibilityRole="button"
                accessibilityLabel="Add Activity Note"
                onPress={() => {
                  setEditorSource(undefined);
                  setEditor(true);
                }}
                style={[
                  surface,
                  {
                    minHeight: compact ? 48 : 80,
                    padding: compact ? 8 : 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: compact ? 8 : 12,
                  },
                ]}
              >
                <View
                  style={{
                    width: compact ? 24 : 34,
                    height: compact ? 24 : 34,
                    borderRadius: 11,
                    backgroundColor: colors.green + "10",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap size={18} color={colors.green} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      styles.body,
                      {
                        fontWeight: "600",
                        ...(compact ? { fontSize: 14 } : {}),
                      },
                    ]}
                  >
                    What are you up to?
                  </Text>
                  {!compact && (
                    <Text style={[styles.muted, { fontSize: 12 }]}>
                      Share what you’re doing right now
                    </Text>
                  )}
                </View>
                <Plus size={18} color={colors.muted} />
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
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    Choose live Beacon ›
                  </Text>
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
              {own && (
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
                {own && (
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
      {showLower && <LivingActivityHighlights personId={personId} />}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
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
        {options.map((a) => (
          <Button
            key={a.id}
            secondary={selection !== a.id}
            title={a.title}
            onPress={() => setSelection(a.id)}
          />
        ))}
        {selection && (
          <>
            <Txt muted>
              This replaces your Current Activity. An active Activity Note will
              end and stay in your private history. Only people in this audience
              who can access the Beacon can see it.
            </Txt>
            <AudiencePicker
              value={currentAudience}
              id={currentAudienceId}
              onChange={(audience, id) => {
                setCurrentAudience(audience);
                setCurrentAudienceId(id);
              }}
            />
            <Button
              title="Use as My Current Activity"
              disabled={busy}
              onPress={() =>
                void perform("update_presence", {
                  show_current_beacon: true,
                  current_beacon_id: selection,
                  current_audience: currentAudience,
                  current_audience_id: currentAudienceId,
                })
              }
            />
          </>
        )}
        {current?.type === "beacon" && (
          <Button
            secondary
            title="Stop sharing Current Beacon"
            onPress={() =>
              void perform("update_presence", { show_current_beacon: false })
            }
          />
        )}
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

export function LivingActivityHighlights({ personId }: { personId: string }) {
  const { data, userId } = useBeacon();
  const now = useNow(1000);
  const current = currentActivity(data, personId, userId, now);
  const status = data.activities
    .filter(
      (a) => a.owner_id === personId && isStatusNote(a) && activeAt(a, now),
    )
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const featured = visibleStatusAttachment(data, status, userId, now);
  const next = personId === userId ? upNext(data, userId, now) : null;
  return (
    <View style={{ gap: 12 }}>
      {featured &&
        !(
          current?.type === "beacon" &&
          featured.type === "beacon" &&
          featured.id === current.activity.id
        ) && (
          <View style={{ gap: 6 }}>
            <Txt muted>Featured</Txt>
            <StatusAttachmentPreview
              compact
              activity={featured}
              onPress={() =>
                router.push({
                  pathname:
                    featured.type === "beacon"
                      ? "/activity/[id]"
                      : "/council/[id]",
                  params: { id: featured.id },
                })
              }
            />
          </View>
        )}
      {next && (
        <View style={{ gap: 6 }}>
          <Txt muted>Up Next · Only you</Txt>
          <StatusAttachmentPreview
            compact
            activity={next}
            onPress={() =>
              router.push({
                pathname:
                  next.type === "beacon" ? "/activity/[id]" : "/council/[id]",
                params: { id: next.id },
              })
            }
          />
        </View>
      )}
    </View>
  );
}
