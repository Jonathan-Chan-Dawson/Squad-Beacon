import { PlanChatPreview } from "@/src/features/plans/PlanChatPreview";
import {LinkedPlanningBeacon} from "@/src/features/planning/ConnectedPlanningActions";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  canReadPlanningThread,
  normalizePlanningData,
  canRespondToPlanningThread,
} from "@/src/features/planning/domain";
import { canReadOrganizationMembers } from "./domain";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { canViewProfile } from "@/src/features/profile/privacy";
import { Button, Sheet } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { useChatReadPosition } from "@/src/features/messages/useChatReadPosition";
import { compareChatMessages } from "@/src/features/messages/readMarkers";
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
  const now = useNow();
  const [itemsOpen, setItemsOpen] = useState(false);
  const [sendSignal, setSendSignal] = useState(0);
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
  const planning =
    canWrite && scope === "squad" && userId
      ? normalizePlanningData(data).planning_threads.filter(
          (thread) =>
            thread.audience === "squad" &&
            thread.audience_id === scopeId &&
            thread.status !== "cancelled" &&
            canReadPlanningThread(data, thread, userId),
        )
      : [];
  const activeItems = planning.filter(
    (thread) =>
      thread.status === "open" && Date.parse(thread.deadline_at) > now,
  );
  const read = useChatReadPosition({
    scopeKey: conversationKey,
    canonical,
    marker: data.group_message_reads.find(
      (row) =>
        row.user_id === userId &&
        row.scope === scope &&
        row.scope_id === scopeId,
    ),
    action: "mark_group_chat_read",
    payload: { scope, squad_id: squadId, organization_id: organizationId },
    enabled: canWrite,
  });
  function openItem(id: string) {
    if (!planning.some((thread) => thread.id === id)) return;
    setItemsOpen(false);
    router.push({ pathname: "/council/[id]", params: { id } });
  }
  const events: ChatListEvent[] = [
    ...canonical,
    ...(canWrite ? chat.rows : []),
  ].map((message) => ({ kind: "message", message }));
  for (const message of group.filter(m=>m.plan_id)) {
    events.push({kind:"card",id:`plan:${message.id}`,createdAt:message.created_at,content:<PlanChatPreview planId={message.plan_id!} />});
  }
  for (const thread of planning) {
    const canReply =
      !!userId &&
      thread.owner_id !== userId &&
      canRespondToPlanningThread(data, thread, userId);
    const status =
      thread.status === "open" && Date.parse(thread.deadline_at) <= now
        ? "expired"
        : thread.status;
    events.push({
      kind: "card",
      id: thread.id,
      createdAt: thread.created_at,
      content: (
        <View><Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${thread.kind} ${thread.title}`}
          onPress={() => openItem(thread.id)}
          style={{
            minHeight: 64,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.accent, fontSize: 11 }}>
              {thread.kind.toUpperCase()} · {status}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontWeight: "600",
                marginTop: 3,
              }}
            >
              {thread.title}
            </Text>
          </View>
          <Text style={{ color: colors.accent, fontSize: 12 }}>
            {canReply ? "Respond" : "Open"} ›
          </Text>
        </Pressable>{thread.materialized_activity_id && <LinkedPlanningBeacon thread={thread}/>}</View>
      ),
    });
  }
  const eventDate = (event: ChatListEvent) =>
    event.kind === "message" ? event.message.createdAt : event.createdAt;
  events.sort((a, b) =>
    compareChatMessages(
      {
        id: a.kind === "message" ? a.message.id : a.id,
        createdAt: eventDate(a),
      },
      {
        id: b.kind === "message" ? b.message.id : b.id,
        createdAt: eventDate(b),
      },
    ),
  );
  return (
    <ChatKeyboardFrame
      compact={scope === "organization"}
      avoidKeyboard={scope !== "organization"}
    >
      {activeItems.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${activeItems.length} active planning items`}
          onPress={() =>
            activeItems.length === 1
              ? openItem(activeItems[0].id)
              : setItemsOpen(true)
          }
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: colors.textSecondary, fontSize: 12 }}
          >
            {activeItems.length === 1
              ? `${activeItems[0].kind.toUpperCase()} · ${activeItems[0].title}`
              : `${activeItems.length} active Pings, Votes & Draws`}
          </Text>
          <Text style={{ color: colors.accent }}>View ›</Text>
        </Pressable>
      ) : null}
      <ChatBubbleList
        presentation="group"
        firstUnreadId={read.firstUnreadId}
        onLatestVisible={read.onLatestVisible}
        sendSignal={sendSignal}
        onAuthorPress={(id) =>
          router.push({ pathname: "/person/[id]", params: { id } })
        }
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
            setSendSignal((value) => value + 1);
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
      <Sheet
        title="Active Pings, Votes & Draws"
        visible={itemsOpen && canWrite}
        onClose={() => setItemsOpen(false)}
      >
        {activeItems.map((thread) => (
          <Button
            secondary
            key={thread.id}
            title={`${thread.kind.toUpperCase()} · ${thread.title}`}
            onPress={() => openItem(thread.id)}
          />
        ))}
      </Sheet>
    </ChatKeyboardFrame>
  );
}
