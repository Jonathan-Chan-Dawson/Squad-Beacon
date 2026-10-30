import { SocialChoiceRow } from "./SocialChoiceRow";
import {
  getOverlayTitle,
  subscribeToSheetStack,
  registerActiveSheet,
  unregisterActiveSheet,
  isTopActiveSheet,
  setSheetVisibility,
  setSheetLabel,
  lockWebSheetScroll,
  unlockWebSheetScroll,
  useTopOverlay,
} from "./overlays";
import {
  Card,
  Avatar as DesignAvatar,
  Chip as DesignChip,
  IconButton as DesignIconButton,
  EmptyState,
  GlassBar,
  PrimaryButton,
  SecondaryButton,
  uiHaptics,
  useReducedMotion,
} from "@/src/shared/design-system";
import { usePreferences } from "@/src/shared/preferences";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { pendingSocialCount } from "@/src/features/people/communication";
import {
  themeNames,
  themeVariants,
  themes,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/shared/themes";
import type { Audience, Category } from "@/src/shared/types";
import {
  getDesignTheme,
  useDesignTheme,
  type DesignTokens,
  type SemanticColors,
} from "@/src/theme";
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
import { BlurView } from "expo-blur";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useSegments,
} from "expo-router";
import {
  ArrowLeft,
  Bell,
  Lock,
  Radio,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputProps,
} from "react-native";
import { ReduceMotion } from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { sheetSurface } from "./mobilePresentation";
import { focusOverlay, useOverlayKeyboardFocus } from "./overlayFocus";
import { ImmersiveStatusBar } from "./SystemBars";
export { SheetIsolation, useOverlayPresence, useTopOverlay } from "./overlays";
export { uiHaptics };
export const colors = themes.Essential;
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
      color: colors.textSecondary,
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
      borderColor: colors.borderStrong,
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
      light: makeStyles(
        getDesignTheme(name, "light").colors,
        getDesignTheme(name, "light").tokens,
      ),
      dark: makeStyles(
        getDesignTheme(name, "dark").colors,
        getDesignTheme(name, "dark").tokens,
      ),
    },
  ]),
) as Record<
  ThemeName,
  Record<ResolvedAppearance, ReturnType<typeof makeStyles>>
>;
export const styles = themedStyles.Essential.dark;
export function useTheme() {
  const { theme, resolvedAppearance } = usePreferences();
  const design = useDesignTheme();
  const legacyColors = useMemo(() => {
    const palette = themeVariants[theme][resolvedAppearance];
    const semantic = getDesignTheme(theme, resolvedAppearance).colors;
    return {
      ...palette,
      ...semantic,
      bg: semantic.bg,
      ink: semantic.textPrimary,
      muted: semantic.textSecondary,
      line: semantic.border,
      green: semantic.accent,
      lime: semantic.surfaceSelected,
      white: semantic.surface,
      red: semantic.danger,
    };
  }, [theme, resolvedAppearance]);
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
  accessibilityLabel,
  onPress,
  secondary = false,
  disabled = false,
  compact = false,
  icon,
}: {
  title: string;
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel ?? title}
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
      style={
        selected ? { backgroundColor: semanticColors.surfaceSelected } : undefined
      }
    >
      {children}
    </DesignIconButton>
  );
}

export function Action({
  title,
  accessibilityLabel,
  run,
  secondary = false,
  disabled = false,
  compact = false,
  feedback,
}: {
  title: string;
  accessibilityLabel?: string;
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
        accessibilityLabel={busy ? "Working…" : accessibilityLabel}
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
export function Field({
  label,
  inputRef,
  leadingAdornment,
  ...props
}: TextInputProps & {
  label: string;
  inputRef?: React.Ref<TextInput>;
  leadingAdornment?: React.ReactNode;
}) {
  const { styles, colors, tokens } = useTheme();
  const [focused, setFocused] = useState(false);

  const input = (
    <TextInput
      ref={inputRef}
      accessibilityLabel={label}
      placeholderTextColor={colors.muted}
      {...props}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[
        styles.input,
        focused && { borderColor: colors.primary },
        leadingAdornment ? { paddingLeft: 38 } : undefined,
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
  );
  return (
    <View style={{ gap: tokens.space.sm }}>
      <Text
        maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
        style={[styles.muted, { fontWeight: tokens.type.weight.semibold }]}
      >
        {label}
      </Text>
      {leadingAdornment ? (
        <View style={{ position: "relative" }}>
          {leadingAdornment ? (
            <View
              pointerEvents="none"
              accessible={false}
              style={{
                position: "absolute",
                left: 12,
                top: 0,
                bottom: 0,
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              {leadingAdornment}
            </View>
          ) : null}
          {input}
        </View>
      ) : (
        input
      )}
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
              accessibilityPrefix ? `${accessibilityPrefix}: ${option}` : option
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
  onDismiss,
  children,
  maxHeightPercent = 94,
  snapHeight,
  footer,
  centered = false,
  scrollable = true,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  snapHeight?: number;
  footer?: React.ReactNode;
  centered?: boolean;
  scrollable?: boolean;
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
  const centeredNative = centered && Platform.OS !== "web";
  const safeBottom = centered ? 0 : insets.bottom;
  const capPercent = Math.max(35, Math.min(94, maxHeightPercent));
  const centeredHeight = Math.min(
    620,
    ((height - insets.top - insets.bottom) * capPercent) / 100,
  );
  const snapPoints = React.useMemo(
    () =>
      centered
        ? [centeredHeight]
        : snapHeight === undefined
          ? [`${capPercent}%`]
          : [
              Math.min(
                Math.max(240, snapHeight),
                Math.max(
                  240,
                  ((height - insets.top - insets.bottom) * capPercent) / 100,
                ),
              ),
            ],
    [
      capPercent,
      height,
      insets.top,
      insets.bottom,
      snapHeight,
      centered,
      centeredHeight,
    ],
  );
  const animationConfigs = useBottomSheetSpringConfigs({
    ...tokens.motion.sheetSpring,
  });
  const maxContentHeight = Math.max(
    240,
    (height - insets.top - insets.bottom) * (capPercent / 100),
  );
  // BottomSheet positions its container absolutely with left/right = 0.
  // Flex alignment cannot center that container once its width is capped;
  // the library also overrides left/right, so inset it with equal margins.
  const sheetWidth = Math.min(
    width - (centered ? insets.left + insets.right + 24 : 0),
    tokens.layout.contentMaxWidth,
  );
  const modalStyle = {
    marginHorizontal: (width - sheetWidth) / 2,
  };
  const topOverlay = useTopOverlay(sheetId);
  const focusDialog = useCallback(() => {
    if (isTopActiveSheet(sheetId)) focusOverlay(dialogRef, "Close");
  }, [sheetId]);
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
        () => getOverlayTitle(sheetId),
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
          importantForAccessibility={presented ? "yes" : "no-hide-descendants"}
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
          bottomInset={0}
          style={{
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.sm,
            paddingBottom: tokens.space.sm + safeBottom,
            ...(centered
              ? {
                  borderBottomLeftRadius: tokens.radius.sheet,
                  borderBottomRightRadius: tokens.radius.sheet,
                }
              : {}),
          }}
        >
          {footer}
        </BottomSheetFooter>
      ) : null,
    [
      colors.bg,
      colors.border,
      centered,
      safeBottom,
      tokens.radius.sheet,
      footer,
      tokens.space.md,
      tokens.space.sm,
    ],
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

  useOverlayKeyboardFocus(
    dialogRef,
    visible && topOverlay,
    requestDismiss,
    focusDialog,
  );

  React.useEffect(
    () => () => {
      releaseWebScrollLock();
      releaseActiveSheet();
    },
    [releaseActiveSheet, releaseWebScrollLock],
  );

  React.useEffect(() => {
    if (!visible || !topOverlay || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, topOverlay, requestDismiss]);

  const SheetContent = scrollable ? BottomSheetScrollView : BottomSheetView;

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
      enableDynamicSizing={!centered && snapHeight === undefined}
      detached={centered}
      enablePanDownToClose={!centeredNative}
      enableContentPanningGesture={!centeredNative}
      enableHandlePanningGesture={!centeredNative}
      enableBlurKeyboardOnGesture
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      stackBehavior="push"
      topInset={insets.top}
      bottomInset={
        centered
          ? insets.bottom +
            (height - insets.top - insets.bottom - centeredHeight) / 2
          : 0
      }
      overrideReduceMotion={
        centeredNative ? ReduceMotion.Always : ReduceMotion.System
      }
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      style={modalStyle}
      backgroundStyle={
        Platform.OS !== "web"
          ? sheetSurface(colors.bg, tokens.radius.sheet, centered)
          : {
              backgroundColor: colors.bg,
              borderTopLeftRadius: tokens.radius.sheet,
              borderTopRightRadius: tokens.radius.sheet,
              ...(centered
                ? {
                    borderBottomLeftRadius: tokens.radius.sheet,
                    borderBottomRightRadius: tokens.radius.sheet,
                  }
                : {}),
            }
      }
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
        if (
          returnFocus?.isConnected &&
          !returnFocus.closest('[aria-hidden="true"]')
        ) {
          returnFocus.focus({ preventScroll: true });
        }
        if (visibleRef.current) onClose();
        onDismiss?.();
      }}
    >
      <SheetContent
        {...(scrollable
          ? {
              keyboardShouldPersistTaps: "handled" as const,
              nestedScrollEnabled: true,
              enableFooterMarginAdjustment: !!footer,
              stickyHeaderIndices: [0],
              contentContainerStyle: {
                paddingBottom: tokens.space.xxl + (footer ? 0 : safeBottom),
              },
            }
          : {
              style: {
                paddingBottom: tokens.space.xxl + (footer ? 0 : safeBottom),
              },
            })}
      >
        <View style={{ backgroundColor: colors.bg }}>
          <View
            style={{
              minHeight: tokens.layout.minTapTarget + tokens.space.md,
              paddingHorizontal: tokens.space.md,
              paddingTop: tokens.space.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.space.sm,
              backgroundColor: colors.bg,
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
        </View>
        <View
          style={{
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.xs,
            gap: tokens.space.md,
          }}
        >
          {children}
        </View>
      </SheetContent>
    </BottomSheetModal>
  );
}
export function Screen({
  title,
  eyebrow,
  children,
  scroll = true,
  compactHeader = false,
  iconOnlyBack = false,
  scrollRequest,
  scrollPositionRef,
  create: _create = true,
  footer,
  headerAction,
  scrollStateKey,
  immersive = false,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  /** Set false when children own their scrolling, such as a virtualized list. */
  scroll?: boolean;
  /** Use a compact single-row back/title/action header on focused screens. */
  compactHeader?: boolean;
  iconOnlyBack?: boolean;
  scrollRequest?: { y: number; sequence: number };
  scrollPositionRef?: React.MutableRefObject<number>;
  create?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  showDemoNotice?: boolean;
  /** Preserve independent scroll positions for in-page sections such as Profile tabs. */
  scrollStateKey?: string;
  /** Explicit full-screen media only; restores the status bar when focus leaves. */
  immersive?: boolean;
}) {
  const { styles, colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { error, refresh } = useBeacon();
  const segments = useSegments();
  const inTabs = segments[0] === "(tabs)";
  const back = !inTabs;
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollPositions = React.useRef(new Map<string, number>());
  const activeScrollKey = React.useRef(scrollStateKey);
  React.useLayoutEffect(() => {
    activeScrollKey.current = scrollStateKey;
    if (scrollStateKey == null) return;
    const position = scrollPositions.current.get(scrollStateKey) ?? 0;
    const timer = setTimeout(
      () => scrollRef.current?.scrollTo({ y: position, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
  }, [scrollStateKey]);
  const titleAtTopRef = React.useRef(true);
  const handleScreenScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      if (scrollPositionRef) scrollPositionRef.current = offset;
      if (activeScrollKey.current != null)
        scrollPositions.current.set(activeScrollKey.current, offset);
      titleAtTopRef.current = offset <= 0.5;
      scrollY.setValue(offset);
    },
    [scrollY, scrollPositionRef],
  );
  const reducedMotion = useReducedMotion();
  React.useEffect(() => {
    if (scrollRequest)
      scrollRef.current?.scrollTo({
        y: Math.max(0, scrollRequest.y - 12),
        animated: !reducedMotion,
      });
  }, [scrollRequest, reducedMotion]);
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
  const compactHeaderHeight =
    (iconOnlyBack && fontScale > 1.2
      ? tokens.layout.minTapTarget + tokens.space.sm
      : 0) +
    tokens.space.xs +
    Math.max(
      tokens.layout.minTapTarget,
      tokens.type.title.lineHeight *
        Math.min(fontScale, tokens.type.denseMaxMultiplier),
    ) +
    tokens.space.xs;
  const expandedHeight = back
    ? tokens.space.xs +
      tokens.layout.minTapTarget +
      tokens.space.xs +
      titleBlockHeight +
      tokens.space.sm
    : tokens.space.md + titleBlockHeight + tokens.space.sm;
  const collapsedHeight = back
    ? tokens.space.xs +
      tokens.layout.minTapTarget +
      tokens.space.xs +
      tokens.type.title.lineHeight * fontScale +
      tokens.space.sm
    : tokens.space.md +
      tokens.type.title.lineHeight * fontScale +
      tokens.space.sm;
  const headerHeight = reducedMotion
    ? expandedHeight
    : collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [expandedHeight, collapsedHeight],
      });
  const visibleHeaderHeight = compactHeader
    ? compactHeaderHeight
    : headerHeight;
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
        outputRange: [
          tokens.type.display.lineHeight,
          tokens.type.title.lineHeight,
        ],
      });
  const maxContentWidth =
    Platform.OS === "web" || width >= tokens.layout.tabletBreakpoint
      ? tokens.layout.contentMaxWidth
      : undefined;
  const bottomContentPadding = inTabs
    ? tokens.layout.tabBarHeight + insets.bottom + tokens.layout.scrollClearance
    : tokens.space.xxl + insets.bottom;
  const action = headerAction ?? (inTabs ? <InboxButton /> : null);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      {immersive && <ImmersiveStatusBar />}
      <View style={{ flex: 1 }}>
        {scroll ? (
          <Animated.ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScreenScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              {
                maxWidth: maxContentWidth,
                paddingTop:
                  (compactHeader ? compactHeaderHeight : expandedHeight) +
                  tokens.space.sm,
                paddingBottom: bottomContentPadding,
                gap: footer ? tokens.space.sm : tokens.space.md,
              },
            ]}
          >
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
        ) : (
          <View
            style={[
              styles.content,
              {
                flex: 1,
                minHeight: 0,
                maxWidth: maxContentWidth,
                paddingTop:
                  (compactHeader ? compactHeaderHeight : expandedHeight) +
                  tokens.space.sm,
                paddingBottom: bottomContentPadding,
                gap: footer ? tokens.space.sm : tokens.space.md,
              },
            ]}
          >
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
          </View>
        )}
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
              height: visibleHeaderHeight,
              width: "100%",
              maxWidth: maxContentWidth,
              alignSelf: "center",
              paddingHorizontal: tokens.layout.screenGutter,
              paddingTop: compactHeader
                ? tokens.space.xs
                : back
                  ? tokens.space.sm
                  : tokens.space.md,
              paddingBottom: tokens.space.sm,
              overflow: "hidden",
              justifyContent: compactHeader ? "center" : "flex-end",
            }}
          >
            {compactHeader ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space.sm,
                  flexWrap: iconOnlyBack && fontScale > 1.2 ? "wrap" : "nowrap",
                  minHeight: tokens.layout.minTapTarget,
                }}
              >
                {back ? <BackButton iconOnly={iconOnlyBack} /> : null}
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                  style={[
                    styles.title,
                    {
                      flex: 1,
                      minWidth: 0,
                      fontSize:
                        iconOnlyBack && width < 375
                          ? 18
                          : tokens.type.title.fontSize,
                      lineHeight:
                        tokens.type.title.lineHeight *
                        Math.min(fontScale, tokens.type.denseMaxMultiplier),
                    },
                  ]}
                >
                  {title}
                </Text>
                {iconOnlyBack && fontScale > 1.2 ? (
                  <View style={{ width: "100%", alignItems: "flex-end" }}>
                    {action}
                  </View>
                ) : (
                  action
                )}
              </View>
            ) : back ? (
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
            {!compactHeader ? (
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
                    minWidth: 0,
                  }}
                >
                  {!!eyebrow && (
                    <Animated.Text
                      maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                      style={[
                        styles.label,
                        {
                          opacity: collapse.interpolate({
                            inputRange: [0, 0.65, 1],
                            outputRange: [1, 0.2, 0],
                          }),
                        },
                      ]}
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
                        Math.abs(current - nextHeight) > 0.5
                          ? nextHeight
                          : current,
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
            ) : null}
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
  triggerLabel,
  inline = false,
}: {
  triggerLabel?: string;
  inline?: boolean;
  value: Audience;
  id: string | null;
  onChange: (value: Audience, id: string | null) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const groups: {
    audience: Audience;
    id: string;
    name: string;
    kind: string;
  }[] = [
    ...data.lists
      .filter((x) => x.owner_id === userId)
      .map((x) => ({
        audience: "list" as const,
        id: x.id,
        name: x.name,
        kind: "Private List",
      })),
    ...data.squads
      .filter((x) =>
        data.squad_members.some(
          (m) => m.squad_id === x.id && m.user_id === userId,
        ),
      )
      .map((x) => ({
        audience: "squad" as const,
        id: x.id,
        name: x.name,
        kind: "Squad",
      })),
    ...data.organizations
      .filter(
        (x) =>
          !x.archived_at &&
          (x.owner_id === userId ||
            data.organization_members.some(
              (m) =>
                m.organization_id === x.id &&
                m.user_id === userId &&
                m.status === "active",
            )) &&
          !data.organization_bans.some(
            (b) => b.organization_id === x.id && b.user_id === userId,
          ),
      )
      .map((x) => ({
        audience: "organization" as const,
        id: x.id,
        name: x.name,
        kind: "Network",
      })),
  ];
  const selected =
    value === "friends"
      ? "Friends"
      : value === "private"
        ? "Only me"
        : groups.find((g) => g.audience === value && g.id === id)?.name;
  const choices = [
    {
      audience: "friends" as Audience,
      id: null,
      name: "Friends",
      kind: "Accepted friends",
    },
    {
      audience: "private" as Audience,
      id: null,
      name: "Only me",
      kind: "Private to you",
    },
    ...groups,
  ].filter((g) =>
    (g.name + " " + g.kind).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const content = (
    <View style={{ gap: 6 }}>
      <Field
        label="Search audiences"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setLimit(8);
        }}
        placeholder="Friends, private lists, Squads, Networks…"
      />
      {choices.slice(0, inline ? limit : choices.length).map((g) => {
        const chosen = value === g.audience && (g.id === null || id === g.id);
        return (
          <SocialChoiceRow
            key={String(g.audience) + ":" + String(g.id)}
            label={g.name}
            accessibilityLabel={g.name + " \u00b7 " + g.kind}
            detail={g.kind}
            multiple={false}
            selected={chosen}
            icon={
              g.id ? (
                <Avatar name={g.name} size={32} />
              ) : g.audience === "private" ? (
                <Lock size={20} color={colors.muted} />
              ) : (
                <Users size={20} color={colors.muted} />
              )
            }
            onPress={() => {
              onChange(g.audience, g.id);
              setOpen(false);
            }}
          />
        );
      })}
      {!choices.length && <Txt muted>No matching audiences.</Txt>}
      {inline && choices.length > limit ? (
        <Button
          compact
          secondary
          title="Show more audiences"
          onPress={() => setLimit(limit + 6)}
        />
      ) : null}
    </View>
  );
  if (inline) return content;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={triggerLabel ?? "Choose audience"}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
        }}
      >
        {triggerLabel ? <Users size={18} color={colors.muted} /> : <Text style={{ color: colors.green, fontSize: 20 }}>＋</Text>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.body}>
            {triggerLabel ?? selected ?? "Choose audience"}
          </Text>
          {!triggerLabel && <Text style={styles.muted}>
            {selected ? "Audience · Change" : "Choose one audience"}
          </Text>}
        </View>
      </Pressable>
      <Sheet
        title="Choose audience"
        visible={open}
        onClose={() => setOpen(false)}
      >
        <Txt muted>
          Choose one audience. Invitations to individual friends are separate.
        </Txt>
        {content}
      </Sheet>
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

export function BackButton({ iconOnly = false }: { iconOnly?: boolean }) {
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
          minWidth: iconOnly ? tokens.layout.minTapTarget : undefined,
          justifyContent: "center",
          alignSelf: "flex-start",
        },
      ]}
    >
      <ArrowLeft size={20} color={colors.ink} />
      {iconOnly ? null : <Txt>Back</Txt>}
    </Pressable>
  );
}

export function InboxButton() {
  const { semanticColors: colors, tokens } = useTheme();
  const { data, userId } = useBeacon();
  const now = useNow();
  const params = useLocalSearchParams<{ inbox?: string }>();
  useFocusEffect(useCallback(() => {
    if (params.inbox === "yes") {
      router.setParams({ inbox: undefined });
      router.push("/responses");
    }
  }, [params.inbox]));
  const pending = pendingSocialCount(data, userId, now);
  const unread = userId && data.viewer_id === userId ? data.notices.filter((notice) => !notice.read_at).length : 0;
  const count = pending || unread;
  const label = ["Notifications", pending ? `${pending} pending responses and invitations` : null, unread ? `${unread} unread` : null].filter(Boolean).join(", ");
  return <IconButton label={label} onPress={() => router.push("/responses")}>
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Bell size={tokens.iconSize.md} color={colors.textPrimary} />
      {count > 0 && <View testID="notifications-badge" accessible={false} style={{ position: "absolute", top: -4, right: -7, borderRadius: tokens.radius.circle, backgroundColor: colors.accent, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
        <Text maxFontSizeMultiplier={tokens.type.denseMaxMultiplier} style={{ fontSize: 10, lineHeight: 12, color: colors.onAccent, fontWeight: tokens.type.weight.bold }}>{count > 99 ? "99+" : count}</Text>
      </View>}
    </View>
  </IconButton>;
}
