import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import { Screen, Txt } from "@/src/shared/ui";
import { PlanningComposer } from "@/src/features/planning/PlanningComposer";

export default function PlanningCreateRoute() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { userId, data } = useBeacon();
  const [generated] = useState(randomUUID);
  const sessionId = params.sessionId ?? generated;
  useEffect(() => {
    if (!params.sessionId) router.setParams({ sessionId });
  }, [params.sessionId, sessionId]);
  if (userId && data.viewer_id !== userId)
    return (
      <Screen title="Create decision" eyebrow="">
        <Txt>Loading your audience…</Txt>
      </Screen>
    );
  return (
    <PlanningComposer key={`${userId}:${sessionId}`} sessionId={sessionId} />
  );
}
