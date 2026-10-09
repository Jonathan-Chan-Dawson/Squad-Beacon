import React, { useState } from "react";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { StatusPanel, type FeedStatusSave } from "@/src/features/beacons/components/feed/StatusPanel";

export function ProfileAvailability() {
  const { data, userId, act } = useBeacon();
  const tick = useNow();
  const [acknowledged, setAcknowledged] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = Math.max(tick, acknowledged);
  const profile = data.profiles.find((item) => item.id === userId);
  const status = data.viewer_id === userId ? data.activities.filter((activity) => activity.owner_id === userId && activity.mode === "solo" &&
    activity.status === "scheduled" && Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now)
    .sort((left, right) => right.starts_at.localeCompare(left.starts_at))[0] : undefined;
  const create = async (value: FeedStatusSave) => {
    if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before sharing a status.");
    const start = new Date().toISOString();
    if (!value.title.trim() || Date.parse(value.endsAt) <= Date.parse(start)) throw new Error("Add a status and an end time in the future.");
    return act("create_activity", { title: value.title.trim(), description: "", available: value.available, category: status?.category ?? "Social",
      mode: "solo", starts_at: start, ends_at: value.endsAt, timezone: profile?.timezone || "UTC", audience: status?.audience ?? "friends",
      audience_id: status?.audience_id ?? null, target_count: null, approval_required: false, aspiration_ids: [], label: "", online_url: null, latitude: null, longitude: null });
  };
  return <StatusPanel profile={profile} status={status ? { id: status.id, title: status.title, available: status.available === true, startsAt: status.starts_at, endsAt: status.ends_at } : null}
    editorVisible={open} saving={busy} error={error} onCreate={() => setOpen(true)} onEdit={() => setOpen(true)} onCloseEditor={() => { if (!busy) setOpen(false); }}
    onSave={async (value) => {
      if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before editing a status.");
      setBusy(true); setError("");
      try {
        if (!status) await create(value);
        else if (status.available === value.available) await act("edit_activity", { id: status.id, title: value.title.trim(), starts_at: status.starts_at, ends_at: value.endsAt });
        else {
          await create(value);
          try { await act("activity_status", { id: status.id, status: "cancelled" }); }
          catch { setError("Your new status is live, but the previous status could not be cleared."); }
        }
        setAcknowledged(Date.now()); setOpen(false);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your status."); throw failure; }
      finally { setBusy(false); }
    }} onClear={async () => {
      if (!status || !userId || data.viewer_id !== userId) return;
      setBusy(true); setError("");
      try { await act("activity_status", { id: status.id, status: "cancelled" }); setAcknowledged(Date.now()); setOpen(false); }
      catch (failure) { setError(failure instanceof Error ? failure.message : "Could not clear your status."); throw failure; }
      finally { setBusy(false); }
    }} onConvert={() => status && router.push({ pathname: "/create", params: { kind: "beacon", repeat: status.id } })} />;
}
