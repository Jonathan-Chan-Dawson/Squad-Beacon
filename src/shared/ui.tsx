import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputProps,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { ReduceMotion } from "react-native-reanimated";
import { ArrowLeft, Bell, Radio, X } from "lucide-react-native";
import { pendingSocialCount } from "@/src/features/people/communication";
import { useNow } from "@/src/shared/useNow";
import {
  router,
  useSegments,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useBeacon } from "@/src/shared/store";
import type { Audience, Category } from "@/src/shared/types";
import { usePreferences } from "@/src/shared/preferences";
import {
  getDesignTheme,
  useDesignTheme,
  type DesignTokens,
  type SemanticColors,
} from "@/src/theme";
import {
  Avatar as DesignAvatar,
  Card,
  Chip as DesignChip,
  DemoChip,
  EmptyState,
  GlassBar,
  IconButton as DesignIconButton,
  PrimaryButton,
  SecondaryButton,
  useReducedMotion,
  uiHaptics,
} from "@/src/shared/design-system";
import {
  themes,
  themeNames,
  themeVariants,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/shared/themes";
export { uiHaptics };
export const colors = themes.Mint;
let webSheetScrollLocks = 0;
let previousWebBodyOverflow = "";
const activeSheetStack: string[] = [];
const sheetVisibility = new Map<string, boolean>();
const sheetLabels = new Map<string, string>();
const sheetStackSubscribers = new Set<() => void>();

function subscribeToSheetStack(callback: () => void) {
  sheetStackSubscribers.add(callback);
  return () => {
    sheetStackSubscribers.delete(callback);
  };
}

function notifySheetStackChanged() {
  sheetStackSubscribers.forEach((callback) => callback());
}

function registerActiveSheet(sheetId: string) {
  const previousLength = activeSheetStack.length;
  const existingIndex = activeSheetStack.indexOf(sheetId);
  if (existingIndex >= 0) activeSheetStack.splice(existingIndex, 1);
  activeSheetStack.push(sheetId);
  if (activeSheetStack.length !== previousLength || existingIndex >= 0) {
    notifySheetStackChanged();
  }
}

function unregisterActiveSheet(sheetId: string) {
  const index = activeSheetStack.indexOf(sheetId);
  const hadVisibility = sheetVisibility.delete(sheetId);
  const hadLabel = sheetLabels.delete(sheetId);
  if (index >= 0) activeSheetStack.splice(index, 1);
  if (index >= 0 || hadVisibility || hadLabel) notifySheetStackChanged();
}

function isTopActiveSheet(sheetId: string) {
  return activeSheetStack.at(-1) === sheetId && sheetVisibility.get(sheetId) === true;
}

function setSheetVisibility(sheetId: string, visible: boolean) {
  if (sheetVisibility.get(sheetId) === visible) return;
  sheetVisibility.set(sheetId, visible);
  notifySheetStackChanged();
}

function setSheetLabel(sheetId: string, title: string) {
  if (sheetLabels.get(sheetId) === title) return;
  sheetLabels.set(sheetId, title);
  notifySheetStackChanged();
}

export function SheetIsolation({ children }: { children: React.ReactNode }) {
  const hasOpenSheet = React.useSyncExternalStore(
    subscribeToSheetStack,
    () => activeSheetStack.length > 0,
    () => false,
  );
  return (
    <View
      accessibilityElementsHidden={hasOpenSheet}
      importantForAccessibility={
        hasOpenSheet ? "no-hide-descendants" : "auto"
      }
      aria-hidden={hasOpenSheet}
      style={{ flex: 1 }}
    >
      {children}
    </View>
  );
}

function lockWebSheetScroll() {
  if (typeof document === "undefined") return;
  if (webSheetScrollLocks === 0) {
    previousWebBodyOverflow = document.body.style.overflow;
  }
  webSheetScrollLocks += 1;
  document.body.style.overflow = "hidden";
}

function unlockWebSheetScroll() {
  if (typeof document === "undefined" || webSheetScrollLocks === 0) return;
  webSheetScrollLocks -= 1;
  if (webSheetScrollLocks === 0) {
    document.body.style.overflow = previousWebBodyOverflow;
  }
}

const makeStyles = (colors: SemanticColors, tokens: DesignTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: {
      paddingHorizontal: tokens.layout.screenGutter,
      paddingTop: tokens.space.sm,
      gap: tokens.space.md,
      width: "100%",
      alignSelf: "center",
    },
    row: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
    between: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: tokens.space.md,
    },
    title: {
      ...tokens.type.display,
      fontWeight: tokens.type.weight.bold,
      color: colors.textPrimary,
    },
    h2: {
      ...tokens.type.headline,
      flexShrink: 1,
      fontWeight: tokens.type.weight.semibold,
      color: colors.textPrimary,
    },
    body: { ...tokens.type.body, color: colors.textPrimary },
    muted: { ...tokens.type.secondary, color: colors.textSecondary },
    label: {
      ...tokens.type.caption,
      fontWeight: tokens.type.weight.semibold,
      color: colors.accent,
      textTransform: "none",
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.card,
      padding: tokens.space.md,
      gap: tokens.space.sm,
    },
    button: {
      minHeight: tokens.layout.minTapTarget,
      paddingHorizontal: tokens.space.md,
      paddingVertical: tokens.space.sm,
      borderRadius: tokens.radius.button,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    buttonText: {
      ...tokens.type.secondary,
      fontWeight: tokens.type.weight.semibold,
      color: colors.onAccent,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.sm,
      padding: tokens.space.md,
      minHeight: tokens.layout.minTapTarget,
      color: colors.textPrimary,
      ...tokens.type.body,
      backgroundColor: colors.surface,
    },
    chip: {
      minHeight: tokens.layout.minTapTarget,
      justifyContent: "center",
      paddingHorizontal: tokens.space.sm,
      paddingVertical: tokens.space.sm,
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipText: {
      ...tokens.type.secondary,
      fontWeight: tokens.type.weight.medium,
      color: colors.textSecondary,
      textTransform: "capitalize",
    },
    error: { ...tokens.type.secondary, color: colors.danger },
    hero: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: tokens.radius.card,
      padding: tokens.space.md,
      gap: tokens.space.sm,
    },
  });
const themedStyles = Object.fromEntries(
  themeNames.map((name) => [
    name,
    {
      light: makeStyles(getDesignTheme(name, "light").colors, getDesignTheme(name, "light").tokens),
      dark: makeStyles(getDesignTheme(name, "dark").colors, getDesignTheme(name, "dark").tokens),
    },
  ]),
) as Record<
  ThemeName,
  Record<ResolvedAppearance, ReturnType<typeof makeStyles>>
>;
export const styles = themedStyles.Midnight.dark;
export function useTheme() {
  const { theme, resolvedAppearance } = usePreferences();
  const design = useDesignTheme();
  const legacyColors = useMemo(
    () => {
      const palette = themeVariants[theme][resolvedAppearance];
      const semantic = getDesignTheme(theme, resolvedAppearance).colors;
      return {
        ...palette,
        bg: semantic.bg,
        ink: semantic.textPrimary,
        muted: semantic.textSecondary,
        line: semantic.border,
        green: semantic.accent,
        lime: semantic.surfaceRaised,
        white: semantic.surface,
        red: semantic.danger,
      };
    },
    [theme, resolvedAppearance],
  );
  return {
    colors: legacyColors,
    styles: themedStyles[theme][resolvedAppearance],
    theme,
    resolvedAppearance,
    tokens: design.tokens,
    semanticColors: design.colors,
  };
}
export function Txt({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const { styles, tokens } = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
      style={muted ? styles.muted : styles.body}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  compact = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
}) {
  const Component = secondary ? SecondaryButton : PrimaryButton;
  return (
    <Component
      title={title}
      icon={icon}
      compact={compact}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title}
      accessibilityRole="button"
    />
  );
}
/** One accessible, thumb-friendly target for contextual icon actions. */
export function IconButton({
  label,
  onPress,
  children,
  selected = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
}) {
  const { semanticColors } = useTheme();
  return (
    <DesignIconButton
      label={label}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      style={selected ? { backgroundColor: semanticColors.surfaceRaised } : undefined}
    >
      {children}
    </DesignIconButton>
  );
}

export function Action({
  title,
  run,
  secondary = false,
  disabled = false,
  compact = false,
  feedback,
}: {
  title: string;
  run: () => Promise<unknown>;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  feedback?: "success" | "warning";
}) {
  const { styles, tokens } = useTheme();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: tokens.space.sm }}>
      <Button
        title={busy ? "Working…" : title}
        disabled={busy || disabled}
        compact={compact}
        secondary={secondary}
        onPress={() => {
          setBusy(true);
          setError("");
          if (feedback === "warning") uiHaptics.warning();
          void Promise.resolve()
            .then(run)
            .then(() => {
              if (feedback === "success") uiHaptics.success();
            })
            .catch((e) => setError(e.message ?? "Something went wrong."))
            .finally(() => setBusy(false));
        }}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { styles, colors, tokens } = useTheme();

  return (
    <View style={{ gap: tokens.space.sm }}>
      <Text
        maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
        style={[styles.muted, { fontWeight: tokens.type.weight.semibold }]}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && {
            minHeight:
              tokens.space.xxxl * 2 +
              tokens.space.md +
              tokens.space.xs +
              tokens.space.xxs,
            textAlignVertical: "top",
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips<T extends string>({
  options,
  value,
  onChange,
  accessibilityPrefix,
  showSelectedCheckmark = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  accessibilityPrefix?: string;
  showSelectedCheckmark?: boolean;
}) {
  const { semanticColors, tokens } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.space.sm,
      }}
    >
      {options.map((option) => {
        const selected = value === option;
        const category = Object.prototype.hasOwnProperty.call(
          tokens.categories,
          option,
        )
          ? tokens.categories[option as Category]
          : undefined;
        const CategoryIcon = category?.icon;
        const label =
          showSelectedCheckmark && selected
            ? `${String.fromCharCode(0x2713)} ${option}`
            : option;

        return (
          <DesignChip
            key={option}
            label={label}
            accessibilityLabel={
              accessibilityPrefix
                ? `${accessibilityPrefix}: ${option}`
                : option
            }
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(option)}
            selected={selected}
            icon={
              CategoryIcon ? (
                <CategoryIcon
                  size={tokens.iconSize.sm}
                  color={category.color}
                />
              ) : undefined
            }
            style={
              category
                ? {
                    backgroundColor: selected
                      ? category.tint
                      : semanticColors.surface,
                    borderColor: selected
                      ? category.color
                      : semanticColors.border,
                  }
                : undefined
            }
            textStyle={category ? { color: category.color } : undefined}
          />
        );
      })}
    </View>
  );
}
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const { showAvatars } = usePreferences();
  if (!showAvatars) return null;
  return <DesignAvatar name={name} size={size} accessibilityLabel={name} />;
}
export function Empty({ title, body }: { title: string; body: string }) {
  const { semanticColors, tokens } = useTheme();
  return (
    <Card style={{ borderStyle: "dashed", alignItems: "center" }}>
      <EmptyState
        icon={<Radio size={tokens.iconSize.lg} color={semanticColors.accent} />}
        title={title}
        body={body}
      />
    </Card>
  );
}
export function Sheet({
  title,
  visible,
  onClose,
  children,
  maxHeightPercent = 94,
  footer,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  footer?: React.ReactNode;
}) {
  const { semanticColors: colors, resolvedAppearance, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const hasPresentedRef = React.useRef(false);
  const hasOpenedRef = React.useRef(false);
  const dismissRequestedRef = React.useRef(false);
  const hasFocusedRef = React.useRef(false);
  const visibleRef = React.useRef(visible);
  const sheetId = React.useId();
  React.useLayoutEffect(() => {
    visibleRef.current = visible;
    setSheetVisibility(sheetId, visible);
    setSheetLabel(sheetId, title);
  }, [sheetId, title, visible]);
  const dialogRef = React.useRef<View>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const scrollLockRef = React.useRef(false);
  const isRegisteredRef = React.useRef(false);
  const capPercent = Math.max(35, Math.min(94, maxHeightPercent));
  const snapPoints = React.useMemo(() => [`${capPercent}%`], [capPercent]);
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: tokens.motion.spring.damping,
    stiffness: tokens.motion.spring.stiffness,
    mass: tokens.motion.spring.mass,
  });
  const maxContentHeight = Math.max(
    240,
    (height - insets.top - insets.bottom) * (capPercent / 100),
  );
  const modalStyle =
    Platform.OS === "web" || width >= tokens.layout.tabletBreakpoint
      ? { alignSelf: "center" as const, maxWidth: tokens.layout.contentMaxWidth, width: "100%" as const }
      : undefined;
  const focusDialog = useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const dialog = dialogRef.current as unknown as HTMLElement | null;
    if (!dialog) return;
    const target =
      dialog.querySelector<HTMLElement>('[aria-label="Close"]') ??
      dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [role="button"][tabindex="0"], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ) ?? dialog;
    target.focus({ preventScroll: true });
  }, []);
  const dialogContainerComponent = useMemo(() => {
    function SheetDialogContainer({
      children: content,
    }: React.PropsWithChildren) {
      const presented = React.useSyncExternalStore(
        subscribeToSheetStack,
        () => isTopActiveSheet(sheetId),
        () => false,
      );
      const dialogTitle = React.useSyncExternalStore(
        subscribeToSheetStack,
        () => sheetLabels.get(sheetId) ?? "",
        () => "",
      );
      return (
        <View
          ref={dialogRef}
          accessible={Platform.OS === "web"}
          role="dialog"
          accessibilityLabel={dialogTitle}
          accessibilityViewIsModal={presented}
          accessibilityElementsHidden={!presented}
          importantForAccessibility={
            presented ? "yes" : "no-hide-descendants"
          }
          aria-modal={Platform.OS === "web" ? presented : undefined}
          aria-hidden={!presented}
          testID="shared-sheet-dialog"
          tabIndex={-1}
          pointerEvents="box-none"
          style={StyleSheet.absoluteFill}
        >
          {content}
        </View>
      );
    }
    SheetDialogContainer.displayName = "SheetDialogContainer";
    return SheetDialogContainer;
  }, [sheetId]);
  const releaseWebScrollLock = useCallback(() => {
    if (!scrollLockRef.current) return;
    scrollLockRef.current = false;
    unlockWebSheetScroll();
  }, []);
  const releaseActiveSheet = useCallback(() => {
    isRegisteredRef.current = false;
    unregisterActiveSheet(sheetId);
  }, [sheetId]);
  const requestDismiss = useCallback(() => {
    if (!hasOpenedRef.current) {
      dismissRequestedRef.current = true;
      return;
    }
    dismissRequestedRef.current = false;
    sheetRef.current?.dismiss();
  }, []);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <View style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={32}
          tint={resolvedAppearance === "dark" ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? "none" : undefined}
          style={StyleSheet.absoluteFill}
        />
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="none"
          onPress={requestDismiss}
          opacity={1}
          style={[props.style, { backgroundColor: colors.scrim }]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />
      </View>
    ),
    [colors.scrim, requestDismiss, resolvedAppearance],
  );
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) =>
      footer ? (
        <BottomSheetFooter
          {...props}
          bottomInset={insets.bottom}
          style={{
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.sm,
          }}
        >
          {footer}
        </BottomSheetFooter>
      ) : null,
    [colors.bg, colors.border, footer, insets.bottom, tokens.space.md, tokens.space.sm],
  );

  React.useEffect(() => {
    if (visible) {
      if (!isRegisteredRef.current) {
        registerActiveSheet(sheetId);
        isRegisteredRef.current = true;
      }
      if (Platform.OS === "web" && typeof document !== "undefined") {
        if (!scrollLockRef.current) {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          lockWebSheetScroll();
          scrollLockRef.current = true;
        }
      }
      hasPresentedRef.current = true;
      sheetRef.current?.present();
    } else if (hasPresentedRef.current) {
      requestDismiss();
    }
  }, [requestDismiss, sheetId, visible]);

  React.useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const dialog = () => dialogRef.current as unknown as HTMLElement | null;
    const isTopSheet = () =>
      visibleRef.current && isTopActiveSheet(sheetId);
    const focusInSheet = (event: FocusEvent) => {
      const node = dialog();
      if (
        node &&
        isTopSheet() &&
        event.target instanceof Node &&
        !node.contains(event.target)
      ) {
        focusDialog();
      }
    };
    const keepKeyboardInSheet = (event: KeyboardEvent) => {
      const node = dialog();
      if (!node || !isTopSheet()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"][tabindex="0"], [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getAttribute("aria-label") !== "Dismiss sheet",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", focusInSheet, true);
    document.addEventListener("keydown", keepKeyboardInSheet, true);
    return () => {
      document.removeEventListener("focusin", focusInSheet, true);
      document.removeEventListener("keydown", keepKeyboardInSheet, true);
    };
  }, [sheetId, visible, focusDialog, requestDismiss]);

  React.useEffect(
    () => () => {
      releaseWebScrollLock();
      releaseActiveSheet();
    },
    [releaseActiveSheet, releaseWebScrollLock],
  );

  React.useEffect(() => {
    if (!visible || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, requestDismiss]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      containerComponent={dialogContainerComponent}
      accessible={false}
      accessibilityRole={null}
      accessibilityLabel={null}
      index={0}
      snapPoints={snapPoints}
      maxDynamicContentSize={maxContentHeight}
      enableDynamicSizing
      enablePanDownToClose
      enableBlurKeyboardOnGesture
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      stackBehavior="push"
      topInset={insets.top}
      bottomInset={insets.bottom}
      overrideReduceMotion={ReduceMotion.System}
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      style={modalStyle}
      backgroundStyle={{
        backgroundColor: colors.bg,
        borderTopLeftRadius: tokens.radius.sheet,
        borderTopRightRadius: tokens.radius.sheet,
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.textSecondary,
        width: tokens.space.xxl,
      }}
      onChange={(index) => {
        if (index < 0) return;
        hasOpenedRef.current = true;
        if (dismissRequestedRef.current) {
          dismissRequestedRef.current = false;
          sheetRef.current?.dismiss();
          return;
        }
        if (hasFocusedRef.current) return;
        hasFocusedRef.current = true;
        requestAnimationFrame(focusDialog);
      }}
      onDismiss={() => {
        hasPresentedRef.current = false;
        hasOpenedRef.current = false;
        dismissRequestedRef.current = false;
        hasFocusedRef.current = false;
        releaseActiveSheet();
        releaseWebScrollLock();
        const returnFocus = returnFocusRef.current;
        returnFocusRef.current = null;
        if (returnFocus?.isConnected) {
          returnFocus.focus({ preventScroll: true });
        }
        if (visibleRef.current) onClose();
      }}
    >
      <BottomSheetView
        style={{ flex: 1, maxWidth: tokens.layout.contentMaxWidth, alignSelf: "center", width: "100%" }}
      >
        <View
          style={{
            minHeight: tokens.layout.minTapTarget + tokens.space.md,
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.xs,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: tokens.space.sm,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              ...tokens.type.title,
              color: colors.textPrimary,
              flex: 1,
              fontWeight: tokens.type.weight.semibold,
            }}
          >
            {title}
          </Text>
          <IconButton label="Close" onPress={requestDismiss}>
            <X color={colors.textPrimary} />
          </IconButton>
        </View>
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          enableFooterMarginAdjustment={!!footer}
          contentContainerStyle={{
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.xs,
            paddingBottom: tokens.space.xxl,
            gap: tokens.space.md,
          }}
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
export function Screen({
  title,
  eyebrow,
  children,
  create: _create = true,
  footer,
  headerAction,
  showDemoNotice = true,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  create?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  showDemoNotice?: boolean;
}) {
  const { styles, colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { demo, error, refresh } = useBeacon();
  const segments = useSegments();
  const inTabs = segments[0] === "(tabs)";
  const back = !inTabs;
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const titleAtTopRef = React.useRef(true);
  const handleScreenScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      titleAtTopRef.current = offset <= 0.5;
      scrollY.setValue(offset);
    },
    [scrollY],
  );
  const reducedMotion = useReducedMotion();
  const [measuredTitleHeight, setMeasuredTitleHeight] = useState<number>(
    tokens.type.display.lineHeight * fontScale,
  );
  const collapse = scrollY.interpolate({
    inputRange: [0, tokens.space.xxxl + tokens.space.md],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const titleBlockHeight =
    measuredTitleHeight +
    (eyebrow
      ? tokens.type.caption.lineHeight *
          Math.min(fontScale, tokens.type.denseMaxMultiplier) +
        tokens.space.xxs
      : 0);
  const expandedHeight = back
    ? tokens.space.xs + tokens.layout.minTapTarget + tokens.space.xs + titleBlockHeight + tokens.space.sm
    : tokens.space.md + titleBlockHeight + tokens.space.sm;
  const collapsedHeight = back
    ? tokens.space.xs + tokens.layout.minTapTarget + tokens.space.xs + tokens.type.title.lineHeight * fontScale + tokens.space.sm
    : tokens.space.md + tokens.type.title.lineHeight * fontScale + tokens.space.sm;
  const headerHeight = reducedMotion
    ? expandedHeight
    : collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [expandedHeight, collapsedHeight],
      });
  const titleFontSize = reducedMotion
    ? tokens.type.display.fontSize
    : collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [tokens.type.display.fontSize, tokens.type.title.fontSize],
      });
  const titleLineHeight = reducedMotion
    ? tokens.type.display.lineHeight
    : collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [tokens.type.display.lineHeight, tokens.type.title.lineHeight],
      });
  const maxContentWidth =
    Platform.OS === "web" || width >= tokens.layout.tabletBreakpoint
      ? tokens.layout.contentMaxWidth
      : undefined;
  const bottomContentPadding = inTabs
    ? tokens.layout.tabBarHeight + insets.bottom + tokens.layout.scrollClearance
    : tokens.space.xxl;
  const action = headerAction ?? (inTabs ? <InboxButton /> : null);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScreenScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: maxContentWidth,
              paddingTop: expandedHeight + tokens.space.sm,
              paddingBottom: bottomContentPadding,
              gap: footer ? tokens.space.sm : tokens.space.md,
            },
          ]}
        >
          {demo && showDemoNotice ? <DemoChip /> : null}
          {!!error && (
            <Card>
              <Text
                style={styles.error}
                maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
              >
                Could not refresh. Protected data has been cleared. {error}
              </Text>
              <Action title="Try again" run={refresh} />
            </Card>
          )}
          {children}
        </Animated.ScrollView>
        <GlassBar
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            borderRadius: 0,
            borderWidth: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <Animated.View
            style={{
              height: headerHeight,
              width: "100%",
              maxWidth: maxContentWidth,
              alignSelf: "center",
              paddingHorizontal: tokens.layout.screenGutter,
              paddingTop: back ? tokens.space.sm : tokens.space.md,
              paddingBottom: tokens.space.sm,
              overflow: "hidden",
              justifyContent: "flex-end",
            }}
          >
            {back ? (
              <View
                style={{
                  position: "absolute",
                  top: tokens.space.xs,
                  left: tokens.layout.screenGutter,
                  right: tokens.layout.screenGutter,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <BackButton />
                {action}
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: tokens.space.sm,
              }}
            >
              <Animated.View
                style={{
                  flex: 1,
                  gap: tokens.space.xxs,
                  marginLeft: back ? tokens.space.xxxl + tokens.space.sm : 0,
                }}
              >
                {!!eyebrow && (
                  <Animated.Text
                    maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                    style={[styles.label, { opacity: collapse.interpolate({
                      inputRange: [0, 0.65, 1],
                      outputRange: [1, 0.2, 0],
                    }) }]}
                  >
                    {eyebrow}
                  </Animated.Text>
                )}
                <Animated.Text
                  accessibilityRole="header"
                  onLayout={(event) => {
                    if (
                      !titleAtTopRef.current ||
                      event.nativeEvent.layout.height <
                        tokens.type.display.lineHeight * fontScale * 0.9
                    ) {
                      return;
                    }
                    const nextHeight = event.nativeEvent.layout.height;
                    setMeasuredTitleHeight((current) =>
                      Math.abs(current - nextHeight) > 0.5 ? nextHeight : current,
                    );
                  }}
                  style={[
                    styles.title,
                    {
                      fontSize: titleFontSize,
                      lineHeight: titleLineHeight,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {title}
                </Animated.Text>
              </Animated.View>
              {!back ? action : null}
            </View>
          </Animated.View>
        </GlassBar>
        {footer ? (
          <SafeAreaView
            edges={["bottom"]}
            style={{ backgroundColor: colors.bg, zIndex: 2 }}
          >
            <View
              style={[
                styles.content,
                {
                  maxWidth: maxContentWidth,
                  paddingTop: tokens.space.sm,
                  paddingBottom: tokens.space.sm,
                },
              ]}
            >
              {footer}
            </View>
          </SafeAreaView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
export function AudiencePicker({
  value,
  id,
  onChange,
}: {
  value: Audience;
  id: string | null;
  onChange: (value: Audience, id: string | null) => void;
}) {
  const { styles, tokens } = useTheme();

  const { data, userId } = useBeacon();
  const targets =
    value === "list"
      ? data.lists.filter((list) => list.owner_id === userId)
      : value === "organization"
        ? data.organizations.filter(
            (org) =>
              org.owner_id === userId ||
              data.organization_members.some(
                (member) =>
                  member.organization_id === org.id &&
                  member.user_id === userId &&
                  member.status === "active",
              ),
          )
        : data.squads.filter((squad) =>
            data.squad_members.some(
              (member) =>
                member.squad_id === squad.id && member.user_id === userId,
            ),
          );
  return (
    <View style={{ gap: tokens.space.sm }}>
      <Text style={styles.muted}>Who can see this?</Text>
      <Chips
        options={
          ["private", "friends", "list", "squad", "organization"] as const
        }
        value={value}
        onChange={(v) => onChange(v, null)}
        showSelectedCheckmark={false}
      />
      {(value === "list" || value === "squad" || value === "organization") && (
        <View style={{ gap: tokens.space.sm }}>
          {targets.map((x) => (
            <Button
              key={x.id}
              secondary={id !== x.id}
              title={x.name}
              onPress={() => onChange(value, x.id)}
            />
          ))}
          {!targets.length && (
            <Txt muted>Create a {value} in Squads first.</Txt>
          )}
        </View>
      )}
    </View>
  );
}
export function Loading() {
  const { styles, colors } = useTheme();

  return (
    <View
      style={[
        styles.screen,
        { alignItems: "center", justifyContent: "center" },
      ]}
    >
      <ActivityIndicator color={colors.green} />
      <Txt muted>Finding your people…</Txt>
    </View>
  );
}

export function BackButton() {
  const { styles, colors, tokens } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={tokens.space.xs}
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)")
      }
      style={[
        styles.row,
        {
          minHeight: tokens.layout.minTapTarget,
          alignSelf: "flex-start",
        },
      ]}
    >
      <ArrowLeft size={20} color={colors.ink} />
      <Txt>Back</Txt>
    </Pressable>
  );
}

export function InboxButton() {
  const { styles, semanticColors, tokens } = useTheme();

  const { data, userId, act } = useBeacon();
  const [open, setOpen] = useState(false);
  const pending = pendingSocialCount(data, userId, useNow());
  const params = useLocalSearchParams<{ inbox?: string }>();
  useFocusEffect(
    useCallback(() => {
      if (params.inbox === "yes") {
        setOpen(true);
        router.setParams({ inbox: undefined });
      }
    }, [params.inbox]),
  );
  const unread = data.notices.filter((n) => !n.read_at).length;
  return (
    <>
      <IconButton
        label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onPress={() => setOpen(true)}
      >
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Bell size={tokens.iconSize.md} color={semanticColors.textPrimary} />
        {unread > 0 && (
          <View
            style={{
              position: "absolute",
              top: -tokens.space.sm,
              right: -tokens.space.sm,
              borderRadius: tokens.radius.circle,
              backgroundColor: semanticColors.accent,
              minWidth: tokens.type.caption.lineHeight + tokens.space.sm,
              minHeight: tokens.type.caption.lineHeight + tokens.space.sm,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: tokens.space.xs,
            }}
          >
            <Text
              maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
              style={{
                ...tokens.type.caption,
                color: semanticColors.onAccent,
                fontWeight: tokens.type.weight.bold,
              }}
            >
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        )}
        </View>
      </IconButton>
      <Sheet
        title="Notifications"
        visible={open}
        onClose={() => setOpen(false)}
      >
        {pending > 0 ? (
          <Button
            title={`${pending} Pings & invitations need you`}
            onPress={() => {
              setOpen(false);
              router.push({
                pathname: "/(tabs)/squads",
                params: { tab: "Pings" },
              });
            }}
          />
        ) : null}
        {unread > 0 && (
          <Action
            title="Mark all read"
            secondary
            run={() => act("read_notices")}
          />
        )}
        {!data.notices.length && (
          <Txt muted>
            You are all caught up. Invitations and beacon updates will appear
            here.
          </Txt>
        )}
        {data.notices
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 50)
          .map((n) => (
            <View key={n.id} style={styles.card}>
              <Text
                style={[styles.body, { fontWeight: n.read_at ? "400" : "700" }]}
              >
                {n.body}
              </Text>
              <Button
                secondary
                title={
                  n.activity_id ? "Open on map" : "Review Pings & invitations"
                }
                onPress={() => {
                  setOpen(false);
                  router.push(
                    n.activity_id
                      ? {
                          pathname: "/(tabs)",
                          params: { beacon: n.activity_id },
                        }
                      : {
                          pathname: "/(tabs)/squads",
                          params: { tab: "Pings" },
                        },
                  );
                }}
              />
            </View>
          ))}
      </Sheet>
    </>
  );
}
