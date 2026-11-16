import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Txt } from "@/src/shared/ui";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import type { Activity } from "@/src/shared/types";
import { PlanningDisclosure } from "./PlanningControls";
import { canReadPlanningThread, canManagePlanningThread } from "./domain";

export function CouncilWorkflow({ threadId }: { threadId: string }) {
  const { data, userId } = useBeacon();
  const [edit, setEdit] = useState(false);
  const t = data.planning_threads.find((t) => t.id === threadId);
  const c = data.premium_tool_configs?.find(
    (c) => c.thread_id === threadId && c.kind === "council",
  );
  if (
    !userId ||
    !t ||
    !canReadPlanningThread(data, t, userId) ||
    !(data.is_demo || data.capabilities?.beacon_specialized)
  )
    return null;
  const pro = resolvePremiumFeature(
    data,
    "council_workflows",
    t as unknown as Activity,
  ).available;
  const manager = canManagePlanningThread(t, userId);
  const stages = c?.settings.workflow ?? [];
  if (!stages.length && !(pro && manager)) return null;
  return (
    <PlanningDisclosure
      title="Collaboration · Decision workflow"
      summary={`${stages.length} linked Council stages`}
    >
      <Txt muted>
        Each stage uses its own Council, votes and deadline. Resolve the current
        decision before continuing.
      </Txt>
      {stages.map((stage, index) => {
        const target = data.planning_threads.find(
          (t) => t.id === stage.thread_id,
        );
        if (!target || !canReadPlanningThread(data, target, userId))
          return null;
        const prior = stages
          .slice(0, index)
          .map((s) => data.planning_threads.find((t) => t.id === s.thread_id));
        const ready = prior.every(
          (t) =>
            t &&
            ["resolved", "no_options", "expired", "cancelled"].includes(
              t.status,
            ),
        );
        return (
          <View key={stage.thread_id} style={{ gap: 4 }}>
            <Txt>
              {index + 1}. {stage.label} · {target.status}
            </Txt>
            <Button
              secondary
              title={`Open decision ${stage.label}`}
              disabled={!ready}
              onPress={() => router.push(`/council/${target.id}`)}
            />
            {!ready && <Txt muted>Finish the earlier stage to continue.</Txt>}
          </View>
        );
      })}
      {pro && manager && (
        <Button
          secondary
          title={edit ? "Close workflow setup" : "Configure decision workflow"}
          onPress={() => setEdit(!edit)}
        />
      )}
      {pro && manager && edit && (
        <WorkflowSetup
          key={`${threadId}.${c?.revision ?? -1}`}
          threadId={threadId}
        />
      )}
    </PlanningDisclosure>
  );
}
function WorkflowSetup({ threadId }: { threadId: string }) {
  const { data, userId, act } = useBeacon();
  const t = data.planning_threads.find((t) => t.id === threadId)!;
  const c = data.premium_tool_configs?.find(
    (c) => c.thread_id === threadId && c.kind === "council",
  );
  const [stages, setStages] = useState(c?.settings.workflow ?? []);
  const choices = data.planning_threads.filter(
    (row) =>
      row.kind !== "ping" &&
      row.audience === t.audience &&
      row.audience_id === t.audience_id &&
      canReadPlanningThread(data, row, userId!) &&
      canManagePlanningThread(row, userId!),
  );
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>
        Select existing Councils in order. Participant ballots stay in each
        Council.
      </Txt>
      {stages.map((s, index) => (
        <Button
          key={s.thread_id}
          secondary
          title={`Remove stage ${index + 1}: ${s.label}`}
          onPress={() =>
            setStages(stages.filter((row) => row.thread_id !== s.thread_id))
          }
        />
      ))}
      {choices
        .filter((t) => !stages.some((s) => s.thread_id === t.id))
        .map((t) => (
          <Button
            key={t.id}
            secondary
            title={`Add decision ${t.title}`}
            disabled={stages.length >= 8}
            onPress={() =>
              setStages([
                ...stages,
                { thread_id: t.id, label: t.title.slice(0, 60) },
              ])
            }
          />
        ))}
      <Action
        title="Save decision workflow"
        run={() =>
          act("save_tool_config", {
            thread_id: threadId,
            kind: "council",
            settings: {
              ...(c?.settings ?? {
                groups: [],
                explanations: false,
                readiness: false,
              }),
              workflow: stages,
            },
            revision: c?.revision ?? -1,
          })
        }
      />
    </View>
  );
}
