import React, { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { canRespondToPlanningThread } from "@/src/features/planning/domain";
import { selectSquadChatPings, visibleSquadPingResponses } from "./squadChat";
import { canReadOrganizationMembers } from "./domain";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { canViewProfile } from "@/src/features/profile/privacy";
import { PlanningResponseCard } from "@/src/features/people/components/PlanningResponseCard";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import {
  ChatBubbleList,
  type ChatListEvent,
} from "@/src/features/messages/ChatBubbleList";
import { ChatComposer } from "@/src/features/messages/ChatComposer";
import { useOptimisticChat } from "@/src/features/messages/useOptimisticChat";
import type { GroupMessageScope } from "./types";

export function GroupChatThread({
  scope,
  organizationId,
  squadId,
  focusedPingId,
  onMoreActions,
}: {
  scope: GroupMessageScope;
  organizationId?: string;
  squadId?: string;
  focusedPingId?: string;
  onMoreActions?: () => void;
}) {
  const { colors } = useDesignTheme();
  const { data, userId, act } = useBeacon();
  const router = useRouter();
  const scopeId = scope === "organization" ? organizationId : squadId;
  const canWrite =
    !!scopeId &&
    !!userId &&
    data.viewer_id === userId &&
    (scope === "squad"
      ? !!activeSquadMembership(data, scopeId, userId)
      : canReadOrganizationMembers(data, scopeId, userId));
  const group = canWrite
    ? data.group_messages.filter(
        (message) =>
          message.scope === scope &&
          (scope === "organization"
            ? message.organization_id === scopeId
            : message.squad_id === scopeId) &&
          !data.blocks.some(
            (block) =>
              (block.blocker_id === userId &&
                block.blocked_id === message.author_id) ||
              (block.blocker_id === message.author_id &&
                block.blocked_id === userId),
          ),
      )
    : [];
  const canonical = group.map((message) => ({
    id: message.id,
    authorId: message.author_id,
    body: message.body,
    createdAt: message.created_at,
  }));
  const conversationKey = `${userId ?? "signed-out"}:${scope}:${scopeId ?? "unavailable"}`;
  const chat = useOptimisticChat({
    scope: conversationKey,
    authorId: userId,
    canonical,
    canWrite,
    send: (body) =>
      act("send_group_message", {
        scope,
        ...(scope === "organization"
          ? { organization_id: scopeId }
          : { squad_id: scopeId }),
        body,
      }),
  });
  const pings =
    canWrite && scope === "squad" && scopeId && userId
      ? selectSquadChatPings(data, scopeId, userId)
      : [];
  const sourceLabel =
    scope === "squad"
      ? (data.squads.find((item) => item.id === scopeId)?.name ?? "Squad")
      : (data.organizations.find((item) => item.id === scopeId)?.name ??
        "Organization");
  const events: ChatListEvent[] = [
    ...canonical,
    ...(canWrite ? chat.rows : []),
  ].map((message) => ({ kind: "message", message }));
  for (const thread of pings) {
    const responses = userId
      ? visibleSquadPingResponses(data, thread, userId)
      : [];
    const selected = responses.find(
      (response) => response.user_id === userId,
    )?.response;
    const canReply =
      !!userId &&
      canWrite &&
      thread.owner_id !== userId &&
      canRespondToPlanningThread(data, thread, userId);
    events.push({
      kind: "card",
      id: thread.id,
      createdAt: thread.created_at,
      content: (
        <PlanningResponseCard
          key={thread.id}
          id={thread.id}
          kind="ping"
          title={thread.title}
          sourceLabel={sourceLabel}
          deadline={thread.deadline_at}
          selected={selected}
          disabled={!canReply}
          counts={(["interested", "maybe", "pass"] as const).map(
            (response) => ({
              label: response[0].toUpperCase() + response.slice(1),
              value: responses.filter((item) => item.response === response)
                .length,
            }),
          )}
          onOpen={() =>
            router.push({
              pathname: "/council/[id]",
              params: { id: thread.id },
            })
          }
          onRespond={async (response) => {
            if (
              !userId ||
              data.viewer_id !== userId ||
              !activeSquadMembership(data, scopeId!, userId) ||
              !canRespondToPlanningThread(data, thread, userId)
            )
              throw new Error("This Ping is unavailable.");
            await act("respond_planning_ping", {
              thread_id: thread.id,
              response,
              auto_rsvp: false,
            });
            return true;
          }}
        />
      ),
    });
  }
  const eventDate = (event: ChatListEvent) =>
    event.kind === "message" ? event.message.createdAt : event.createdAt;
  events.sort((a, b) => eventDate(a).localeCompare(eventDate(b)));
  const latestCanonicalAt =
    [
      ...group.map((message) => message.created_at),
      ...pings.map((thread) => thread.created_at),
    ]
      .sort()
      .at(-1) ?? "";
  const actRef = useRef(act);
  useEffect(() => {
    actRef.current = act;
  }, [act]);
  useEffect(() => {
    if (!canWrite || !scopeId) return;
    void actRef
      .current("mark_group_chat_read", {
        scope,
        ...(scope === "organization"
          ? { organization_id: scopeId }
          : { squad_id: scopeId }),
      })
      .catch(() => undefined);
  }, [scope, scopeId, userId, canWrite, latestCanonicalAt]);
  return (
    <ChatKeyboardFrame>
      <ChatBubbleList
        events={events}
        viewerId={userId}
        scopeKey={conversationKey}
        focusedId={focusedPingId}
        profileForAuthor={(id) => {
          const profile = data.profiles.find((item) => item.id === id);
          return profile && userId && canViewProfile(data, profile, userId)
            ? profile
            : undefined;
        }}
        onRetry={(id) => {
          void chat.submit(id);
        }}
        retryDisabled={!canWrite || chat.busy}
        onOpener={chat.setDraft}
      />
      {canWrite ? (
        <ChatComposer
          body={chat.draft}
          onChange={chat.setDraft}
          onSend={() => {
            void chat.submit();
          }}
          onMore={onMoreActions}
          busy={chat.busy}
          error={chat.error}
          placeholder={
            scope === "squad" ? "Write to the Squad?" : "Write to the group?"
          }
        />
      ) : (
        <View style={{ paddingVertical: 12 }}>
          <Text style={{ color: colors.textSecondary }}>
            Only current members can use this chat.
          </Text>
        </View>
      )}
    </ChatKeyboardFrame>
  );
}
