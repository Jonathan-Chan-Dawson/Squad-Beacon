import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  ArrowUpRight,
  Check,
  CircleHelp,
  Shuffle,
  ThumbsUp,
  Vote,
  X,
} from "lucide-react-native";
import { useReducedMotion } from "@/src/shared/design-system";
import { uiHaptics, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { PlanningResponse } from "@/src/features/planning/types";

export interface PlanningCardAction {
  id: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  /** Detail navigation has no response-selection feedback. */
  feedback?: "selection" | "none";
  onPress: () => Promise<boolean | void> | void;
}

interface PlanningCardBase {
  showDeadline?: boolean;
  embedded?: boolean;
  /** Original canonical thread identity. Counts and source must be authorized by the caller. */
  id: string;
  title: string;
  sourceLabel: string;
  deadline?: string | null;
  counts: { label: string; value: number }[];
  pending?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onOpen: () => void;
}

/** Callers own mutation and canonical state. Resolve false or throw on failure.
 * Keep the card mounted through onAcknowledged to allow successful selection feedback
 * before removing it from a response carousel. Vote/Draw actions keep their own semantics. */
export type PlanningResponseCardProps = PlanningCardBase &
  (
    | {
        kind: "ping";
        selected?: PlanningResponse | null;
        onRespond: (response: PlanningResponse) => Promise<boolean | void>;
        onAcknowledged?: (response: PlanningResponse) => void;
      }
    | {
        kind: "vote" | "draw" | "time";
        selected?: string | null;
        actions: PlanningCardAction[];
      }
  );

function countdown(deadline: string | null | undefined, now: number) {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return null;
  const minutes = Math.ceil((Date.parse(deadline) - now) / 60000);
  if (minutes <= 0) return "Deadline passed";
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < 1440)
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
  return `${Math.ceil(minutes / 1440)}d left`;
}

export function PlanningResponseCard(props: PlanningResponseCardProps) {
  const { styles, colors, semanticColors } = useTheme();
  const now = useNow();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    value: string;
    previousSelected: string | null | undefined;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pulse.stopAnimation();
    };
  }, [pulse]);
  const successSelection =
    success?.previousSelected === props.selected ? success?.value : null;
  const expiredPing =
    props.kind === "ping" &&
    !!props.deadline &&
    Date.parse(props.deadline) <= now;
  const disabled = !!(props.disabled || props.pending || busy || expiredPing);
  const compactPing = props.kind === "ping" && props.embedded && props.compact;
  const remaining = countdown(props.deadline, now);
  const Icon =
    props.kind === "ping" ? CircleHelp : props.kind === "vote" ? Vote : Shuffle;
  const actions: PlanningCardAction[] =
    props.kind === "ping"
      ? (["interested", "maybe", "pass"] as const).map((response) => ({
          id: response,
          label: response[0].toUpperCase() + response.slice(1),
          selected: (successSelection ?? props.selected) === response,
          onPress: () => props.onRespond(response),
        }))
      : props.actions;

  async function run(action: PlanningCardAction) {
    if (lock.current || disabled || action.disabled) return;
    lock.current = true;
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      const acknowledged = await action.onPress();
      if (acknowledged === false) throw new Error("Response was not saved.");
      if (!mounted.current) return;
      if (action.feedback === "none") return;
      setSuccess({ value: action.id, previousSelected: props.selected });
      void uiHaptics.success();
      await new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.025,
            duration: reduceMotion ? 0 : 100,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: reduceMotion ? 0 : 120,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
      if (mounted.current && props.kind === "ping")
        props.onAcknowledged?.(action.id as PlanningResponse);
    } catch {
      if (mounted.current) setError("Couldn't save your response. Try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const countSummary = props.counts.length ? (
    <Text
      style={[styles.muted, props.embedded && { fontSize: 12, lineHeight: 18 }]}
    >
      {props.counts.map((count) => `${count.value} ${count.label}`).join(" · ")}
    </Text>
  ) : null;

  return (
    <Animated.View
      testID={`planning-response-${props.id}`}
      style={[
        props.embedded ? undefined : styles.card,
        {
          gap: compactPing ? 5 : 10,
          marginTop: compactPing ? 3 : 0,
          padding: props.embedded ? 0 : props.compact ? 12 : 14,
          borderColor: success ? colors.green : colors.line,
          transform: [{ scale: pulse }],
        },
      ]}
    >
      {!props.embedded && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${props.kind}: ${props.title}`}
          onPress={props.onOpen}
          style={[styles.row, { minHeight: 44 }]}
        >
          <Icon size={20} color={colors.green} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text
              style={[styles.body, { fontWeight: "700" }]}
              numberOfLines={2}
            >
              {props.title}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {props.sourceLabel}
            </Text>
          </View>
          <ArrowUpRight size={17} color={colors.muted} />
        </Pressable>
      )}
      {remaining && props.showDeadline !== false ? (
        <Text style={[styles.label, { color: colors.green }]}>{remaining}</Text>
      ) : null}
      {!compactPing && countSummary}
      {actions.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {actions.map((action) => {
            const selected =
              action.selected ||
              (props.kind !== "ping" &&
                (successSelection ?? props.selected) === action.id);
            const ResponseIcon =
              props.kind === "ping"
                ? action.id === "interested"
                  ? ThumbsUp
                  : action.id === "pass"
                    ? X
                    : CircleHelp
                : null;
            const ButtonIcon =
              props.kind === "ping" && selected && !compactPing
                ? Check
                : ResponseIcon;
            return (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                aria-pressed={!!selected}
                accessibilityState={{
                  selected: !!selected,
                  disabled: disabled || !!action.disabled,
                  busy,
                }}
                disabled={disabled || action.disabled}
                onPress={(event) => {
                  event.stopPropagation();
                  void run(action);
                }}
                style={{
                  minHeight: 44,
                  flexDirection: props.kind === "ping" ? "row" : undefined,
                  flexGrow: 1,
                  flexBasis: compactPing
                    ? "auto"
                    : props.kind === "ping"
                      ? 0
                      : undefined,
                  minWidth: props.kind === "ping" ? 76 : undefined,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: compactPing
                    ? 4
                    : props.kind === "ping"
                      ? 6
                      : 9,
                  borderRadius: compactPing
                    ? 8
                    : props.kind === "ping"
                      ? 11
                      : 22,
                  borderWidth: compactPing ? 0 : 1,
                  borderColor: selected
                    ? props.kind === "ping"
                      ? semanticColors.accent
                      : colors.green
                    : props.kind === "ping"
                      ? semanticColors.border
                      : colors.line,
                  backgroundColor: compactPing
                    ? "transparent"
                    : props.kind === "ping"
                      ? selected
                        ? semanticColors.accent
                        : compactPing
                          ? "transparent"
                          : semanticColors.surfaceRaised
                      : selected
                        ? colors.lime
                        : colors.bg,
                  opacity: disabled ? 0.65 : 1,
                  ...(props.kind === "ping"
                    ? { gap: 4, paddingVertical: 5 }
                    : undefined),
                }}
              >
                {compactPing && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                      borderRadius: 10,
                      backgroundColor: selected
                        ? semanticColors.accent
                        : semanticColors.surfaceRaised,
                    }}
                  />
                )}
                {ButtonIcon ? (
                  <View style={{ zIndex: 1 }}>
                    <ButtonIcon
                      size={compactPing ? 16 : 14}
                      color={
                        selected
                          ? semanticColors.onAccent
                          : semanticColors.textSecondary
                      }
                    />
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        props.kind === "ping"
                          ? selected
                            ? semanticColors.onAccent
                            : semanticColors.textPrimary
                          : selected
                            ? colors.green
                            : colors.ink,
                      fontSize: compactPing
                        ? 14
                        : props.kind === "ping"
                          ? 12
                          : undefined,
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {compactPing && countSummary}
      {busy || props.pending ? (
        <ActivityIndicator
          size="small"
          color={colors.green}
          accessibilityLabel="Saving response"
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.muted}>
          {error}
        </Text>
      ) : null}
    </Animated.View>
  );
}
