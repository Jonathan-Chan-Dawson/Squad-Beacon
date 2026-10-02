import { useEffect, useRef } from "react";
import { useBeacon } from "@/src/shared/store";
import { useWidgetPreferences } from "@/src/features/widgets/preferences";
import {
  clearWidgetContent,
  clearWidgetSnapshotsOnly,
  prepareWidgetAccount,
  syncWidgetPayload,
} from "@/src/features/widgets/sync";

export function WidgetSync() {
  const { data, userId, demo, loading, error } = useBeacon();
  const { preferences, ready } = useWidgetPreferences();
  const previousAccount = useRef<string | null>(null);
  const sawAccount = useRef(false);
  const clearedUnavailableAccount = useRef(false);
  const clearedDisabledWidgets = useRef(false);

  useEffect(() => {
    if (sawAccount.current && previousAccount.current !== userId) {
      if (userId && !demo) void prepareWidgetAccount(userId);
    } else if (!sawAccount.current && userId && !demo) {
      void prepareWidgetAccount(userId);
    }
    previousAccount.current = userId;
    sawAccount.current = true;
  }, [demo, userId]);

  useEffect(() => {
    if (loading) {
      clearedUnavailableAccount.current = false;
      return;
    }
    if (!userId || demo) {
      if (!clearedUnavailableAccount.current) {
        clearedUnavailableAccount.current = true;
        void clearWidgetContent(true);
      }
      return;
    }
    clearedUnavailableAccount.current = false;
  }, [demo, loading, userId]);

  useEffect(() => {
    if (!userId || demo || !ready || loading) return;
    if (!preferences.enabled) {
      if (!clearedDisabledWidgets.current) {
        clearedDisabledWidgets.current = true;
        void clearWidgetSnapshotsOnly();
      }
      return;
    }
    clearedDisabledWidgets.current = false;
    if (error || !data.profiles.some((profile) => profile.id === userId))
      return;
    void syncWidgetPayload(data, userId, preferences);
  }, [data, demo, error, loading, preferences, ready, userId]);

  return null;
}
