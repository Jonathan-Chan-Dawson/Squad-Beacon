import React, { useState } from "react";
import { View } from "react-native";
import type { Activity, BeaconChecklistItem } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import { Action, Button, Chips, Field, Txt } from "@/src/shared/ui";
import { PlanningDisclosure } from "@/src/features/planning/PlanningControls";

export function TaskCoordination({
  activity,
  item,
  tasks,
}: {
  activity: Activity;
  item: BeaconChecklistItem;
  tasks: BeaconChecklistItem[];
}) {
  const { data, act } = useBeacon();
  const [priority, setPriority] = useState(item.priority ?? "normal");
  const [prerequisite, setPrerequisite] = useState(
    item.prerequisite_id ?? null,
  );
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  if (!(data.is_demo || data.capabilities?.beacon_expansion)) return null;
  const plus = resolvePremiumFeature(
    data,
    "checklist_organization",
    activity,
  ).available;
  const pro = resolvePremiumFeature(
    data,
    "checklist_dependencies",
    activity,
  ).available;
  if (!plus && !item.prerequisite_id && item.priority !== "high") return null;
  return (
    <PlanningDisclosure
      title="Priority & order"
      summary={
        item.priority === "high"
          ? "High priority"
          : "Optional task coordination"
      }
    >
      <Chips
        options={["Normal", "High"] as const}
        value={priority === "high" ? "High" : "Normal"}
        onChange={(value) => setPriority(value === "High" ? "high" : "normal")}
        accessibilityPrefix="Task priority"
      />
      {(pro || prerequisite) && (
        <View style={{ gap: 6 }}>
          <Txt muted>
            Do this after:{" "}
            {tasks.find((t) => t.id === prerequisite)?.text ??
              (prerequisite ? "Load the prerequisite task to view it" : "None")}
          </Txt>
          <Button
            secondary
            title="No earlier task"
            onPress={() => setPrerequisite(null)}
          />
          {pro && (
            <Field
              label="Find an earlier task"
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setLimit(8);
              }}
            />
          )}
          {pro &&
            tasks
              .filter(
                (t) =>
                  t.id !== item.id &&
                  t.text.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, limit)
              .map((t) => (
                <Button
                  key={t.id}
                  secondary
                  title={`${t.id === prerequisite ? "Selected: " : "After "}${t.text}`}
                  onPress={() => setPrerequisite(t.id)}
                />
              ))}
          {pro && tasks.length > limit && (
            <Button
              secondary
              title="Show more earlier tasks"
              onPress={() => setLimit((n) => n + 8)}
            />
          )}
        </View>
      )}
      <Action
        title="Save priority & order"
        run={() =>
          act("save_task_coordination", {
            id: item.id,
            priority,
            prerequisite_id: prerequisite,
            revision: item.coordination_revision ?? 0,
          })
        }
      />
    </PlanningDisclosure>
  );
}
