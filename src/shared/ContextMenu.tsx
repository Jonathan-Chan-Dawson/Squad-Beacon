import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet, useOverlayPresence } from "./ui";
import { useDesignTheme } from "./design-system";

export function ActionRow({
  label,
  icon,
  onPress,
  disabled = false,
  selected = false,
  danger = false,
  detail,
  count,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
  detail?: string;
  count?: number;
  testID?: string;
}) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor:
          pressed || selected ? colors.surfaceRaised : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {icon ? (
        <View style={{ width: 20, alignItems: "center" }}>{icon}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            color: danger ? colors.danger : colors.textPrimary,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {count != null && count > 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
export function MenuGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useDesignTheme();
  return (
    <View
      style={{
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {title ? (
        <Text
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            fontSize: 11,
            lineHeight: 16,
            color: colors.textSecondary,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Small dropdowns anchor on every platform; contextual menus use phone sheets. */
export function ContextMenu({
  title,
  visible,
  onClose,
  onDismiss,
  anchorRef,
  mode = "context",
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  anchorRef: React.RefObject<View | null>;
  mode?: "context" | "dropdown";
  children: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useDesignTheme();
  const id = useId();
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [fallback, setFallback] = useState(false);
  const [contentHeight, setContentHeight] = useState(
    mode === "dropdown" ? 220 : 420,
  );
  const dialogRef = useRef<View>(null);
  const lifecycle = useRef({
    open: false,
    restore: null as HTMLElement | null,
  });
  const callbacks = useRef({ onClose, onDismiss });
  useLayoutEffect(() => { callbacks.current = { onClose, onDismiss }; }, [onClose, onDismiss]);
  const phoneSheet = mode === "context" && width < 768;
  const sheet = phoneSheet || fallback;
  const anchored = !sheet;
  const menuWidth = Math.min(
    mode === "dropdown" ? 280 : 340,
    width - insets.left - insets.right - 24,
  );
  const maxHeight = Math.max(80, height - insets.top - insets.bottom - 24);
  const left = Math.max(
    insets.left + 12,
    Math.min(
      width - insets.right - menuWidth - 12,
      (anchor?.x ?? 12) + (anchor?.width ?? 0) - menuWidth,
    ),
  );
  const below = (anchor?.y ?? 0) + (anchor?.height ?? 0) + 6;
  const top = Math.max(
    insets.top + 12,
    Math.min(
      height - insets.bottom - Math.min(contentHeight, maxHeight) - 12,
      below + contentHeight <= height - insets.bottom - 12
        ? below
        : (anchor?.y ?? 0) - contentHeight - 6,
    ),
  );
  useOverlayPresence(id, visible && anchored, title);
  useLayoutEffect(() => {
    if (!visible || phoneSheet) return;
    if (!anchorRef.current) {
      setFallback(true);
      return;
    }
    anchorRef.current.measureInWindow((x, y, w, h) => {
      if (
        w <= 0 ||
        h <= 0 ||
        y + h < 0 ||
        y > height ||
        x + w < 0 ||
        x > width
      ) {
        setFallback(true);
        return;
      }
      setAnchor({ x, y, width: w, height: h });
    });
  }, [visible, phoneSheet, anchorRef, width, height]);
  const finishDismiss = useCallback(() => {
    if (!lifecycle.current.open) return;
    lifecycle.current.open = false;
    const target = lifecycle.current.restore;
    lifecycle.current.restore = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
    callbacks.current.onDismiss?.();
  }, []);
  useLayoutEffect(() => {
    if (!anchored) return;
    if (visible && !lifecycle.current.open) {
      lifecycle.current.open = true;
      lifecycle.current.restore =
        Platform.OS === "web" && typeof document !== "undefined"
          ? (document.activeElement as HTMLElement)
          : null;
    } else if (!visible && Platform.OS === "android") {
      // Android Modal has no dismissal callback; with no animation the hidden
      // native modal has committed before this layout effect runs.
      finishDismiss();
    }
  }, [visible, anchored, finishDismiss]);
  useEffect(() => {
    if (!visible || !anchored || Platform.OS !== "web") return;
    const inside = (event: Event) =>
      (dialogRef.current as unknown as HTMLElement | null)?.contains(
        event.target as Node,
      );
    const dismiss = () => callbacks.current.onClose();
    const scroll = (event: Event) => {
      if (inside(event)) return;
      const target = anchorRef.current as unknown as HTMLElement | null;
      const rectangle = target?.getBoundingClientRect?.();
      // Follow the trigger through focus/scroll adjustments while it remains
      // visible. Background-tab scrolling must not dismiss a foreground menu.
      if (!rectangle || rectangle.bottom < 0 || rectangle.top > height || rectangle.right < 0 || rectangle.left > width) dismiss();
      else if (!anchor || Math.abs(rectangle.x - anchor.x) > 1 || Math.abs(rectangle.y - anchor.y) > 1)
        setAnchor({ x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height });
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const root = dialogRef.current as unknown as HTMLElement | null;
      const items = Array.from(
        root?.querySelectorAll<HTMLElement>(
          '[role="button"]:not([aria-disabled="true"])',
        ) ?? [],
      );
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) %
              items.length;
      items[next].focus();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    document.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
      document.removeEventListener("keydown", keydown, true);
    };
  }, [visible, anchored, anchor, anchorRef, height, width]);
  const focus = useCallback(() => {
    if (Platform.OS !== "web") return;
    const root = dialogRef.current as unknown as HTMLElement | null;
    root
      ?.querySelector<HTMLElement>(
        '[role="button"]:not([aria-disabled="true"])',
      )
      ?.focus({ preventScroll: true });
  }, []);
  if (sheet)
    return (
      <Sheet
        title={title}
        visible={visible}
        onClose={onClose}
        onDismiss={onDismiss}
        maxHeightPercent={80}
      >
        {children}
      </Sheet>
    );
  return (
    <Modal
      visible={visible && !!anchor}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={focus}
      onDismiss={finishDismiss}
      accessibilityLabel={title}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title}`}
          onPress={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.16)",
          }}
        />
        <View
          ref={dialogRef}
          role={Platform.OS === "web" ? undefined : "dialog"}
          accessibilityLabel={Platform.OS === "web" ? undefined : title}
          accessibilityViewIsModal
          testID="anchored-context-menu"
          onLayout={(event) =>
            setContentHeight(event.nativeEvent.layout.height)
          }
          style={{
            position: "absolute",
            left,
            top,
            width: menuWidth,
            maxHeight,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 6,
          }}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 18,
              padding: 10,
            }}
          >
            {title}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
