import React, {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  FadeIn,
  FadeInDown,
  default as Animated,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { UserRound, X } from "lucide-react-native";
import { usePreferences } from "@/src/shared/preferences";
import {
  useDesignTheme,
  type Availability,
  type Category,
  type DesignTheme,
} from "@/src/theme";
import { iconSize, motion, radius, space, type } from "@/src/theme/data";
import { MotionPressable } from "@/src/shared/MotionPressable";

export { useDesignTheme };
export type { DesignTheme };

export const uiHaptics = {
  light: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics are optional and can be unavailable in browsers and simulators.
    }
  },
  success: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics are optional and can be unavailable in browsers and simulators.
    }
  },
  warning: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Haptics are optional and can be unavailable in browsers and simulators.
    }
  },
};

let nativeReducedMotion = true;
const reducedMotionListeners = new Set<() => void>();

function notifyReducedMotion() {
  reducedMotionListeners.forEach((listener) => listener());
}

function subscribeReducedMotion(listener: () => void) {
  reducedMotionListeners.add(listener);
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia
  ) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => listener();
    query.addEventListener("change", onChange);
    return () => {
      reducedMotionListeners.delete(listener);
      query.removeEventListener("change", onChange);
    };
  }

  const subscription = AccessibilityInfo.addEventListener(
    "reduceMotionChanged",
    (value) => {
      nativeReducedMotion = value;
      notifyReducedMotion();
    },
  );
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      nativeReducedMotion = value;
      notifyReducedMotion();
    })
    .catch(() => {});
  return () => {
    reducedMotionListeners.delete(listener);
    subscription.remove();
  };
}

function getReducedMotionSnapshot() {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return nativeReducedMotion;
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
}

export type CardProps = ViewProps & { children?: ReactNode };

export function Card({ children, style, ...props }: CardProps) {
  const { colors } = useDesignTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.card,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function GlassBar({
  children,
  style,
  ...props
}: ViewProps & { children?: ReactNode }) {
  const { colors, appearance } = useDesignTheme();
  const barStyle: ViewStyle = {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  };
  if (Platform.OS !== "ios") {
    return (
      <View {...props} style={[barStyle, style]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView
      {...props}
      intensity={32}
      tint={
        appearance === "dark" ? "systemMaterialDark" : "systemMaterialLight"
      }
      style={[barStyle, style]}
    >
      {children}
    </BlurView>
  );
}

export type ChipProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  selected?: boolean;
  count?: string | number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Chip({
  label,
  selected = false,
  count,
  icon,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  textStyle,
  ...props
}: ChipProps) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const isDisabled = disabled ?? false;
  return (
    <MotionPressable
      {...props}
      disabled={isDisabled}
      onPress={(event) => {
        if (!selected) void uiHaptics.light();
        onPress?.(event);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        ...accessibilityState,
        selected,
        disabled: isDisabled,
      }}
      style={({ pressed }) => [
        {
          minHeight: themeTokens.layout.minTapTarget,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.xs,
          paddingHorizontal: space.md,
          paddingVertical: space.xs,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : colors.surface,
          opacity: isDisabled
            ? motion.disabledOpacity
            : pressed
              ? motion.pressedOpacity
              : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text
        maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
        style={[
          {
            color: selected ? colors.onAccent : colors.textPrimary,
            ...type.secondary,
            fontWeight: type.weight.semibold,
            flexShrink: 1,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text
          maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
          style={{
            color: selected ? colors.onAccent : colors.textSecondary,
            ...type.caption,
            fontWeight: type.weight.bold,
          }}
        >
          {count}
        </Text>
      )}
    </MotionPressable>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
  icon?: ReactNode;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [controlWidth, setControlWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = options.length
    ? Math.max(
        0,
        (controlWidth - space.xs * 2 - space.xs * (options.length - 1)) /
          options.length,
      )
    : 0;
  const indicatorStyle = useAnimatedStyle(() => {
    const nextOffset = activeIndex * (segmentWidth + space.xs);
    return {
      transform: [
        {
          translateX: reducedMotion
            ? nextOffset
            : withSpring(nextOffset, themeTokens.motion.spring),
        },
      ],
    };
  }, [activeIndex, reducedMotion, segmentWidth, themeTokens.motion.spring]);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onLayout={(event) => setControlWidth(event.nativeEvent.layout.width)}
      style={{
        position: "relative",
        flexDirection: "row",
        alignItems: "stretch",
        gap: space.xs,
        padding: space.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: space.xs,
            top: space.xs,
            bottom: space.xs,
            width: segmentWidth,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          },
          indicatorStyle,
        ]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <MotionPressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected, selected }}
            aria-selected={selected}
            onPress={() => {
              if (selected) return;
              void uiHaptics.light();
              onChange(option.value);
            }}
            style={({ pressed }) => ({
              zIndex: 1,
              flex: 1,
              minWidth: 0,
              minHeight: themeTokens.layout.minTapTarget,
              paddingHorizontal: space.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              opacity: pressed ? motion.pressedOpacity : 1,
            })}
          >
            {tintIcon(
              option.icon,
              selected ? colors.textPrimary : colors.textSecondary,
            )}
            <Text
              maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
              numberOfLines={1}
              style={{
                color: selected ? colors.textPrimary : colors.textSecondary,
                ...type.secondary,
                fontWeight: selected ? type.weight.bold : type.weight.medium,
                flexShrink: 1,
              }}
            >
              {option.label}
            </Text>
          </MotionPressable>
        );
      })}
    </View>
  );
}

function tintIcon(icon: ReactNode, color: string) {
  if (!React.isValidElement(icon)) return icon;
  return React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
    color,
  });
}

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function DesignButton({
  title,
  children,
  icon,
  loading = false,
  compact = false,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  style,
  textStyle,
  variant,
  ...props
}: ButtonProps & { variant: "primary" | "secondary" }) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const isDisabled = disabled ?? false;
  const primary = variant === "primary";
  const foreground = primary ? colors.onAccent : colors.textPrimary;
  const content = children ?? title;
  const busy = loading;
  return (
    <MotionPressable
      {...props}
      disabled={isDisabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        ...accessibilityState,
        disabled: isDisabled || busy,
        busy,
      }}
      style={({ pressed }) => [
        {
          minHeight: compact
            ? themeTokens.layout.minTapTarget
            : themeTokens.layout.primaryButtonHeight,
          paddingHorizontal: compact ? space.md : space.lg,
          paddingVertical: compact ? space.xs : space.sm,
          borderRadius: radius.button,
          borderWidth: primary ? 0 : 1,
          borderColor: colors.border,
          backgroundColor: primary ? colors.accent : colors.surfaceRaised,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity:
            isDisabled || busy
              ? motion.disabledOpacity
              : pressed
                ? motion.pressedOpacity
                : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} /> : icon}
      {content && typeof content === "string" ? (
        <Text
          maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
          style={[
            {
              color: foreground,
              ...type.secondary,
              fontWeight: type.weight.bold,
              textAlign: "center",
              flexShrink: 1,
            },
            textStyle,
          ]}
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </MotionPressable>
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <DesignButton {...props} variant="primary" />;
}

export function SecondaryButton(props: ButtonProps) {
  return <DesignButton {...props} variant="secondary" />;
}

export function IconButton({
  label,
  accessibilityLabel,
  children,
  selected = false,
  style,
  accessibilityState,
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  label?: string;
  accessibilityLabel?: string;
  children: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const accessibleName = accessibilityLabel ?? label ?? "Action";
  const disabled = props.disabled ?? false;
  return (
    <MotionPressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibleName}
      accessibilityState={{ ...accessibilityState, selected, disabled }}
      style={({ pressed }) => [
        {
          width: themeTokens.layout.minTapTarget,
          height: themeTokens.layout.minTapTarget,
          borderRadius: radius.button,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled
            ? motion.disabledOpacity
            : pressed
              ? motion.pressedOpacity
              : 1,
        },
        style,
      ]}
    >
      {children}
    </MotionPressable>
  );
}

export function Avatar({
  name,
  size,
  availability,
  testID = "user-avatar",
  accessibilityLabel,
}: {
  name: string;
  size?: number;
  availability?: Availability;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const { showAvatars } = usePreferences();
  const avatarSize = size ?? themeTokens.layout.avatarDefaultSize;
  const availabilityToken = availability
    ? themeTokens.availability[availability]
    : undefined;
  const AvatarAvailabilityIcon = availabilityToken?.icon;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const avatarGlyphSize = Math.max(iconSize.sm, avatarSize * 0.48);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ??
        `Avatar for ${name}${availabilityToken ? `, ${availabilityToken.label}` : ""}`
      }
      testID={testID}
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: radius.circle,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: availabilityToken ? 2 : 0,
        borderColor: availabilityToken?.color ?? colors.transparent,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      {showAvatars ? (
        <Text
          maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
          style={{
            color: colors.textPrimary,
            fontSize: Math.max(type.caption.fontSize, avatarSize * 0.31),
            fontWeight: type.weight.bold,
          }}
        >
          {initials || "?"}
        </Text>
      ) : (
        <UserRound size={avatarGlyphSize} color={colors.textSecondary} />
      )}
      {availabilityToken && AvatarAvailabilityIcon ? (
        <View
          style={{
            position: "absolute",
            right: -space.xxs,
            bottom: -space.xxs,
            width: Math.max(iconSize.sm, avatarSize * 0.34),
            height: Math.max(iconSize.sm, avatarSize * 0.34),
            borderRadius: radius.circle,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: availabilityToken.color,
            borderColor: colors.surface,
            borderWidth: 2,
          }}
        >
          <AvatarAvailabilityIcon
            size={iconSize.xs}
            color={availabilityToken.onColor}
          />
        </View>
      ) : null}
    </View>
  );
}

export function AvatarStack({
  people,
  limit,
  size,
}: {
  people: readonly { id: string; name: string }[];
  limit?: number;
  size?: number;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const visible = people.slice(0, limit ?? themeTokens.layout.avatarStackLimit);
  const remaining = Math.max(0, people.length - visible.length);
  const avatarSize = size ?? themeTokens.layout.avatarDefaultSize;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${visible.map((person) => person.name).join(", ")}${remaining ? ` and ${remaining} more` : ""}`}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      {visible.map((person, index) => (
        <View
          key={person.id}
          style={{
            marginLeft:
              index === 0 ? 0 : -themeTokens.layout.avatarStackOverlap,
            borderRadius: radius.circle,
            borderColor: colors.surface,
            borderWidth: 2,
            zIndex: visible.length - index,
          }}
        >
          <Avatar
            name={person.name}
            size={avatarSize}
            testID={`user-avatar-${person.id}`}
          />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            marginLeft: -themeTokens.layout.avatarStackOverlap,
            borderRadius: radius.circle,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.surface,
            borderWidth: 2,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              ...type.caption,
              fontWeight: type.weight.bold,
            }}
          >
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

export function CategoryBadge({
  category,
  size,
  showLabel = false,
}: {
  category: Category;
  size?: number;
  showLabel?: boolean;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const token = themeTokens.categories[category];
  const badgeSize = size ?? themeTokens.layout.categoryBadgeSize;
  const Icon = token.icon;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${category} category`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        minHeight: badgeSize,
        paddingHorizontal: showLabel ? space.sm : 0,
        borderRadius: radius.pill,
        backgroundColor: showLabel ? token.tint : colors.transparent,
      }}
    >
      <View
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: radius.circle,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: token.tint,
        }}
      >
        <Icon size={badgeSize * 0.5} color={token.color} />
      </View>
      {showLabel && (
        <Text
          style={{
            color: token.color,
            ...type.caption,
            fontWeight: type.weight.bold,
          }}
        >
          {category}
        </Text>
      )}
    </View>
  );
}

export function ProgressBar({
  progress,
  value,
  max = 100,
  label,
  style,
}: {
  progress?: number;
  value?: number;
  max?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesignTheme();
  if (progress === undefined && value === undefined) return null;
  const rawProgress =
    progress ?? (value !== undefined ? (value / max) * 100 : 0);
  const percent = Math.min(
    100,
    Math.max(0, Number.isFinite(rawProgress) ? rawProgress : 0),
  );
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[
        {
          height: space.sm,
          overflow: "hidden",
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceRaised,
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  style,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesignTheme();
  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          padding: space.xl,
          gap: space.sm,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          color: colors.textPrimary,
          ...type.title,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            color: colors.textSecondary,
            ...type.secondary,
            textAlign: "center",
          }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <PrimaryButton title={action.label} onPress={action.onPress} compact />
      ) : null}
    </View>
  );
}

export function Skeleton({
  width = "100%",
  height = space.lg,
  borderRadius = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: reducedMotion
        ? motion.skeletonOpacityRest
        : withRepeat(
            withTiming(motion.skeletonOpacityHigh, {
              duration: motion.skeletonPulseDuration,
            }),
            -1,
            true,
          ),
    }),
    [reducedMotion],
  );
  return (
    <Animated.View
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceRaised,
          opacity: motion.skeletonOpacityLow,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

let demoNoticeDismissed = false;
let demoNoticeSessionKey = "default";
const demoNoticeListeners = new Set<() => void>();

function subscribeDemoNotice(listener: () => void) {
  demoNoticeListeners.add(listener);
  return () => demoNoticeListeners.delete(listener);
}

function notifyDemoNotice() {
  demoNoticeListeners.forEach((listener) => listener());
}

export function resetDemoChipDismissal(sessionKey?: string) {
  if (sessionKey !== undefined) demoNoticeSessionKey = sessionKey;
  demoNoticeDismissed = false;
  notifyDemoNotice();
}

export function DemoNoticeProvider({
  children,
  sessionKey = "default",
}: {
  children: ReactNode;
  sessionKey?: string;
}) {
  useEffect(() => {
    if (demoNoticeSessionKey !== sessionKey) resetDemoChipDismissal(sessionKey);
  }, [sessionKey]);
  return <>{children}</>;
}

export function DemoChip() {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const dismissed = useSyncExternalStore(
    subscribeDemoNotice,
    () => demoNoticeDismissed,
    () => false,
  );
  if (dismissed) return null;
  return (
    <View
      testID="demo-chip"
      style={{
        minHeight: themeTokens.layout.touchTarget + space.xs,
        maxWidth: "100%",
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingLeft: space.md,
        paddingRight: space.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.accent,
      }}
    >
      <Text
        maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
        style={{
          flexShrink: 1,
          minWidth: 0,
          color: colors.onAccent,
          ...type.caption,
          fontWeight: type.weight.bold,
        }}
      >
        {"Demo \u00b7 Sample people and plans"}
      </Text>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss demo notice"
        hitSlop={space.xs}
        onPress={() => {
          demoNoticeDismissed = true;
          notifyDemoNotice();
        }}
        style={{
          width: themeTokens.layout.touchTarget,
          height: themeTokens.layout.touchTarget,
          borderRadius: radius.circle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={iconSize.sm} color={colors.onAccent} />
      </MotionPressable>
    </View>
  );
}

export function Toast({
  message,
  visible,
  onDismiss,
  duration,
  tone = "info",
}: {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const visibleDuration = duration ?? themeTokens.motion.toastDuration;
  useEffect(() => {
    if (!visible || visibleDuration <= 0) return undefined;
    const timeout = setTimeout(onDismiss, visibleDuration);
    return () => clearTimeout(timeout);
  }, [visibleDuration, onDismiss, visible]);
  if (!visible) return null;
  const toneToken =
    themeTokens.availability[
      tone === "danger"
        ? "unavailable"
        : tone === "success"
          ? "available"
          : tone === "warning"
            ? "endingSoon"
            : "unknown"
    ];
  const toneColor =
    tone === "info"
      ? colors.textSecondary
      : tone === "danger"
        ? colors.danger
        : toneToken.color;
  const ToneIcon = toneToken.icon;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        minHeight: themeTokens.layout.minTapTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderColor: colors.border,
        borderWidth: 1,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <ToneIcon size={iconSize.sm} color={toneColor} />
      <Text
        maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
        style={{
          flex: 1,
          color: colors.textPrimary,
          ...type.secondary,
          fontWeight: type.weight.semibold,
        }}
      >
        {message}
      </Text>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={onDismiss}
        style={{
          width: themeTokens.layout.minTapTarget,
          height: themeTokens.layout.minTapTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={iconSize.sm} color={colors.textSecondary} />
      </MotionPressable>
    </View>
  );
}

export function ListItem({
  title,
  description,
  children,
  accessory,
  leading,
  onPress,
  index = 0,
  style,
  testID,
  accessibilityLabel,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  accessory?: ReactNode;
  leading?: ReactNode;
  onPress?: () => void;
  index?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors, tokens: themeTokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const content = children ?? (
    <View
      style={[
        {
          minHeight: themeTokens.layout.denseRowMinHeight,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingVertical: space.sm,
          paddingHorizontal: space.md,
        },
        style,
      ]}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
        {title ? (
          <Text
            maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
            style={{ color: colors.textPrimary, ...type.headline }}
          >
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            maxFontSizeMultiplier={themeTokens.type.denseMaxMultiplier}
            style={{ color: colors.textSecondary, ...type.secondary }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {accessory}
    </View>
  );
  const animatedContent = (
    <Animated.View
      entering={
        index >= themeTokens.motion.listStaggerCount
          ? undefined
          : reducedMotion
            ? FadeIn.duration(themeTokens.motion.entranceDuration)
            : FadeInDown.delay(index * themeTokens.motion.listStagger).duration(
                themeTokens.motion.entranceDuration,
              )
      }
      testID={onPress ? undefined : testID}
    >
      {onPress && children === undefined ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title ?? "List item"}
          onPress={onPress}
          testID={testID}
          style={({ pressed }) => ({
            opacity: pressed ? motion.pressedOpacity : 1,
          })}
        >
          {content}
        </MotionPressable>
      ) : (
        content
      )}
    </Animated.View>
  );
  return animatedContent;
}
