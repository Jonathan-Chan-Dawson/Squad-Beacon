import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { randomUUID } from "expo-crypto";
import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Vote,
  Radio,
  Zap,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  AudiencePicker,
  Button,
  Chips,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import type { Activity, Audience, Category, Payload } from "@/src/shared/types";
import {
  currentActivity,
  isStatusNote,
  activeAt,
  presenceFor,
  upNext,
} from "../../livingActivity";
import { eligibleCurrentBeacons } from "../../currentStatusBeacon";
import { CurrentBeaconPreview } from "./CurrentBeaconPreview";
import { BeaconIcon } from "../BeaconIcon";
import { NoteSpeechBubble } from "./StatusNoteBubble";
import { ProfileSonarCard } from "@/src/features/profile/components/ProfileSonarCard";
import {
  statusNoteText,
  visibleStatusAttachment,
} from "../../statusAttachments";
import { StatusAttachmentPreview } from "./StatusAttachmentEditor";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";

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
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <BeaconIcon category={draft.category} emoji={draft.emoji} size={48} />
          <View style={{ flex: 1 }}>
            <Txt muted>Share what you’re doing.</Txt>
          </View>
        </View>
        <Field
          label="What are you doing?"
          value={draft.title}
          maxLength={120}
          onChangeText={(title) => update({ title })}
          placeholder="Shooting hoops, studying, taking a walk…"
        />
        <Chips
          options={
            [
              "Fitness",
              "Study",
              "Gaming",
              "Creative",
              "Social",
              "Other",
            ] as const
          }
          value={draft.category}
          onChange={(category) => update({ category })}
        />
        <Field
          label="Emoji · Optional"
          value={draft.emoji}
          maxLength={24}
          onChangeText={(emoji) => update({ emoji })}
          placeholder="Use category artwork, or add an emoji"
        />
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
          <Field
            label="Duration · minutes"
            value={draft.minutes}
            keyboardType="numeric"
            onChangeText={(minutes) => update({ minutes })}
          />
        )}
        <AudiencePicker
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
        <Button
          title={busy ? "Saving…" : note ? "Save Changes" : "Share Activity"}
          disabled={busy}
          onPress={() => void save()}
        />
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
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change availability"
        accessibilityState={{ expanded: open, disabled: busy }}
        disabled={busy}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
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
            paddingHorizontal: 9,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
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
          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.ink }}>
            {availability === "available"
              ? "Available"
              : availability === "busy"
                ? "Busy"
                : "Not sharing"}
          </Text>
          <ChevronDown size={13} color={colors.muted} />
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
      style={{ minHeight: 44, alignSelf: "stretch", minWidth: 0 }}
    >
      <NoteSpeechBubble compact tailTowardIdentity>
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
        <View>
          <View
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
          >
            <Pressable
              testID="home-status-avatar"
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={() => router.push("/(tabs)/profile")}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                paddingTop: 4,
              }}
            >
              <ProfileAvatar profile={profile} size={44} />
            </Pressable>
            <Text
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
          </View>
          {noteControl}
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          {renderIdentity?.(availabilityControl)}
          {noteControl}
          {!renderIdentity && availabilityControl}
        </View>
      )}
      <Sheet
        title="Availability & sharing"
        visible={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <Txt muted>Let friends know if you’re free.</Txt>
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
                  minHeight: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  backgroundColor: selected ? tone.tint : "transparent",
                  borderWidth: 1,
                  borderColor: selected ? tone.color + "35" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tone.tint,
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
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 15,
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
        <Txt muted>
          Pause hides your Status Note, Featured, and Current Activity. Sonar
          and Beacon participation stay independent.
        </Txt>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </Sheet>
    </View>
  );
}

export function LivingActivitySection({
  personId,
  showLower = true,
  sonar = true,
}: {
  personId: string;
  showLower?: boolean;
  sonar?: boolean;
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
  const continuation = useRef<(() => void) | null>(null);
  const menuContinuation = useRef<(() => void) | null>(null);
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
  const launch = (kind: "ping" | "council" | "beacon") => {
    setSocial(false);
    if (!current) return;
    const params = {
      activityNoteId: current.activity.id,
      ...(kind !== "beacon" ? { newPing: "yes", creationKind: kind } : {}),
    };
    continuation.current = () =>
      router.push({
        pathname: kind === "beacon" ? "/create" : "/councils",
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
    <View style={{ gap: 12 }}>
      {(own || current) && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.ink }]}>
            Current Activity
          </Text>
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
                    minHeight: 80,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  },
                ]}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    backgroundColor: colors.green + "10",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap size={18} color={colors.green} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.body, { fontWeight: "600" }]}>
                    What are you up to?
                  </Text>
                  <Text style={[styles.muted, { fontSize: 12 }]}>
                    Share what you’re doing right now
                  </Text>
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
            <View style={[surface, { padding: 12, gap: 4 }]}>
              <CurrentBeaconPreview
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
                  backgroundColor: colors.surfaceRaised,
                  borderColor: categoryTone.color + "28",
                  padding: 12,
                  gap: 8,
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
                    minHeight: 64,
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <BeaconIcon
                    category={current.activity.category}
                    emoji={current.activity.decoration_emoji}
                    size={46}
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
                    {!!place?.label && (
                      <Text
                        numberOfLines={1}
                        style={[styles.muted, { fontSize: 12 }]}
                      >
                        {place.label}
                      </Text>
                    )}
                    <Text style={[styles.muted, { fontSize: 12 }]}>
                      Until{" "}
                      {new Date(current.activity.ends_at).toLocaleTimeString(
                        [],
                        { hour: "numeric", minute: "2-digit" },
                      )}
                    </Text>
                    {!!current.activity.description && (
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
      <Sheet
        title="Activity Note"
        visible={menu}
        onDismiss={() => {
          const callback = menuContinuation.current;
          menuContinuation.current = null;
          callback?.();
        }}
        onClose={() => setMenu(false)}
      >
        {options.length > 0 && (
          <Button
            secondary
            title="Switch to live Beacon"
            onPress={() => {
              menuContinuation.current = () => setChoose(true);
              setMenu(false);
            }}
          />
        )}
        <Button
          secondary
          title="End Activity"
          disabled={busy}
          onPress={() =>
            current &&
            void perform("end_activity_note", { id: current.activity.id })
          }
        />
      </Sheet>
      <Sheet
        title="Do with others"
        visible={social}
        onDismiss={() => {
          const callback = continuation.current;
          continuation.current = null;
          callback?.();
        }}
        onClose={() => setSocial(false)}
      >
        <Txt muted>
          Planning something ahead keeps your current activity active.
        </Txt>
        {[
          ["ping", "See who’s interested", "Create Ping"],
          ["council", "Decide together", "Create Council · Vote or Draw"],
          ["beacon", "Invite people to join", "Create Beacon"],
        ].map(([kind, title, detail]) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => launch(kind as "ping" | "council" | "beacon")}
            style={{
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {kind === "ping" ? (
                <Send size={21} color={colors.green} />
              ) : kind === "council" ? (
                <Vote size={21} color={colors.green} />
              ) : (
                <Radio size={21} color={colors.green} />
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt>{title}</Txt>
              <Txt muted>{detail}</Txt>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Sheet>
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
