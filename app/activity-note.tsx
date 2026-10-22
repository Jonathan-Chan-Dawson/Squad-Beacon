import { useNow } from "@/src/shared/useNow";
import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  ActivityNoteEditor,
  LivingActivitySection,
} from "@/src/features/beacons/components/feed/LivingActivitySection";
import {
  currentActivity,
  ownActivityNote,
} from "@/src/features/beacons/livingActivity";
export default function ActivityNoteRoute() {
  const { data, userId } = useBeacon();
  const now = useNow();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const history = id
    ? data.activities.find(
        (a) =>
          a.id === id &&
          a.owner_id === userId &&
          a.solo_purpose === "activity_note",
      )
    : undefined;
  const current = userId ? currentActivity(data, userId, userId, now) : null;
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/profile");
  return (
    <Screen eyebrow="" title="Activity Note" create={false}>
      {id ? (
        <>
          <Txt>{history?.title ?? "This activity is no longer available."}</Txt>
          <Txt muted>{history?.description}</Txt>
          {history && (
            <Txt muted>
              {new Date(history.starts_at).toLocaleString()} · Ended{" "}
              {new Date(history.ends_at).toLocaleString()}
            </Txt>
          )}
        </>
      ) : (data.is_demo || data.capabilities?.living_activity) && userId ? (
        current?.type === "beacon" ? (
          <LivingActivitySection personId={userId} showLower={false} />
        ) : (
          <ActivityNoteEditor
            key={userId}
            visible
            note={ownActivityNote(data, userId, now)}
            onClose={close}
          />
        )
      ) : (
        <Txt muted>Activity Notes need the latest server update.</Txt>
      )}
    </Screen>
  );
}
