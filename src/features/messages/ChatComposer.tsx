import React, { useState } from "react";
import { Keyboard, Text, TextInput, View } from "react-native";
import { ArrowUp, Plus, Smile } from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useDesignTheme } from "@/src/shared/design-system";
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
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              opacity: 0,
            }}
            onLayout={(event) => {
              const measured = Math.max(
                44,
                Math.min(120, Math.ceil(event.nativeEvent.layout.height)),
              );
              setHeight((previous) =>
                previous === measured ? previous : measured,
              );
            }}
          >
            <Text
              style={{
                fontSize: 16,
                lineHeight: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: "transparent",
              }}
            >
              {body ? body + (body.endsWith("\n") ? " " : "") : " "}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Message"
            value={body}
            onChangeText={(value) => {
              if (!value || !body) setHeight(44);
              onChange(value);
            }}
            editable={!disabled}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            style={{
              width: "100%",
              minWidth: 0,
              height: body ? height : 44,
              maxHeight: 120,
              textAlignVertical: "top",
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
        </View>
        <View style={{ width: 44 }}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "Sending message" : "Send message"}
            disabled={busy || disabled || !body.trim()}
            onPress={onSend}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.circle,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accent,
              opacity: busy || disabled || !body.trim() ? 0.5 : 1,
            }}
          >
            <ArrowUp size={23} color={colors.onAccent} />
          </MotionPressable>
        </View>
      </View>
    </View>
  );
}
