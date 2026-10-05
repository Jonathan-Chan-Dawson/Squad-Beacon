import React from "react";
import { OrganizationDirectory } from "@/src/features/organizations/OrganizationDirectory";
import { Screen } from "@/src/shared/ui";

export default function OrganizationsRoute() {
  return (
    <Screen title="Organizations" eyebrow="CONNECTED COMMUNITIES" create={false}>
      <OrganizationDirectory compact />
    </Screen>
  );
}
