import { Check, Circle, EyeOff } from "lucide-react-native";
import { ActionRow, ContextMenu } from "@/src/shared/ContextMenu";
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useDesignTheme } from "@/src/shared/design-system";
import { ProfileSonarCard } from "@/src/features/profile/components/ProfileSonarCard";
import { StatusPanel } from "./StatusPanel";
import {
  clearOwnStatuses,
  liveOwnedStatuses,
  saveOwnStatus,
  type StatusDraft,
} from "./statusActions";
import {
  AudiencePicker,
  Button,
  Chips,
  Field,
  Sheet,
  Txt,
} from "@/src/shared/ui";
import DateField from "@/components/DateField";
import type { Activity, Audience } from "@/src/shared/types";
import {
  readViewerDeviceDefaults,
  writeViewerDeviceDefaults,
} from "@/src/features/profile/settings/deviceDefaults";
import type { ViewerDeviceDefaults } from "@/src/features/profile/settings/beaconDefaults";
import {
  durationLabel,
  quickStatusDraft,
  quickStatusMinutes,
  statusAudienceLabel,
  validQuickStatus,
} from "../../quickStatus";
import { canReadBeaconActivity } from "../../beaconModules";

export function useOwnStatusControl() {
  const { data, userId, act } = useBeacon();
  const tick = useNow();
  const [acknowledged, setAcknowledged] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [selectedStatusId, selectStatus] = useState<string | null>(null);
  const now = Math.max(tick, acknowledged);
  const scheduled =
    userId && data.viewer_id === userId
      ? data.activities
          .filter(
            (item) =>
              item.owner_id === userId &&
              item.mode === "solo" &&
              item.status === "scheduled" &&
              Date.parse(item.starts_at) > now &&
              Date.parse(item.ends_at) > Date.parse(item.starts_at) &&
              canReadBeaconActivity(data, item, userId),
          )
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      : [];
  const liveStatus = liveOwnedStatuses(data, userId, now)[0];
  const owned = [...liveOwnedStatuses(data, userId, now), ...scheduled];
  const status = owned.find((item) => item.id === selectedStatusId) ?? owned[0];
  const profile =
    userId && data.viewer_id === userId
      ? data.profiles.find((item) => item.id === userId)
      : undefined;
  const mutate = async (
    value?: StatusDraft,
    target: "selected" | "current" = "selected",
  ) => {
    const source = target === "current" ? liveStatus : status;
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError("");
    try {
      const current = Date.now();
      const result = value
        ? await saveOwnStatus(
            data,
            userId,
            {
              ...value,
              sourceId: value.sourceId ?? source?.id,
              startsAt:
                value.startsAt ??
                (source && Date.parse(source.starts_at) > current
                  ? source.starts_at
                  : undefined),
            },
            act,
            current,
          )
        : await clearOwnStatuses(data, userId, act, current, source?.id);
      setAcknowledged(Date.now());
      selectStatus(null);
      setError(result.message);
      if (result.message) throw new Error(result.message);
      setEditorVisible(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update your status. Try again.",
      );
      throw failure;
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };
  return {
    now,
    status,
    liveStatus,
    scheduled,
    selectStatus,
    profile,
    editorVisible,
    saving,
    error,
    open: () => setEditorVisible(true),
    close: () => {
      if (!saving) setEditorVisible(false);
    },
    save: (value: StatusDraft) => mutate(value),
    clear: () => mutate(),
    saveCurrent: (value: StatusDraft) => mutate(value, "current"),
    clearCurrent: () => mutate(undefined, "current"),
    convert: () => {
      if (!status) return;
      setEditorVisible(false);
      router.push({
        pathname: "/create",
        params: { statusSourceId: status.id },
      });
    },
  };
}

export function SharedStatusControl({
  compact = false,
  avatarControl = false,
  profilePill = false,
}: {
  compact?: boolean;
  avatarControl?: boolean;
  profilePill?: boolean;
}) {
  const { userId } = useBeacon();
  return (
    <SharedStatusContent
      key={userId ?? "signed-out"}
      compact={compact}
      avatarControl={avatarControl}
      profilePill={profilePill}
    />
  );
}

function SharedStatusContent({
  compact,
  avatarControl,
  profilePill,
}: {
  compact: boolean;
  avatarControl: boolean;
  profilePill: boolean;
}) {
  const control = useOwnStatusControl();
  const { colors, tokens } = useDesignTheme();
  const { data, userId } = useBeacon();
  const [preference, setPreference] = useState<{
    owner: string;
    value: ViewerDeviceDefaults["quickStatus"];
  } | null>(null);
  const [setup, setSetup] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const availabilityAnchor = useRef<View>(null);
  const availabilityContinuation = useRef<(() => void) | null>(null);
  const setupContinuation = useRef<(() => void) | null>(null);
  const [setupTarget, setSetupTarget] = useState<"current" | "selected">(
    "current",
  );
  const afterAvailability = (callback: () => void) => {
    availabilityContinuation.current = callback;
    setAvailabilityOpen(false);
  };
  const [nextAvailable, setNextAvailable] = useState(true);
  const [manageScheduled, setManageScheduled] = useState(false);
  const [audience, setAudience] = useState<Audience>("friends");
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("60");
  const [custom, setCustom] = useState(false);
  const [interval, setInterval] = useState(false);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [quickError, setQuickError] = useState("");
  const saved = preference?.owner === userId ? preference.value : undefined;
  useEffect(() => {
    let active = true;
    if (userId)
      void readViewerDeviceDefaults(userId)
        .then((value) => {
          if (active)
            setPreference({ owner: userId, value: value.quickStatus });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);
  const configure = (
    source: Activity | undefined,
    manage = false,
    target: "current" | "selected" = "selected",
  ) => {
    setSetupTarget(target);
    setManageScheduled(manage);
    const value = validQuickStatus(data, userId, saved) ? saved : undefined;
    setAudience(source?.audience ?? value?.audience ?? "friends");
    setAudienceId(source ? source.audience_id : (value?.audienceId ?? null));
    const duration = value?.minutes ?? 60;
    setMinutes(String(duration));
    setCustom(!quickStatusMinutes.some((option) => option === duration));
    const future = !!source && Date.parse(source.starts_at) > Date.now();
    setInterval(future);
    setCustom(
      future || !quickStatusMinutes.some((option) => option === duration),
    );
    setStarts(future ? source!.starts_at : new Date().toISOString());
    setEnds(
      future
        ? source!.ends_at
        : new Date(Date.now() + duration * 60000).toISOString(),
    );
    setQuickError("");
    setSetup(true);
  };
  const publish = async (confirm: boolean, available = nextAvailable) => {
    if (control.saving || !userId) return;
    if (!confirm && !validQuickStatus(data, userId, saved)) {
      configure(control.liveStatus, false, "current");
      return;
    }
    setQuickError("");
    try {
      const choice = confirm
        ? {
            audience,
            audienceId,
            minutes: interval
              ? Math.round((Date.parse(ends) - Date.parse(starts)) / 60000)
              : Number(minutes),
          }
        : saved!;
      if (!validQuickStatus(data, userId, choice))
        throw new Error(
          "Choose a valid audience and duration from 5 to 1440 minutes.",
        );
      const source =
        confirm && setupTarget === "selected"
          ? control.status
          : control.liveStatus;
      const future = !!source && Date.parse(source.starts_at) > Date.now();
      const draft = quickStatusDraft(
        source,
        choice.audience,
        choice.audienceId,
        choice.minutes,
        Date.now(),
        confirm && interval ? starts : future ? source!.starts_at : undefined,
        confirm && interval ? ends : future ? source!.ends_at : undefined,
      );
      draft.available = available;
      if (confirm) {
        draft.audience = choice.audience;
        draft.audienceId = choice.audienceId;
        if (
          source &&
          (source.audience !== choice.audience ||
            source.audience_id !== choice.audienceId)
        ) {
          // Changing availability's audience never grants an old meeting location.
          draft.latitude = null;
          draft.longitude = null;
          draft.label = "";
          draft.onlineUrl = null;
        }
      }
      if (confirm && setupTarget === "selected") await control.save(draft);
      else await control.saveCurrent(draft);
      setSetup(false);
      if (confirm) {
        setPreference({ owner: userId, value: choice });
        try {
          await writeViewerDeviceDefaults(userId, { quickStatus: choice });
        } catch {
          setQuickError(
            "Status shared. This device could not remember your choices.",
          );
        }
      }
    } catch (failure) {
      setQuickError(
        failure instanceof Error
          ? failure.message
          : "Could not share your status.",
      );
    }
  };
  const currentAudience = control.status
    ? statusAudienceLabel(
        data,
        userId,
        control.status.audience,
        control.status.audience_id,
      )
    : saved && validQuickStatus(data, userId, saved)
      ? statusAudienceLabel(data, userId, saved.audience, saved.audienceId)
      : "Friends";
  return (
    <View>
      <StatusPanel
        observedNow={control.now}
        compact={compact}
        avatarControl={avatarControl}
        profilePill={profilePill}
        profile={control.profile}
        status={
          control.status
            ? {
                id: control.status.id,
                attachment: control.status.status_attachment,
                presentation: control.status.status_presentation,
                sharing: control.status.status_sharing,
                noteHidden: control.status.status_note_hidden,
                showCurrentBeacon: control.status.status_show_current_beacon,
                currentBeaconId: control.status.status_current_beacon_id,
                currentBeacon: control.status.status_current_beacon,
                title: control.status.title,
                available: control.status.available,
                startsAt: control.status.starts_at,
                endsAt: control.status.ends_at,
                description: control.status.description,
                category: control.status.category,
                audience: control.status.audience,
                audienceId: control.status.audience_id,
              }
            : null
        }
        editorVisible={control.editorVisible}
        saving={control.saving}
        error={control.error}
        onCreate={control.open}
        onEdit={control.open}
        onCloseEditor={control.close}
        onSave={control.save}
        onClear={control.clear}
        onConvert={control.convert}
        availabilityAnchorRef={availabilityAnchor}
        onAvailability={() => setAvailabilityOpen(true)}
        statusAccessory={compact ? <ProfileSonarCard compact /> : undefined}
        onQuick={() => {
          setNextAvailable(true);
          void publish(false, true);
        }}
        onQuickOptions={() => {
          setNextAvailable(control.status?.available !== false);
          configure(control.status, true);
        }}
        quickHint={`${currentAudience}${!control.status ? ` · ${durationLabel(saved?.minutes ?? 60)}` : ""}`}
      />
      <ContextMenu
        title="Availability"
        visible={availabilityOpen}
        anchorRef={availabilityAnchor}
        mode="dropdown"
        onClose={() => setAvailabilityOpen(false)}
        onDismiss={() => {
          const callback = availabilityContinuation.current;
          availabilityContinuation.current = null;
          callback?.();
        }}
      >
        <Txt muted>
          {control.liveStatus
            ? statusAudienceLabel(
                data,
                userId,
                control.liveStatus.audience,
                control.liveStatus.audience_id,
              )
            : saved && validQuickStatus(data, userId, saved)
              ? statusAudienceLabel(
                  data,
                  userId,
                  saved.audience,
                  saved.audienceId,
                )
              : "Friends"}{" "}
          · {durationLabel(saved?.minutes ?? 60)}
        </Txt>
        <ActionRow
          label="Available"
          selected={control.liveStatus?.available === true}
          detail="Free now"
          icon={<Check size={18} color={colors.accent} />}
          disabled={control.saving}
          onPress={() =>
            afterAvailability(() => {
              setNextAvailable(true);
              void publish(false, true);
            })
          }
        />
        <ActionRow
          label="Busy"
          selected={control.liveStatus?.available === false}
          icon={<Circle size={18} color={colors.textSecondary} />}
          disabled={control.saving}
          onPress={() =>
            afterAvailability(() => {
              setNextAvailable(false);
              void publish(false, false);
            })
          }
        />
        <ActionRow
          label="Not sharing"
          selected={!control.liveStatus}
          icon={<EyeOff size={18} color={colors.textSecondary} />}
          disabled={control.saving}
          onPress={() =>
            afterAvailability(() => {
              void control.clearCurrent().catch(() => {});
            })
          }
        />
        {control.scheduled.length ? (
          <Txt muted>
            {control.scheduled.length} scheduled · managed in Status settings
          </Txt>
        ) : null}
      </ContextMenu>
      <Sheet
        title="Share your availability"
        visible={setup}
        onDismiss={() => {
          const callback = setupContinuation.current;
          setupContinuation.current = null;
          callback?.();
        }}
        onClose={() => {
          if (!control.saving) {
            setSetup(false);
            control.selectStatus(null);
          }
        }}
      >
        <Txt muted>Choose who can see your availability, and for how long.</Txt>
        <AudiencePicker
          value={audience}
          id={audienceId}
          onChange={(value, id) => {
            setAudience(value);
            setAudienceId(id);
          }}
        />
        <Chips
          options={[...quickStatusMinutes.map(durationLabel), "Custom"]}
          value={custom ? "Custom" : durationLabel(Number(minutes))}
          onChange={(label) => {
            setCustom(label === "Custom");
            setInterval(false);
            if (label !== "Custom")
              setMinutes(
                String(
                  quickStatusMinutes.find(
                    (option) => durationLabel(option) === label,
                  ),
                ),
              );
          }}
        />
        {custom ? (
          <View style={{ gap: 10 }}>
            <Chips
              options={["Duration", "From / to"]}
              value={interval ? "From / to" : "Duration"}
              onChange={(value) => setInterval(value === "From / to")}
            />
            {interval ? (
              <>
                <DateField
                  label="Available from"
                  value={starts}
                  onChange={setStarts}
                />
                <DateField
                  label="Available until"
                  value={ends}
                  onChange={setEnds}
                />
              </>
            ) : (
              <Field
                label="Minutes (5–1440)"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
              />
            )}
          </View>
        ) : null}
        {quickError || control.error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {quickError || control.error}
          </Text>
        ) : null}
        <Button
          title={
            control.saving
              ? "Sharing…"
              : interval
                ? "Schedule availability"
                : "Share availability"
          }
          disabled={control.saving}
          onPress={() => void publish(true)}
        />
        <Button
          secondary
          title="Advanced status editor"
          disabled={control.saving}
          onPress={() => {
            setSetup(false);
            setupContinuation.current = () =>
              router.push({
                pathname: "/create",
                params: {
                  kind: "status",
                  ...(control.status
                    ? { statusSourceId: control.status.id }
                    : {}),
                },
              });
          }}
        />
        {control.status ? (
          <Button
            secondary
            title="Clear status"
            disabled={control.saving}
            onPress={() => {
              void control
                .clear()
                .then(() => setSetup(false))
                .catch(() => {});
            }}
          />
        ) : null}
        {manageScheduled &&
          control.scheduled
            .filter((item) => item.id !== control.status?.id)
            .map((item) => (
              <Button
                key={item.id}
                secondary
                compact
                title={`Scheduled · ${item.title} · ${new Date(item.starts_at).toLocaleString()}`}
                onPress={() => {
                  control.selectStatus(item.id);
                  configure(item, true);
                }}
              />
            ))}
      </Sheet>
      {!!quickError && !setup ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, ...tokens.type.caption }}
        >
          {quickError}
        </Text>
      ) : null}
      {!!control.error && !control.editorVisible && !avatarControl ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, ...tokens.type.caption }}
        >
          {control.error}
        </Text>
      ) : null}
    </View>
  );
}
