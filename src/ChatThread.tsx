import React, { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useBeacon } from "./store";
import { Action, Field, Txt, useTheme } from "./ui";
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
  const messages = data.messages
    .filter((m) =>
      activityId
        ? m.activity_id === activityId
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
            activity_id: activityId ?? null,
            recipient_id: personId ?? null,
            body: body.trim(),
          });
          setBody("");
        }}
      />
    </View>
  );
}
