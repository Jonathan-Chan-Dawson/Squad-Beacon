import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
  type PressableProps,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { EmojiPicker, type EmojiPickerStorage } from "rn-expo-emoji-picker";
import { useTheme } from "@/src/shared/ui";

const POPULAR_EMOJIS = ["🙌", "❤️", "👍", "😂", "🔥", "🎉", "👋", "✅"];
const QUICK_RECENTS_KEY = "beacon.reaction-quick-recents";
const QUICK_RECENTS_LIMIT = 24;
const quickRecentsListeners = new Set<(items: string[]) => void>();
let quickRecents: string[] | undefined;
let quickRecentsLoad: Promise<string[]> | undefined;
let quickRecentsWrite = Promise.resolve();

const pickerStorage: EmojiPickerStorage = {
  async getItem(key) {
    try {
      if (Platform.OS === "web")
        return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch {
      // Reaction history is a convenience; unavailable device storage should not block reactions.
    }
  },
};

function parseRecentEmojis(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, QUICK_RECENTS_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function loadQuickRecents(): Promise<string[]> {
  if (quickRecents) return Promise.resolve(quickRecents);
  if (!quickRecentsLoad) {
    const pending = Promise.resolve(pickerStorage.getItem(QUICK_RECENTS_KEY))
      .then(parseRecentEmojis)
      .then((items) => {
        quickRecents = items;
        return items;
      });
    quickRecentsLoad = pending;
  }
  return quickRecentsLoad ?? Promise.resolve([]);
}

function useQuickRecents() {
  const [items, setItems] = useState<string[]>(quickRecents ?? []);
  useEffect(() => {
    let active = true;
    const update = (next: string[]) => {
      if (active) setItems(next);
    };
    quickRecentsListeners.add(update);
    void loadQuickRecents().then(update);
    return () => {
      active = false;
      quickRecentsListeners.delete(update);
    };
  }, []);
  return items;
}

function rememberQuickEmoji(emoji: string) {
  void loadQuickRecents().then((items) => {
    const next = [emoji, ...items.filter((item) => item !== emoji)].slice(0, QUICK_RECENTS_LIMIT);
    quickRecents = next;
    quickRecentsListeners.forEach((listener) => listener(next));
    quickRecentsWrite = quickRecentsWrite
      .catch(() => {})
      .then(() => pickerStorage.setItem(QUICK_RECENTS_KEY, JSON.stringify(next)));
  });
}

export function ReactionPicker({
  selectedEmoji,
  disabled = false,
  error = "",
  onSelect,
  onOpen,
  trigger,
}: {
  selectedEmoji?: string;
  disabled?: boolean;
  error?: string;
  onSelect: (emoji: string) => Promise<boolean | void> | boolean | void;
  onOpen?: () => void;
  trigger: React.ReactElement<PressableProps>;
}) {
  const { semanticColors: colors, resolvedAppearance, tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const choosingRef = useRef(false);
  const recents = useQuickRecents();
  const [mode, setMode] = useState<"closed" | "quick" | "picker">("closed");
  const [anchor, setAnchor] = useState<LayoutRectangle>({ x: 8, y: 8, width: 44, height: 44 });
  const quickEmojiCount = Math.max(1, Math.min(5, Math.floor((width - 52) / 42)));
  const popular = [selectedEmoji, ...recents, ...POPULAR_EMOJIS].filter(
    (emoji, index, all): emoji is string => !!emoji && all.indexOf(emoji) === index,
  ).slice(0, quickEmojiCount);
  const quickWidth = (quickEmojiCount + 1) * 42 + 10;
  const left = Math.max(8, Math.min(width - quickWidth - 8, anchor.x + anchor.width / 2 - quickWidth / 2));
  const above = anchor.y - 62 >= 8;
  const top = above
    ? anchor.y - 62
    : Math.min(height - 62, anchor.y + anchor.height + 8);
  const close = () => setMode("closed");

  const open = useCallback(() => {
    if (disabled) return;
    anchorRef.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      setAnchor({ x, y, width: anchorWidth, height: anchorHeight });
      setMode("quick");
    });
  }, [disabled]);

  const triggerElement = React.cloneElement(trigger, {
    disabled,
    onPress: () => {
      onOpen?.();
      open();
    },
  });

  const choose = async (emoji: string) => {
    if (disabled || choosingRef.current) return;
    choosingRef.current = true;
    try {
      const succeeded = await onSelect(emoji);
      if (succeeded === false) return;
      rememberQuickEmoji(emoji);
      close();
    } catch {
      // Callers surface failures in the popover through their error prop.
    } finally {
      choosingRef.current = false;
    }
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {triggerElement}
      </View>
      <Modal
        visible={mode !== "closed"}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Close reaction picker"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: mode === "picker" ? "rgba(0,0,0,0.48)" : "transparent" },
            ]}
            onPress={close}
          />
          {mode === "quick" ? (
            <View
              accessibilityRole="menu"
              style={{
                position: "absolute",
                top,
                left,
                flexDirection: "row",
                alignItems: "center",
                padding: 5,
                borderRadius: 18,
                gap: 2,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 5 },
                elevation: 8,
              }}
            >
              {popular.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                  accessibilityState={{ selected: selectedEmoji === emoji, disabled }}
                  disabled={disabled}
                  onPress={() => void choose(emoji)}
                  style={{
                    minWidth: 40,
                    minHeight: 42,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selectedEmoji === emoji ? colors.surfaceRaised : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 25 }}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More reactions"
                onPress={() => setMode("picker")}
                style={{
                  minWidth: 40,
                  minHeight: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 23 }}>+</Text>
              </Pressable>
              {!!error && (
                <Text accessibilityRole="alert" style={{ position: "absolute", top: 51, left: 8, width: 260, color: colors.danger, fontSize: 13 }}>
                  {error}
                </Text>
              )}
            </View>
          ) : mode === "picker" ? (
            <View
              accessibilityViewIsModal
              style={{
                width: Math.min(width - 32, 520),
                height: Math.min(height - 56, 680),
                alignSelf: "center",
                marginVertical: "auto",
                overflow: "hidden",
                borderRadius: tokens.radius.card,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                elevation: 12,
              }}
            >
              <View
                style={{
                  minHeight: 54,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                  <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "600" }}>
                  Choose a reaction
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close emoji picker"
                  hitSlop={8}
                  onPress={close}
                  style={{ minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 25 }}>×</Text>
                </Pressable>
              </View>
              <EmojiPicker
                colorScheme={resolvedAppearance}
                storage={pickerStorage}
                storageKey="beacon.reaction-picker-recents"
                enableRecentlyUsed
                enableSearch
                theme={{
                  colors: {
                    background: colors.surface,
                    text: colors.textPrimary,
                    secondaryText: colors.textSecondary,
                    accent: colors.accent,
                    searchBackground: colors.surfaceRaised,
                    searchText: colors.textPrimary,
                    searchPlaceholder: colors.textSecondary,
                    divider: colors.border,
                    categoryBarBackground: colors.surface,
                    categoryActiveBackground: colors.surfaceRaised,
                    overlayBackdrop: "rgba(0,0,0,0.3)",
                    overlaySurface: colors.surface,
                  },
                }}
                style={{ flex: 1 }}
                onEmojiSelected={(selection) => void choose(selection.emoji)}
              />
              {!!error && (
                <Text accessibilityRole="alert" style={{ paddingHorizontal: 16, paddingBottom: 10, color: colors.danger }}>
                  {error}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: "center", alignItems: "center" } });

