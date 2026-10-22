import type { Audience } from "@/src/shared/types";
import { useNow } from "@/src/shared/useNow";
import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { AudiencePicker, Button, Screen, Txt } from "@/src/shared/ui";
import { eligibleCurrentBeacons } from "@/src/features/beacons/currentStatusBeacon";
import {
  eligibleStatusAttachments,
  type StatusAttachmentType,
} from "@/src/features/beacons/statusAttachments";
import {
  liveOwnedStatuses,
  saveOwnStatus,
} from "@/src/features/beacons/components/feed/statusActions";

/** Publication is complete before entering here. Retrying never republishes the item. */
export default function ActivityCreated() {
  const { id, type, intent } = useLocalSearchParams<{
    id: string;
    type: StatusAttachmentType;
    intent?: string;
  }>();
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const presence = data.presence?.find((p) => p.owner_id === userId);
  const [audience, setAudience] = useState<Audience>(
    presence?.current_audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    presence?.current_audience_id ?? null,
  );
  const now = useNow();
  const live =
    intent !== "feature" &&
    type === "beacon" &&
    eligibleCurrentBeacons(data, userId, now).some((a) => a.id === id);
  const eligible = eligibleStatusAttachments(data, userId, now).some(
    (a) => a.id === id && a.type === type,
  );
  const status = liveOwnedStatuses(data, userId, now)[0];
  const open = () =>
    router.replace({
      pathname: type === "beacon" ? "/activity/[id]" : "/council/[id]",
      params: { id },
    });
  const link = async () => {
    if (busy || !userId) return;
    if (!live && status?.status_attachment && !confirm) {
      setConfirm(true);
      return;
    }
    const epoch = getViewerEpoch();
    setBusy(true);
    setError("");
    try {
      if (live)
        await act("update_presence", {
          show_current_beacon: true,
          current_beacon_id: id,
          current_audience: audience,
          current_audience_id: audienceId,
        });
      else {
        const result = await saveOwnStatus(
          data,
          userId,
          {
            sourceId: status?.id,
            title: status?.title ?? "",
            description: status?.description,
            category: status?.category,
            available: status?.available === true,
            endsAt: status?.ends_at ?? new Date(now + 3600000).toISOString(),
            audience: status?.audience ?? "friends",
            audienceId: status?.audience_id ?? null,
            attachment: { type, id },
            presentation: status?.title ? "text_activity" : "activity_only",
          },
          act,
          now,
        );
        if (result.message) throw new Error(result.message);
      }
      if (epoch === getViewerEpoch()) open();
    } catch (e) {
      if (epoch === getViewerEpoch())
        setError(
          e instanceof Error
            ? e.message
            : "Created successfully, but linking failed. Try again.",
        );
    } finally {
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  };
  return (
    <Screen eyebrow="" title="Ready to share" create={false}>
      <Txt>
        Your{" "}
        {type === "beacon" ? "Beacon" : type === "ping" ? "Ping" : "Council"}{" "}
        was created.
      </Txt>
      {live && (
        <Txt muted>
          You can use this live Beacon as your Current Activity. Your Activity
          Note will end and remain in history.
        </Txt>
      )}
      {live && (
        <AudiencePicker
          value={audience}
          id={audienceId}
          onChange={(nextAudience, nextId) => {
            setAudience(nextAudience);
            setAudienceId(nextId);
          }}
        />
      )}
      {confirm && (
        <Txt>Replace your existing Featured activity with this one?</Txt>
      )}
      {(live || eligible) && (
        <Button
          title={
            busy
              ? "Updating…"
              : live
                ? "Use as My Current Activity"
                : confirm
                  ? "Replace Featured Activity"
                  : "Feature on Status"
          }
          disabled={busy}
          onPress={() => void link()}
        />
      )}
      {!!error && <Txt>{error}</Txt>}
      <Button secondary title="Continue" disabled={busy} onPress={open} />
    </Screen>
  );
}
