import React, { useEffect, useId, useRef, useState } from "react";
import { Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import {
  canWriteBeaconModule,
  isBeaconModuleEnabled,
} from "@/src/features/beacons/permissions";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { Button, Sheet } from "@/src/shared/ui";
import { ChatKeyboardFrame } from "./ChatKeyboard";
import { ChatBubbleList } from "./ChatBubbleList";
import { ChatComposer } from "./ChatComposer";
import { useOptimisticChat } from "./useOptimisticChat";
import { useChatReadPosition } from "./useChatReadPosition";
import { compareChatMessages } from "./readMarkers";

export function ChatThread({
  activityId,
  personId,
  inlineActions = false,
  onPerson,
}: {
  activityId?: string;
  personId?: string;
  inlineActions?: boolean;
  onPerson?: (id: string) => void;
}) {
  const { colors } = useDesignTheme();
  const { data, userId, act } = useBeacon();
  const router = useRouter();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [sendSignal, setSendSignal] = useState(0);
  const seed = useId();
  const intent = useRef(0);
  const activity = activityId
    ? data.activities.find((item) => item.id === activityId)
    : undefined;
  const matchesViewer = !!userId && data.viewer_id === userId;
  const person = personId
    ? selectPersonPreview(data, personId, userId)
    : undefined;
  const canRead =
    matchesViewer &&
    (activityId
      ? !!activity && canUseBeaconModules(data, activity, userId!)
      : !!person?.canMessage);
  const canWrite =
    canRead &&
    (activityId
      ? !!activity && canWriteBeaconModule(data, activity, userId!, "chat")
      : !!person?.canMessage);
  const canonical = canRead
    ? data.messages
        .filter((message) =>
          activityId
            ? message.activity_id === activityId
            : !message.activity_id &&
              ((message.author_id === userId &&
                message.recipient_id === personId) ||
                (message.author_id === personId &&
                  message.recipient_id === userId)),
        )
        .map((message) => ({
          id: message.id,
          authorId: message.author_id,
          body: message.body,
          createdAt: message.created_at,
        }))
    : [];
  const scope = `${userId ?? "signed-out"}:${activityId ? "beacon" : "dm"}:${activityId ?? personId ?? "unavailable"}`;
  const actionScope = useRef(scope);
  useEffect(() => {
    actionScope.current = scope;
    return () => {
      actionScope.current = "unmounted";
    };
  }, [scope]);
  const squadId =
    activity?.audience === "squad" &&
    activity.audience_id &&
    activeSquadMembership(data, activity.audience_id, userId)
      ? activity.audience_id
      : undefined;
  const navigateAfterClose = (navigate: () => void) => {
    setActionsOpen(false);
    const requestedScope = scope;
    setTimeout(() => {
      if (actionScope.current === requestedScope) navigate();
    }, 320);
  };
  const chat = useOptimisticChat({
    scope,
    authorId: userId,
    canonical,
    canWrite,
    send: (body) =>
      act("send_message", {
        ...(activityId
          ? { activity_id: activityId }
          : { recipient_id: personId }),
        body,
      }),
  });
  const events = [...canonical, ...(canRead ? chat.rows : [])]
    .sort(compareChatMessages)
    .map((message) => ({ kind: "message" as const, message }));
  const read = useChatReadPosition({
    scopeKey: scope,
    canonical,
    marker: data.dm_message_reads.find(
      (row) => row.user_id === userId && row.peer_id === personId,
    ),
    action: "mark_dm_chat_read",
    payload: { peer_id: personId },
    enabled: canRead && !!personId && !activityId,
  });
  const readOnlyText = activityId
    ? canRead && activity
      ? activity.status === "cancelled"
        ? "This Beacon was cancelled. Earlier messages stay visible."
        : !isBeaconModuleEnabled(activity, "chat")
          ? "The host has paused chat. Earlier messages stay visible."
          : "Chat is read-only for this Beacon."
      : "Only the host and approved Going participants can use this chat."
    : "A current friendship is required to read and send messages.";
  return (
    <ChatKeyboardFrame compact={inlineActions}>
      <View
        style={{
          flex: 1,
          minHeight: 0,
          display: inlineActions && actionsOpen ? "none" : "flex",
        }}
      >
        <ChatBubbleList
          presentation={personId ? "direct" : "group"}
          firstUnreadId={read.firstUnreadId}
          onLatestVisible={read.onLatestVisible}
          sendSignal={sendSignal}
          events={events}
          viewerId={userId}
          scopeKey={scope}
          onAuthorPress={
            onPerson ??
            ((id) => router.push({ pathname: "/person/[id]", params: { id } }))
          }
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
            onMore={() => setActionsOpen(true)}
            busy={chat.busy}
            error={chat.error}
          />
        ) : (
          <View style={{ paddingVertical: 12 }}>
            <Text style={{ color: colors.textSecondary }}>{readOnlyText}</Text>
          </View>
        )}
      </View>
      <ChatActions
        inline={inlineActions}
        title="Add to chat"
        visible={actionsOpen && canWrite}
        onClose={() => setActionsOpen(false)}
      >
        <Button
          title="Ping"
          onPress={() => {
            const pingSeed = `${seed}-${++intent.current}`;
            navigateAfterClose(() =>
              squadId
                ? router.push({
                    pathname: "/councils",
                    params: { squadId, newPing: "yes", pingSeed },
                  })
                : router.push("/councils"),
            );
          }}
        />
        <Button
          secondary
          title="Create Beacon"
          onPress={() =>
            navigateAfterClose(() =>
              squadId
                ? router.push({
                    pathname: "/create",
                    params: { kind: "squad", squadId },
                  })
                : router.push("/create"),
            )
          }
        />
        <Button
          secondary
          title="Plan"
          onPress={() => {
            const planSeed = `${seed}-plan-${++intent.current}`;
            navigateAfterClose(() =>
              router.push({
                pathname: "/plans",
                params: {
                  ...(squadId ? { squadId } : {}),
                  create: "yes",
                  planSeed,
                },
              }),
            );
          }}
        />
      </ChatActions>
    </ChatKeyboardFrame>
  );
}

function ChatActions({
  inline,
  title,
  visible,
  onClose,
  children,
}: React.ComponentProps<typeof Sheet> & { inline: boolean }) {
  if (!inline)
    return (
      <Sheet title={title} visible={visible} onClose={onClose}>
        {children}
      </Sheet>
    );
  if (!visible) return null;
  return (
    <ScrollView
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ gap: 8, padding: 12 }}
    >
      <Button title="Back to chat" compact secondary onPress={onClose} />
      {children}
    </ScrollView>
  );
}
