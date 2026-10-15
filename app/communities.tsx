import React from "react";
import { Redirect } from "expo-router";

export default function Communities() {
  return (
    <Redirect
      href={{ pathname: "/(tabs)/squads", params: { section: "Communities" } }}
    />
  );
}
