import React, { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Field, Txt, useTheme } from "@/src/shared/ui";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canWriteBeaconModule, isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
export function ChatThread({
  activityId,
  personId,
}: {
  activityId?: string;
  personId?: string;
}) {
  const { styles, colors } = useTheme();

  const { data, userId, act } = useBeacon();
  const [body, setBody] = useState("");
  const scroll = useRef<ScrollView>(null);
  const activity = activityId
    ? data.activities.find((item) => item.id === activityId)
    : undefined;
  const canReadActivityChat = !!activity && !!userId &&
    canUseBeaconModules(data, activity, userId);
  const canWriteActivityChat = !!activity && !!userId &&
    canWriteBeaconModule(data, activity, userId, "chat");
  const messages = data.messages
    .filter((m) =>
      activityId
        ? canReadActivityChat && m.activity_id === activityId
        : !m.activity_id &&
          ((m.author_id === userId && m.recipient_id === personId) ||
            (m.author_id === personId && m.recipient_id === userId)),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <View style={{ flex: 1, minHeight: 200, gap: 10 }}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingVertical: 8, flexGrow: 1 }}
      >
        {!messages.length && (
          <View style={{ padding: 18 }}>
            <Text style={styles.h2}>Start with a hello.</Text>
            <Txt muted>
              {activityId
                ? "Meet-up details, who's bringing what, and a quick 'on my way'. Only the host and people going can read this chat."
                : "A little conversation can turn into a great plan."}
            </Txt>
          </View>
        )}
        {messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.author_id === userId ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: 12,
              gap: 4,
              borderRadius: 16,
              backgroundColor:
                m.author_id === userId ? colors.lime : colors.white,
            }}
          >
            <Text style={styles.label}>
              {m.author_id === userId
                ? "You"
                : (data.profiles.find((p) => p.id === m.author_id)?.name ??
                  "Friend")}
            </Text>
            <Txt>{m.body}</Txt>
            <Txt muted>
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Txt>
          </View>
        ))}
      </ScrollView>
      {activityId ? (
        canWriteActivityChat ? (
          <>
            <Field
              label="Message"
              placeholder="Say something..."
              value={body}
              onChangeText={setBody}
              maxLength={2000}
            />
            <Action
              title="Send message"
              run={async () => {
                if (!body.trim()) throw new Error("Write a message first.");
                await act("send_message", {
                  activity_id: activityId,
                  body: body.trim(),
                });
                setBody("");
              }}
            />
          </>
        ) : (
          <Txt muted>
            {activity && canReadActivityChat
              ? activity.status === "cancelled"
                ? "This beacon was cancelled. Chat is read-only; earlier messages stay visible."
                : !isBeaconModuleEnabled(activity, "chat")
                  ? "This beacon's chat is paused by the host. Earlier messages stay visible."
                  : "Chat is unavailable for this beacon."
              : "Only the host and approved Going participants can use this chat."}
          </Txt>
        )
      ) : (
        <>
          <Field
            label="Message"
            placeholder="Say something..."
            value={body}
            onChangeText={setBody}
            maxLength={2000}
          />
          <Action
            title="Send message"
            run={async () => {
              if (!body.trim()) throw new Error("Write a message first.");
              await act("send_message", {
                recipient_id: personId ?? null,
                body: body.trim(),
              });
              setBody("");
            }}
          />
        </>
      )}
    </View>
  );
}
