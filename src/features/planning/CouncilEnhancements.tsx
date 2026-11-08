import React, { useState } from "react";
import { View } from "react-native";
import { Action, Button, Chips, Field, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import type { Activity } from "@/src/shared/types";
import {
  canReadPlanningThread,
  canManagePlanningThread,
  canRespondToPlanningThread,
  visiblePlanningProposals,
} from "./domain";
import { PremiumToolSettings } from "@/src/features/beacons/components/PremiumToolSettings";
export function CouncilEnhancements({ threadId }: { threadId: string }) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const thread = data.planning_threads.find((t) => t.id === threadId);
  if (
    !userId ||
    !thread ||
    !canReadPlanningThread(data, thread, userId) ||
    !(data.is_demo || data.capabilities?.advanced_beacon_tools)
  )
    return null;
  const manages = canManagePlanningThread(thread, userId),
    config = data.premium_tool_configs?.find(
      (t) => t.thread_id === thread.id && t.kind === "council",
    )?.settings;
  const options = visiblePlanningProposals(
    data,
    data.planning_proposals,
    threadId,
    userId,
  );
  const activity = {
    id: thread.id,
    owner_id: thread.owner_id,
    audience: thread.audience,
    audience_id: thread.audience_id,
  } as Activity;
  return (
    <View style={{ gap: 8 }}>
      <PremiumToolSettings
        activity={activity}
        threadId={threadId}
        kind="council"
      />
      {!!error && <Txt>{error}</Txt>}
      {!!config?.groups?.length && (
        <>
          <Button
            compact
            secondary
            title={open ? "Close option groups" : "Option groups"}
            onPress={() => setOpen(!open)}
          />
          {open &&
            options.map((p) => (
              <View key={p.id} style={{ gap: 4 }}>
                <Txt>{p.payload.title}</Txt>
                {manages && thread.status === "open" ? (
                  <Chips
                    options={["Ungrouped", ...(config.groups ?? [])]}
                    value={
                      data.council_option_groups?.find(
                        (g) => g.proposal_id === p.id,
                      )?.group_label ?? "Ungrouped"
                    }
                    onChange={(group_label) => {
                      setError("");
                      void act("set_council_option_group", {
                        thread_id: thread.id,
                        proposal_id: p.id,
                        group_label:
                          group_label === "Ungrouped" ? null : group_label,
                      }).catch((e: Error) => setError(e.message));
                    }}
                  />
                ) : (
                  <Txt muted>
                    {data.council_option_groups?.find(
                      (g) => g.proposal_id === p.id,
                    )?.group_label ?? "Ungrouped"}
                  </Txt>
                )}
              </View>
            ))}
        </>
      )}
      {manages && config?.readiness && (
        <View style={{ gap: 4 }}>
          <Txt>Preparation checks</Txt>
          <Txt muted>
            {options.filter((p) => p.approved && !p.disqualified_at).length}{" "}
            approved options · {options.filter((p) => !p.approved).length}{" "}
            awaiting review
          </Txt>
          <Txt muted>
            {Date.parse(thread.deadline_at) > now
              ? "Deadline is ahead"
              : "Deadline reached"}{" "}
            · Audience: {thread.audience}
          </Txt>
          <Txt muted>
            Only currently readable options appear here. Review participation
            and publication through the existing controls.
          </Txt>
        </View>
      )}
      {manages &&
        (data.council_explanations ?? [])
          .filter((e) => e.thread_id === thread.id)
          .map((e) => (
            <View key={e.user_id}>
              <Txt muted>Optional response explanation</Txt>
              <Txt>{e.body}</Txt>
            </View>
          ))}
    </View>
  );
}
export function CouncilResponseExtra({ threadId }: { threadId: string }) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [open, setOpen] = useState(false),
    [body, setBody] = useState("");
  const thread = data.planning_threads.find((t) => t.id === threadId);
  if (
    !userId ||
    !thread ||
    !canReadPlanningThread(data, thread, userId) ||
    !data.premium_tool_configs?.some(
      (t) =>
        t.thread_id === threadId &&
        t.kind === "council" &&
        t.settings.explanations,
    )
  )
    return null;
  const existing = data.council_explanations?.find(
    (e) => e.thread_id === threadId && e.user_id === userId,
  );
  return (
    <View style={{ gap: 8 }}>
      {existing && <Txt muted>{existing.body}</Txt>}
      {canRespondToPlanningThread(data, thread, userId, now) && (
        <Button
          compact
          secondary
          title={open ? "Close explanation" : "Add an explanation · optional"}
          onPress={() => {
            setBody(existing?.body ?? "");
            setOpen(!open);
          }}
        />
      )}
      {open && (
        <>
          <Txt muted>Visible to you and the decision organizers.</Txt>
          <Field
            label="Your explanation"
            value={body}
            onChangeText={setBody}
            maxLength={500}
            multiline
          />
          <Action
            secondary
            title="Save explanation"
            run={async () => {
              await act("save_council_explanation", {
                thread_id: threadId,
                body,
              });
              setOpen(false);
            }}
          />
        </>
      )}
    </View>
  );
}
