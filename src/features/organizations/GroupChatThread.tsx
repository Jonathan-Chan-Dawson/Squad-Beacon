import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { canRespondToPlanningThread } from "@/src/features/planning/domain";
import {
  selectSquadChatPings,
  visibleSquadPingResponses,
} from "@/src/features/organizations/squadChat";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  Field,
  IconButton,
  Txt,
  useTheme,
} from "@/src/shared/ui";
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
  const { styles, colors } = useTheme();
  const { data, userId, act } = useBeacon();
  const router = useRouter();
  const [body, setBody] = useState("");
  const scroll = useRef<ScrollView>(null);
  const actRef = useRef(act);
  const pingOffsets = useRef(new Map<string, number>());
  useEffect(() => {
    actRef.current = act;
  }, [act]);

  const scopeId = scope === "organization" ? organizationId : squadId;
  const group = useMemo(
    () =>
      data.group_messages
        .filter(
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
        .sort((first, second) =>
          first.created_at.localeCompare(second.created_at),
        ),
    [data.group_messages, data.blocks, scope, scopeId, userId],
  );
  const pings = useMemo(
    () =>
      scope === "squad" && scopeId && userId
        ? selectSquadChatPings(data, scopeId, userId)
        : [],
    [data, scope, scopeId, userId],
  );
  const events = useMemo(
    () =>
      [
        ...group.map((message) => ({
          kind: "message" as const,
          id: message.id,
          created_at: message.created_at,
          message,
        })),
        ...pings.map((thread) => ({
          kind: "ping" as const,
          id: thread.id,
          created_at: thread.created_at,
          thread,
          responses: userId
            ? visibleSquadPingResponses(data, thread, userId)
            : [],
        })),
      ].sort(
        (first, second) =>
          first.created_at.localeCompare(second.created_at) ||
          first.id.localeCompare(second.id),
      ),
    [data, group, pings, userId],
  );
  const latestEventAt = events.at(-1)?.created_at ?? "";

  useEffect(() => {
    if (!scopeId) return;
    void actRef.current("mark_group_chat_read", {
      scope,
      ...(scope === "organization"
        ? { organization_id: scopeId }
        : { squad_id: scopeId }),
    }).catch(() => undefined);
  }, [scope, scopeId, latestEventAt]);

  useEffect(() => {
    if (!focusedPingId) return;
    const offset = pingOffsets.current.get(focusedPingId);
    if (offset != null)
      scroll.current?.scrollTo({
        y: Math.max(0, offset - 12),
        animated: false,
      });
  }, [focusedPingId, events.length]);

  return (
    <View style={{ flex: 1, minHeight: 260, gap: 10 }}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          const offset = focusedPingId
            ? pingOffsets.current.get(focusedPingId)
            : undefined;
          if (offset != null)
            scroll.current?.scrollTo({
              y: Math.max(0, offset - 12),
              animated: false,
            });
          else scroll.current?.scrollToEnd({ animated: false });
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingVertical: 8, flexGrow: 1 }}
      >
        {!events.length && (
          <View style={{ padding: 18 }}>
            <Text style={styles.h2}>A good place to start.</Text>
            <Txt muted>
              {scope === "organization"
                ? "Share a plan, ask a question, or send the first hello."
                : "Keep the squad in the loop and make the next meetup happen."}
            </Txt>
          </View>
        )}
        {events.map((event) => {
          if (event.kind === "message") {
            const { message } = event;
            return (
              <View
                key={`message:${message.id}`}
                style={{
                  alignSelf:
                    message.author_id === userId ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  padding: 12,
                  gap: 4,
                  borderRadius: 16,
                  backgroundColor:
                    message.author_id === userId ? colors.lime : colors.white,
                }}
              >
                <Text style={styles.label}>
                  {message.author_id === userId
                    ? "You"
                    : data.profiles.find(
                        (profile) => profile.id === message.author_id,
                      )?.name ?? "Member"}
                </Text>
                <Txt>{message.body}</Txt>
                <Txt muted>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Txt>
              </View>
            );
          }

          const { thread, responses } = event;
          const counts = {
            interested: responses.filter(
              (response) => response.response === "interested",
            ).length,
            maybe: responses.filter((response) => response.response === "maybe")
              .length,
            pass: responses.filter((response) => response.response === "pass")
              .length,
          };
          const myResponse = userId
            ? responses.find((response) => response.user_id === userId)
            : undefined;
          const canReply =
            !!userId &&
            data.viewer_id === userId &&
            thread.owner_id !== userId &&
            canRespondToPlanningThread(data, thread, userId);
          const focused = focusedPingId === thread.id;
          return (
            <View
              key={`ping:${thread.id}`}
              onLayout={(event) => {
                const offset = event.nativeEvent.layout.y;
                pingOffsets.current.set(thread.id, offset);
                if (focusedPingId === thread.id)
                  scroll.current?.scrollTo({
                    y: Math.max(0, offset - 12),
                    animated: false,
                  });
              }}
              accessibilityLabel={`Squad Ping: ${thread.title}`}
              style={[
                styles.card,
                {
                  alignSelf: "stretch",
                  padding: 12,
                  gap: 8,
                  borderWidth: focused ? 2 : 1,
                  borderColor: focused ? colors.green : colors.line,
                  backgroundColor: focused ? colors.lime : colors.white,
                },
              ]}
            >
              <Text style={styles.label}>SQUAD PING</Text>
              <Text style={styles.h2}>{thread.title}</Text>
              {thread.body ? <Txt>{thread.body}</Txt> : null}
              {myResponse ? (
                <Txt muted>
                  You said {myResponse.response[0].toUpperCase() + myResponse.response.slice(1)}
                </Txt>
              ) : null}
              <Txt muted>
                {counts.interested} Interested · {counts.maybe} Maybe · {counts.pass} Pass
              </Txt>
              {canReply ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["interested", "maybe", "pass"] as const).map(
                    (response) => (
                      <View key={response} style={{ flex: 1, minWidth: 0 }}>
                        <Action
                          compact
                          secondary={response !== "interested"}
                          title={response[0].toUpperCase() + response.slice(1)}
                          run={() =>
                            act("respond_planning_ping", {
                              thread_id: thread.id,
                              response,
                              auto_rsvp: false,
                            })
                          }
                        />
                      </View>
                    ),
                  )}
                </View>
              ) : null}
              <Button
                compact
                secondary
                title="Open Ping details"
                onPress={() =>
                  router.push({
                    pathname: "/council/[id]",
                    params: { id: thread.id },
                  })
                }
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {onMoreActions ? (
          <IconButton label="Add to Squad chat" onPress={onMoreActions}>
            <Plus size={20} color={colors.green} />
          </IconButton>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Field
            label="Message"
            placeholder={
              scope === "squad" ? "Write to the squad…" : "Write to the group…"
            }
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            style={{ minHeight: 48, maxHeight: 110 }}
          />
        </View>
        <View style={{ width: 112 }}>
          <Action
            compact
            title="Send message"
            run={async () => {
              if (!scopeId) throw new Error("That group chat is unavailable.");
              if (!body.trim()) throw new Error("Write a message first.");
              await act("send_group_message", {
                scope,
                ...(scope === "organization"
                  ? { organization_id: scopeId }
                  : { squad_id: scopeId }),
                body: body.trim(),
              });
              setBody("");
            }}
          />
        </View>
      </View>
    </View>
  );
}
