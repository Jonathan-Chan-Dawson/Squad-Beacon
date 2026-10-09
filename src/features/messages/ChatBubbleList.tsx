import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useDesignTheme, useReducedMotion } from "@/src/shared/design-system";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { radius, space } from "@/src/theme/data";
import type { Profile } from "@/src/shared/types";
import type {
  CanonicalChatMessage,
  QueuedChatMessage,
} from "./optimisticQueue";

export type ChatListEvent =
  | { kind: "message"; message: CanonicalChatMessage | QueuedChatMessage }
  | { kind: "card"; id: string; createdAt: string; content: ReactNode };
const eventId = (event: ChatListEvent) =>
  event.kind === "message" ? event.message.id : event.id;
const eventDate = (event: ChatListEvent) =>
  event.kind === "message" ? event.message.createdAt : event.createdAt;
const day = (date: string) => new Date(date).toLocaleDateString();

function Bubble({
  message,
  own,
  grouped,
  profile,
  onRetry,
  retryDisabled,
}: {
  message: CanonicalChatMessage | QueuedChatMessage;
  own: boolean;
  grouped: boolean;
  profile?: Profile;
  onRetry: (id: string) => void;
  retryDisabled: boolean;
}) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const state = "state" in message ? message.state : undefined;
  return (
    <Animated.View
      entering={state && !reducedMotion ? FadeInDown.duration(180) : undefined}
      style={{
        flexDirection: "row",
        justifyContent: own ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: space.xs,
        paddingTop: grouped ? 3 : space.sm,
        paddingBottom: 2,
      }}
    >
      {!own ? (
        <View style={{ width: 28 }}>
          {!grouped ? <ProfileAvatar profile={profile} size={28} /> : null}
        </View>
      ) : null}
      <View style={{ maxWidth: "82%", gap: 3 }}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={
            state === "failed"
              ? `${message.body}. Failed, tap to retry`
              : message.body
          }
          accessibilityHint={
            state === "failed"
              ? "Try sending this message again"
              : "Reveals the message time"
          }
          disabled={state === "failed" && retryDisabled}
          onPress={() =>
            state === "failed"
              ? onRetry(message.id)
              : setRevealedId(revealedId === message.id ? null : message.id)
          }
          style={{
            minHeight: 44,
            borderRadius: radius.md,
            paddingHorizontal: 13,
            paddingVertical: 10,
            backgroundColor: own ? colors.accent : colors.surface,
            borderWidth: own ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {!own && !grouped ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              {profile?.name ?? "Member"}
            </Text>
          ) : null}
          <Text
            style={{
              color: own ? colors.onAccent : colors.textPrimary,
              fontSize: 16,
              lineHeight: 22,
            }}
          >
            {message.body}
          </Text>
        </MotionPressable>
        {revealedId === message.id ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              textAlign: own ? "right" : "left",
            }}
          >
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        ) : null}
        {state === "sending" || state === "failed" ? (
          <Text
            style={{
              color: state === "failed" ? colors.danger : colors.textSecondary,
              fontSize: 11,
              textAlign: "right",
            }}
          >
            {state === "sending" ? "Sending…" : "Failed, tap to retry"}
          </Text>
        ) : null}
        {state === "failed" && "error" in message && message.error ? (
          <Text style={{ color: colors.danger, fontSize: 11 }}>
            {message.error}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ChatBubbleList({
  events,
  viewerId,
  profileForAuthor,
  onRetry,
  retryDisabled,
  onOpener,
  focusedId,
  scopeKey,
}: {
  events: ChatListEvent[];
  viewerId: string | null;
  profileForAuthor: (id: string) => Profile | undefined;
  onRetry: (id: string) => void;
  retryDisabled: boolean;
  onOpener: (body: string) => void;
  focusedId?: string;
  scopeKey: string;
}) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const list = useRef<FlashListRef<ChatListEvent>>(null);
  const focused = useRef("");
  const focusAttempt = useRef({ count: 0, pending: false });
  const focusedIndex = focusedId
    ? events.findIndex((event) => eventId(event) === focusedId)
    : -1;
  const focus = () => {
    const identity = `${scopeKey}:${focusedId ?? ""}`;
    if (
      focusedIndex >= 0 &&
      focused.current !== identity &&
      !focusAttempt.current.pending &&
      focusAttempt.current.count < 3 &&
      list.current
    ) {
      focusAttempt.current = {
        count: focusAttempt.current.count + 1,
        pending: true,
      };
      void list.current
        ?.scrollToIndex({
          index: focusedIndex,
          animated: false,
          viewPosition: 0.3,
        })
        .then(() => {
          focused.current = identity;
        })
        .catch(() => undefined)
        .finally(() => {
          focusAttempt.current.pending = false;
        });
    }
  };
  useEffect(() => {
    focused.current = "";
    focusAttempt.current = { count: 0, pending: false };
    focus();
  }, [focusedId, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FlashList
      key={scopeKey}
      ref={list}
      data={events}
      keyExtractor={eventId}
      onLoad={focus}
      onCommitLayoutEffect={focus}
      style={{ flex: 1, minHeight: 160 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // FlashList 2 removed inverted: use its supported bottom anchoring with chronological data.
      maintainVisibleContentPosition={{
        startRenderingFromBottom: true,
        autoscrollToBottomThreshold: 0.2,
        animateAutoScrollToBottom: !reducedMotion,
      }}
      contentContainerStyle={{ paddingVertical: space.sm }}
      ListEmptyComponent={
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 21,
              fontWeight: "700",
            }}
          >
            Start with a hello
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            A little conversation can turn into a great plan.
          </Text>
          {[
            "Hey! How’s your day?",
            "Want to make a plan?",
            "What are you up to?",
          ].map((opener) => (
            <MotionPressable
              key={opener}
              accessibilityRole="button"
              accessibilityLabel={`Insert: ${opener}`}
              onPress={() => onOpener(opener)}
              style={{
                padding: space.sm,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.accent }}>{opener}</Text>
            </MotionPressable>
          ))}
        </View>
      }
      renderItem={({ item, index }) => {
        const previous = events[index - 1];
        const newDay =
          !previous || day(eventDate(previous)) !== day(eventDate(item));
        const grouped =
          !newDay &&
          previous?.kind === "message" &&
          item.kind === "message" &&
          previous.message.authorId === item.message.authorId;
        return (
          <View>
            {newDay ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  textAlign: "center",
                  paddingVertical: 12,
                }}
              >
                {day(eventDate(item))}
              </Text>
            ) : null}
            {item.kind === "card" ? (
              <View style={{ paddingVertical: space.sm }}>{item.content}</View>
            ) : (
              <Bubble
                message={item.message}
                own={item.message.authorId === viewerId}
                grouped={grouped}
                profile={profileForAuthor(item.message.authorId)}
                onRetry={onRetry}
                retryDisabled={retryDisabled}
              />
            )}
          </View>
        );
      }}
    />
  );
}
