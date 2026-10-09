import { useEffect, useMemo, useState } from "react";
import type { Activity, Data } from "@/src/shared/types";
import { selectPastMemoryPhotos } from "./pastMemoryPrivacy";
import { signedBeaconMediaUrl } from "./beaconMedia";

/** Only sign readable photos, and discard cached URLs immediately when access changes. */
export function usePastMemoryThumbnails(data: Data, activities: readonly Activity[], viewerId: string | null, enabled: boolean) {
  const photos = useMemo(() => {
    return enabled ? selectPastMemoryPhotos(data, activities, viewerId) : [];
  }, [activities, data, enabled, viewerId]);
  // Canonical private URLs expire after 60 seconds. Renew before their expiry.
  const accessKey = JSON.stringify([viewerId, data.viewer_id, photos]);
  const [result, setResult] = useState<{ key: string; signedAt: number; urls: Record<string, string> } | null>(null);
  useEffect(() => {
    let current = true;
    const requests = JSON.parse(accessKey)[2] as typeof photos;
    if (!requests.length) return;
    let generation = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    async function renew() {
      const signedAt = Date.now();
      const request = ++generation;
      const entries = await Promise.all(requests.map(async ({ activityId, path }) => {
        try { return [activityId, await signedBeaconMediaUrl(path)] as const; }
        catch { return [activityId, null] as const; }
      }));
      const readable = entries.filter((entry): entry is readonly [string, string] => !!entry[1]);
      if (!current || request !== generation || !readable.length) return;
      setResult({ key: accessKey, signedAt, urls: Object.fromEntries(readable) });
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        if (current) setResult((previous) => previous?.key === accessKey && previous.signedAt === signedAt ? null : previous);
      }, Math.max(1, signedAt + 60000 - Date.now()));
    }
    void renew();
    const renewalTimer = setInterval(() => { void renew(); }, 45000);
    return () => { current = false; clearInterval(renewalTimer); if (expiryTimer) clearTimeout(expiryTimer); };
  }, [accessKey]);
  return result?.key === accessKey ? result.urls : {};
}
