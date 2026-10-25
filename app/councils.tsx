import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import PlanningListScreen from "@/src/features/planning/PlanningListScreen";

export default function CouncilsRoute() {
  const params = useLocalSearchParams();
  if (params.newPing === "yes" || params.creationKind)
    return (
      <Redirect
        href={{
          pathname: "/planning/create",
          params: {
            ...params,
            kind:
              params.creationKind === "draw"
                ? "draw"
                : params.creationKind === "council"
                  ? "vote"
                  : "ping",
          },
        }}
      />
    );
  return <PlanningListScreen />;
}
