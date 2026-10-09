import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type ViewStyle,
} from "react-native";
import { tokens } from "@/src/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a restrained scale response that respects the live system preference. */
export function MotionPressable({
  children,
  disabled = false,
  accessibilityState,
  onPressIn,
  onPressOut,
  style,
  ...props
}: PressableProps) {
  const scale = useMemo(() => new Animated.Value(1), []);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const motionAllowedRef = useRef(false);
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || accessibilityState?.disabled === true;

  const resetScale = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
    scale.setValue(1);
  }, [scale]);

  const setMotionAllowed = useCallback(
    (allowed: boolean) => {
      motionAllowedRef.current = allowed;
      if (!allowed) resetScale();
    },
    [resetScale],
  );

  if (isDisabled && pressed) setPressed(false);

  useEffect(() => {
    let mounted = true;
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
      )
        return () => {
          mounted = false;
        };
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = (event: MediaQueryListEvent) =>
        setMotionAllowed(!event.matches);
      query.addEventListener("change", onChange);
      setMotionAllowed(!query.matches);
      return () => {
        mounted = false;
        query.removeEventListener("change", onChange);
        resetScale();
      };
    }

    let eventReceived = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduceMotionEnabled) => {
        eventReceived = true;
        setMotionAllowed(!reduceMotionEnabled);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotionEnabled) => {
        if (mounted && !eventReceived) setMotionAllowed(!reduceMotionEnabled);
      })
      .catch(() => {
        // Unknown preference stays fail-closed; a later event can resolve it.
      });

    return () => {
      mounted = false;
      subscription.remove();
      resetScale();
    };
  }, [resetScale, setMotionAllowed]);

  useEffect(() => {
    if (isDisabled) resetScale();
  }, [isDisabled, resetScale]);

  const animateScale = (toValue: number, duration: number) => {
    animation.current?.stop();
    animation.current = null;
    if (isDisabled || !motionAllowedRef.current) {
      scale.setValue(1);
      return;
    }
    const next = Animated.timing(scale, {
      toValue,
      duration,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.current = next;
    next.start(({ finished }) => {
      if (finished && animation.current === next) animation.current = null;
    });
  };

  const baseStyle =
    typeof style === "function"
      ? style({ pressed: pressed && !isDisabled } as PressableStateCallbackType)
      : style;
  const flattened = StyleSheet.flatten(baseStyle) as ViewStyle | undefined;
  const transforms = Array.isArray(flattened?.transform)
    ? flattened.transform
    : [];
  const animatedStyle = [
    flattened,
    {
      transform: [...transforms, { scale }],
    } as Animated.WithAnimatedValue<ViewStyle>,
  ];

  return (
    <AnimatedPressable
      {...props}
      disabled={isDisabled}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      aria-disabled={isDisabled}
      aria-selected={props["aria-selected"] ?? accessibilityState?.selected}
      aria-checked={props["aria-checked"] ?? accessibilityState?.checked}
      onPressIn={(event) => {
        setPressed(true);
        animateScale(tokens.motion.pressScale, tokens.motion.pressDuration);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animateScale(1, tokens.motion.pressDuration);
        onPressOut?.(event);
      }}
      style={animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
}
