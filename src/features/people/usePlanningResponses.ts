import { requirePlanningSubmission } from "@/src/features/planning/planningInteraction";
import { planningDestination } from "@/src/features/planning/inbox";
import { useCallback, useRef, useState } from "react";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import {
  canReadPlanningThread,
  canRespondToPlanningThread,
  normalizePlanningData,
  pendingPlanningThreads,
  visiblePlanningProposals,
} from "@/src/features/planning/domain";
import {
  selectSquadChatPings,
  visibleSquadPingResponses,
} from "@/src/features/organizations/squadChat";
import { canReadOrganization } from "@/src/features/organizations/domain";
import { canOpenSquadProfile } from "./squadProfile";
import {
  pendingSocialCount,
  pendingCommunityJoinRequests,
} from "./communication";
import type {
  PlanningResponse,
  PlanningThread,
} from "@/src/features/planning/types";
import type { PlanningResponseCardProps } from "./components/PlanningResponseCard";
import type { ResponseInvitation } from "./components/ResponsesSheet";

/** Canonical decision/invitation adapter for existing launchers and the full-screen inbox.
 * Responses use the same records as interactive Squad chat cards. */
export function usePlanningResponses(now: number, onBeforeOpen?: () => void) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const current = !!userId && data.viewer_id === userId;
  const count = pendingSocialCount(data, userId, now);
  const [retained, setRetained] = useState<PlanningThread[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const planning = normalizePlanningData(data);
  const pendingThreads =
    current && userId
      ? pendingPlanningThreads(data, planning, userId, now)
      : [];
  const displayThreads = [
    ...pendingThreads,
    ...retained.filter(
      (thread) =>
        userId &&
        current &&
        canReadPlanningThread(data, thread, userId) &&
        !pendingThreads.some((row) => row.id === thread.id),
    ),
  ].filter((thread) => !acknowledged.includes(thread.id));
  const visibleThreads = displayThreads.filter(
    (thread) =>
      thread.audience !== "squad" ||
      (!!userId &&
        !!thread.audience_id &&
        (thread.kind !== "ping" ||
          selectSquadChatPings(data, thread.audience_id, userId).some(
            (row) => row.id === thread.id,
          ))),
  );

  function openThread(thread: PlanningThread) {
    if (
      !userId ||
      data.viewer_id !== userId ||
      !canReadPlanningThread(data, thread, userId)
    )
      return;
    onBeforeOpen?.();
    router.push(planningDestination(thread.id));
  }
  const respond = useCallback(
    async (thread: PlanningThread, response: PlanningResponse) => {
      if (
        !userId ||
        data.viewer_id !== userId ||
        thread.kind !== "ping" ||
        thread.owner_id === userId ||
        !canRespondToPlanningThread(data, thread, userId, now)
      )
        throw new Error("This Ping is no longer accepting your response.");
      if (pending.current.has(thread.id)) return false;
      pending.current.add(thread.id);
      setPendingIds([...pending.current]);
      setRetained((rows) =>
        rows.some((row) => row.id === thread.id) ? rows : [...rows, thread],
      );
      try {
        const state = requirePlanningSubmission(data, userId, thread.id);
        const saved = state.responses.find(row => row.user_id === userId);
        const epoch = getViewerEpoch();
        await act("respond_planning_ping", { thread_id: thread.id, response, auto_rsvp: response === "interested" && !!saved?.auto_rsvp, available_after: response === "interested" ? saved?.available_after ?? null : null });
        if (epoch !== getViewerEpoch()) return false;
        return true;
      } catch (failure) {
        setRetained((rows) => rows.filter((row) => row.id !== thread.id));
        throw failure;
      } finally {
        pending.current.delete(thread.id);
        setPendingIds([...pending.current]);
      }
    },
    [act, data, getViewerEpoch, now, userId],
  );
  function card(thread: PlanningThread): PlanningResponseCardProps {
    const source =
      thread.audience === "squad" &&
      canOpenSquadProfile(data, thread.audience_id ?? "", userId)
        ? data.squads.find((row) => row.id === thread.audience_id)?.name
        : thread.audience === "organization" &&
            canReadOrganization(data, thread.audience_id ?? "", userId)
          ? data.organizations.find((row) => row.id === thread.audience_id)
              ?.name
          : thread.audience === "friends"
            ? "Friends"
            : "Your group";
    const base = {
      id: thread.id,
      title: thread.title,
      sourceLabel: source ?? "Your group",
      deadline: thread.deadline_at,
      pending: pendingIds.includes(thread.id),
      onOpen: () => openThread(thread),
    };
    if (thread.kind === "ping") {
      const responses =
        userId && thread.audience === "squad"
          ? visibleSquadPingResponses(data, thread, userId)
          : planning.planning_ping_responses.filter(
              (response) =>
                response.thread_id === thread.id &&
                response.user_id !== thread.owner_id &&
                canReadPlanningThread(data, thread, response.user_id) &&
                !data.blocks.some(
                  (block) =>
                    (block.blocker_id === userId &&
                      block.blocked_id === response.user_id) ||
                    (block.blocked_id === userId &&
                      block.blocker_id === response.user_id),
                ),
            );
      return {
        ...base,
        kind: "ping",
        disabled:
          thread.owner_id === userId ||
          Date.parse(thread.deadline_at) <= now ||
          thread.status !== "open",
        selected: responses.find((response) => response.user_id === userId)
          ?.response,
        counts: [
          {
            label: "Interested",
            value: responses.filter(
              (response) => response.response === "interested",
            ).length,
          },
          {
            label: "Maybe",
            value: responses.filter((response) => response.response === "maybe")
              .length,
          },
        ],
        // Only invoked by the card's press handler; the single-flight ref is never read during render.
        // eslint-disable-next-line react-hooks/refs
        onRespond: (response) => respond(thread, response),
        onAcknowledged: () => {
          setAcknowledged((ids) => [...ids, thread.id]);
          setRetained((rows) => rows.filter((row) => row.id !== thread.id));
        },
      };
    }
    const options = userId
      ? visiblePlanningProposals(
          data,
          planning.planning_proposals,
          thread.id,
          userId,
        ).filter(
          (proposal) =>
            proposal.approved &&
            !proposal.disqualified_at &&
            canReadPlanningThread(data, thread, proposal.author_id),
        )
      : [];
    const votes = planning.planning_votes.filter(
      (vote) =>
        vote.thread_id === thread.id &&
        options.some((proposal) => proposal.id === vote.proposal_id) &&
        canReadPlanningThread(data, thread, vote.user_id) &&
        !data.blocks.some(
          (block) =>
            (block.blocker_id === userId &&
              block.blocked_id === vote.user_id) ||
            (block.blocked_id === userId && block.blocker_id === vote.user_id),
        ),
    );
    return {
      ...base,
      kind: thread.kind,
      counts: [
        { label: "Options", value: options.length },
        ...(thread.kind === "vote" && (votes.some(v=>v.user_id===userId)||thread.owner_id===userId||thread.coowner_ids.includes(userId??"")||thread.status!=="open")
          ? [{ label: "Votes", value: votes.length }]
          : []),
      ],
      actions: [
        {
          id: "detail",
          label: thread.kind === "vote" ? "View vote options" : "View draw",
          feedback: "none",
          onPress: () => openThread(thread),
        },
      ],
    };
  }
  const cards = visibleThreads.map(card);
  const invitations: ResponseInvitation[] = !current
    ? []
    : [
        ...data.friendships
          .filter(
            (row) => row.recipient_id === userId && row.status === "pending",
          )
          .map((row) => ({
            id: `friend:${row.id}`,
            title: "Friend request",
            sourceLabel: data.profiles.find((item) => item.id === row.sender_id)
              ?.name,
            actions: [
              {
                id: "accept",
                label: "Accept friend",
                onPress: async () => {
                  await act("accept_friend", { id: row.id });
                },
              },
            ],
          })),
        ...data.squad_invites
          .filter((row) => row.recipient_id === userId)
          .map((row) => ({
            id: `squad:${row.id}`,
            title: "Squad invitation",
            sourceLabel: data.squads.find((item) => item.id === row.squad_id)
              ?.name,
            actions: [
              {
                id: "accept",
                label: "Accept squad invitation",
                onPress: async () => {
                  await act("accept_squad", { id: row.id });
                },
              },
            ],
          })),
        ...data.organization_members
          .filter((row) => row.user_id === userId && row.status === "invited")
          .map((row) => ({
            id: `org:${row.organization_id}`,
            title: "Network invitation",
            sourceLabel: data.organizations.find(
              (item) => item.id === row.organization_id,
            )?.name,
            actions: [
              {
                id: "accept",
                label: "Accept organization",
                onPress: async () => {
                  await act("respond_organization_invite", {
                    organization_id: row.organization_id,
                    accept: true,
                  });
                },
              },
              {
                id: "decline",
                label: "Decline",
                onPress: async () => {
                  await act("respond_organization_invite", {
                    organization_id: row.organization_id,
                    accept: false,
                  });
                },
              },
            ],
          })),
        ...data.space_members
          .filter((row) => row.user_id === userId && row.status === "invited")
          .map((row) => ({
            id: `space:${row.space_id}`,
            title: "Organization invitation",
            sourceLabel: data.spaces.find((item) => item.id === row.space_id)
              ?.name,
            actions: [
              {
                id: "accept",
                label: "Accept",
                onPress: async () => {
                  await act("respond_space_invite", {
                    space_id: row.space_id,
                    accept: true,
                  });
                },
              },
              {
                id: "decline",
                label: "Decline",
                onPress: async () => {
                  await act("respond_space_invite", {
                    space_id: row.space_id,
                    accept: false,
                  });
                },
              },
            ],
          })),
        ...pendingCommunityJoinRequests(data, userId).map((row) => ({
          id: `request:${row.type}:${row.entityId}:${row.userId}`,
          title: "Join request",
          sourceLabel:
            row.type === "squad"
              ? data.squads.find((item) => item.id === row.entityId)?.name
              : row.type === "space"
                ? data.spaces.find((item) => item.id === row.entityId)?.name
                : data.organizations.find((item) => item.id === row.entityId)
                    ?.name,
          actions: [
            {
              id: "approve",
              label: "Approve",
              onPress: async () => {
                await act(`approve_${row.type}_join_request`, {
                  [`${row.type}_id`]: row.entityId,
                  user_id: row.userId,
                });
              },
            },
            {
              id: "decline",
              label: "Decline",
              onPress: async () => {
                await act(`deny_${row.type}_join_request`, {
                  [`${row.type}_id`]: row.entityId,
                  user_id: row.userId,
                });
              },
            },
          ],
        })),
        ...data.rsvps
          .filter((row) => {
            const activity = data.activities.find(
              (item) => item.id === row.activity_id,
            );
            return (
              activity?.status === "scheduled" &&
              Date.parse(activity.ends_at) > now &&
              ((row.user_id === userId && row.status === "invited") ||
                (activity.owner_id === userId && row.status === "requested"))
            );
          })
          .map((row) => ({
            id: `beacon:${row.activity_id}:${row.user_id}`,
            title:
              row.status === "requested"
                ? "Beacon request"
                : "Beacon invitation",
            sourceLabel: data.activities.find(
              (item) => item.id === row.activity_id,
            )?.title,
            actions: [
              {
                id: "open",
                label:
                  row.status === "requested"
                    ? "Review request"
                    : "View invitation",
                onPress: () => {
                  onBeforeOpen?.();
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: row.activity_id },
                  });
                },
              },
            ],
          })),
      ];
  const summary = [
    ...(["ping", "vote", "draw", "time"] as const).map((kind) => {
      const total = pendingThreads.filter(
        (thread) => thread.kind === kind,
      ).length;
      const label = { ping: "Ping", vote: "Vote", draw: "Draw", time: "Find a Time" }[kind];
      return total ? `${total} ${label}${total === 1 ? "" : "s"}` : "";
    }),
    invitations.length
      ? `${invitations.length} Invite${invitations.length === 1 ? "" : "s"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return { cards, invitations, count, summary };
}
