import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DialogPortal } from "./DialogPortal";
import { useReducedMotion } from "./design-system";
import { focusOverlay, useOverlayKeyboardFocus } from "./overlayFocus";
import { useTheme } from "./ui";
import { useOverlayPresence, useTopOverlay } from "./overlays";

type DialogProps = {
  title: string;
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  children?: React.ReactNode;
};

/** A centered presentation registered in the same stack as Sheet and ContextMenu. */
export function Dialog({
  title,
  visible,
  onClose,
  onDismiss,
  children,
  footer,
  busy = false,
  initialFocusLabel,
  initialFocusRef,
}: DialogProps & {
  footer?: React.ReactNode;
  busy?: boolean;
  initialFocusLabel?: string;
  initialFocusRef?: React.RefObject<View | null>;
}) {
  const { semanticColors: colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const id = useId();
  const titleId = `${id}-title`;
  const [presented, setPresented] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  const root = useRef<View>(null);
  const restore = useRef<HTMLElement | null>(null);
  const opened = useRef(false);
  const callbacks = useRef({ onClose, onDismiss, busy, visible });
  useLayoutEffect(() => {
    callbacks.current = { onClose, onDismiss, busy, visible };
  });
  useOverlayPresence(id, presented, title);
  const top = useTopOverlay(id);
  const close = useCallback(() => {
    if (callbacks.current.visible && !callbacks.current.busy)
      callbacks.current.onClose();
  }, []);
  const focus = useCallback(() => {
    if (Platform.OS === "web") focusOverlay(root, initialFocusLabel);
    else if (initialFocusRef?.current) {
      const handle = findNodeHandle(initialFocusRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [initialFocusLabel, initialFocusRef]);
  const finish = useCallback(() => {
    if (!opened.current || callbacks.current.visible) return;
    opened.current = false;
    const target = restore.current;
    restore.current = null;
    const complete = () => {
      if (callbacks.current.visible) return;
      if (target?.isConnected && !target.closest('[aria-hidden="true"]'))
        target.focus({ preventScroll: true });
      callbacks.current.onDismiss?.();
    };
    // Give SheetIsolation and the previous overlay a commit to become accessible.
    if (Platform.OS === "web") requestAnimationFrame(complete);
    else complete();
  }, []);
  useLayoutEffect(() => {
    if (visible && !opened.current) {
      opened.current = true;
      restore.current =
        Platform.OS === "web" && typeof document !== "undefined"
          ? (document.activeElement as HTMLElement)
          : null;
      setPresented(true);
    }
  }, [visible]);
  useEffect(() => {
    if (!presented) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reducedMotion ? 0 : visible ? 140 : 100,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setPresented(false);
    });
    return () => animation.stop();
  }, [visible, presented, reducedMotion, progress]);
  useEffect(() => {
    if (!presented && Platform.OS !== "ios") finish();
  }, [presented, finish]);
  useEffect(() => {
    if (!presented || !top) return;
    const frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [presented, top, focus]);
  useOverlayKeyboardFocus(root, presented && top, close, focus);
  return (
    <DialogPortal
      transparent
      visible={presented}
      animationType="none"
      onRequestClose={close}
      onDismiss={finish}
      onShow={focus}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View
        pointerEvents={top && visible ? "auto" : "none"}
        accessibilityElementsHidden={!top}
        importantForAccessibility={top ? "yes" : "no-hide-descendants"}
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: progress,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          testID="dialog-backdrop"
          accessible={false}
          tabIndex={-1}
          onPress={close}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <Animated.View
          ref={root}
          role="dialog"
          aria-modal={top}
          aria-labelledby={titleId}
          accessibilityLabel={title}
          accessibilityViewIsModal={top}
          tabIndex={-1}
          testID="centered-dialog"
          style={{
            width: Math.min(400, width - insets.left - insets.right - 24),
            maxHeight: Math.max(120, height - insets.top - insets.bottom - 24),
            backgroundColor: colors.surface,
            borderRadius: tokens.radius.sheet,
            borderWidth: 1,
            borderColor: colors.border,
            padding: tokens.space.md,
            gap: tokens.space.md,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [reducedMotion ? 1 : 0.97, 1],
                }),
              },
            ],
          }}
        >
          <Text
            nativeID={titleId}
            accessibilityRole="header"
            style={{
              ...tokens.type.title,
              color: colors.textPrimary,
              fontWeight: "600",
            }}
          >
            {title}
          </Text>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: tokens.space.md }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer}
        </Animated.View>
      </Animated.View>
    </DialogPortal>
  );
}

function DialogButton({
  label,
  onPress,
  disabled,
  destructive = false,
  primary = false,
  buttonRef,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  primary?: boolean;
  buttonRef?: React.RefObject<View | null>;
}) {
  const { semanticColors: colors } = useTheme();
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        padding: 12,
        borderRadius: 10,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        backgroundColor: primary
          ? destructive
            ? colors.surfaceRaised
            : colors.accent
          : "transparent",
      })}
    >
      <Text
        style={{
          color: destructive
            ? colors.danger
            : primary
              ? colors.onAccent
              : colors.textPrimary,
          fontSize: 16,
          fontWeight: primary ? "600" : "500",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ConfirmDialog({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  closeOnConfirm = true,
  onConfirm,
  children,
  ...props
}: DialogProps & {
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Existing workflows may own success navigation/dismissal separately from cancellation. */
  closeOnConfirm?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  const { styles } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const safeAction = useRef<View>(null);
  const confirm = () => {
    if (!props.visible || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    void Promise.resolve()
      .then(onConfirm)
      .then(() => {
        if (closeOnConfirm) props.onClose();
      })
      .catch((failure) => {
        setError(
          failure instanceof Error
            ? failure.message
            : "Something went wrong. Try again.",
        );
      })
      .finally(() => {
        submitting.current = false;
        setBusy(false);
      });
  };
  return (
    <Dialog
      {...props}
      onDismiss={() => {
        setError("");
        props.onDismiss?.();
      }}
      onClose={() => {
        if (!submitting.current) props.onClose();
      }}
      busy={busy}
      initialFocusLabel={cancelLabel}
      initialFocusRef={safeAction}
      footer={
        <View style={{ gap: 4 }}>
          <DialogButton
            buttonRef={safeAction}
            label={cancelLabel}
            disabled={busy}
            onPress={() => {
              if (props.visible && !submitting.current) props.onClose();
            }}
          />
          <DialogButton
            label={busy ? "Working…" : confirmLabel}
            disabled={busy}
            primary
            destructive={destructive}
            onPress={confirm}
          />
        </View>
      }
    >
      {message ? <Text style={styles.body}>{message}</Text> : null}
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </Dialog>
  );
}

type Confirmation = Pick<
  React.ComponentProps<typeof ConfirmDialog>,
  "title" | "message" | "confirmLabel" | "destructive" | "onConfirm"
>;

/** Adds a safeguard without replacing the surrounding editor or management list. */
export function useConfirmation() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [open, setOpen] = useState(false);
  return {
    requestConfirmation: (next: Confirmation) => {
      setConfirmation(next);
      setOpen(true);
    },
    confirmationDialog: (
      <ConfirmDialog
        title={confirmation?.title ?? "Confirm action"}
        visible={open}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        onClose={() => setOpen(false)}
        onDismiss={() => setConfirmation(null)}
        onConfirm={async () => {
          await confirmation?.onConfirm();
        }}
      />
    ),
  };
}

export type QuickChoiceItem = {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

export function QuickChoiceDialog({
  items,
  description,
  onDismiss,
  ...props
}: DialogProps & {
  items: QuickChoiceItem[];
  description?: string;
}) {
  const { semanticColors: colors } = useTheme();
  const continuation = useRef<(() => void) | null>(null);
  const selecting = useRef(false);
  useEffect(() => {
    if (props.visible) selecting.current = false;
  }, [props.visible]);
  return (
    <Dialog
      {...props}
      onDismiss={() => {
        const action = continuation.current;
        continuation.current = null;
        onDismiss?.();
        action?.();
      }}
      footer={<DialogButton label="Cancel" onPress={props.onClose} />}
    >
      {description ? (
        <Text style={{ color: colors.textSecondary }}>{description}</Text>
      ) : null}
      {props.children}
      {items.map((item) => (
        <Pressable
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          disabled={item.disabled}
          accessibilityState={{ disabled: !!item.disabled }}
          onPress={() => {
            if (selecting.current) return;
            selecting.current = true;
            continuation.current = item.onPress;
            props.onClose();
          }}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 10,
            opacity: item.disabled ? 0.5 : 1,
            backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          })}
        >
          {item.icon}
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: item.destructive ? colors.danger : colors.textPrimary,
                fontSize: 16,
              }}
            >
              {item.label}
            </Text>
            {item.description ? (
              <Text style={{ color: colors.textSecondary }}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </Dialog>
  );
}
