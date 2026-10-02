// Client notification handling. Server delivery lives in supabase/functions/push-worker/index.ts.
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export function useNotificationHandling(
  ready: boolean,
  refresh: () => Promise<void>,
) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    function open(response: Notifications.NotificationResponse) {
      const request = response.notification.request;
      if (handled.current === request.identifier) return;
      handled.current = request.identifier;
      void Notifications.clearLastNotificationResponseAsync();
      void refresh();
      const id = request.content.data?.activity_id;
      // Only our known route and UUID payload are accepted; never open arbitrary URLs.
      if (
        typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        router.push({ pathname: "/(tabs)", params: { beacon: id } });
      else
        router.push({
          pathname: "/(tabs)/activities",
          params: { inbox: "yes" },
        });
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    const incoming = Notifications.addNotificationReceivedListener(() => {
      void refresh();
    });
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    return () => {
      subscription.remove();
      incoming.remove();
    };
  }, [ready, refresh]);
}
