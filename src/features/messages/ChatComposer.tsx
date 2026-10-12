import React, { useState } from "react";
import { Keyboard, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowUp, Plus, Smile } from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useDesignTheme, useReducedMotion } from "@/src/shared/design-system";
import { radius, space } from "@/src/theme/data";

export function ChatComposer({
  body,
  onChange,
  onSend,
  onMore,
  busy,
  disabled,
  error,
  placeholder = "Message…",
}: {
  body: string;
  onChange: (body: string) => void;
  onSend: () => void;
  onMore?: () => void;
  busy: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState(44);
  const [emojiOpen, setEmojiOpen] = useState(false);
  return (
    <View style={{ paddingTop: space.sm, gap: space.xs }}>
      {emojiOpen && !disabled ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: radius.md,
          }}
        >
          {["👍", "❤️", "😂", "🎉", "👋", "✅"].map((emoji) => (
            <MotionPressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Insert ${emoji}`}
              disabled={body.length + emoji.length > 2000}
              onPress={() => {
                onChange(body + emoji);
                setEmojiOpen(false);
              }}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 23 }}>{emoji}</Text>
            </MotionPressable>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <View
        style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}
      >
        {onMore ? (
          <MotionPressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Add to chat"
            onPress={() => {
              Keyboard.dismiss();
              onMore();
            }}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={23} color={colors.accent} />
          </MotionPressable>
        ) : null}
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Choose emoji"
          accessibilityState={{ expanded: emojiOpen, disabled: !!disabled }}
          disabled={disabled}
          onPress={() => setEmojiOpen(!emojiOpen)}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Smile size={22} color={colors.textSecondary} />
        </MotionPressable>
        <TextInput
          accessibilityLabel="Message"
          value={body}
          onChangeText={onChange}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={2000}
          onContentSizeChange={(event) =>
            setHeight(
              Math.max(
                44,
                Math.min(122, event.nativeEvent.contentSize.height + 20),
              ),
            )
          }
          style={{
            flex: 1,
            minWidth: 0,
            height: body ? height : 44,
            maxHeight: 122,
            lineHeight: 20,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 16,
          }}
        />
        {body.trim() ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(160)}
            exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          >
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={busy ? "Sending message" : "Send message"}
              disabled={busy || disabled}
              onPress={onSend}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.circle,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.accent,
                opacity: busy || disabled ? 0.5 : 1,
              }}
            >
              <ArrowUp size={23} color={colors.onAccent} />
            </MotionPressable>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
