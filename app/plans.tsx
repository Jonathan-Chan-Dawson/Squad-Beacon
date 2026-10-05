import React from "react";
import { useLocalSearchParams } from "expo-router";
import PlansScreen from "@/src/features/plans/PlansScreen";

export default function PlansRoute() {
  const { planSeed, create } = useLocalSearchParams<{
    planSeed?: string;
    create?: string;
  }>();
  const seed = Array.isArray(planSeed) ? planSeed[0] : planSeed;
  const createIntent = Array.isArray(create) ? create[0] : create;
  return <PlansScreen key={seed ?? (createIntent === "yes" ? "create" : "list")} />;
}
