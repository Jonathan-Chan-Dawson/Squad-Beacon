import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Toast, uiHaptics, useReducedMotion } from "@/src/shared/design-system";
import { Button, Field, Sheet, useTheme } from "@/src/shared/ui";
import type { PulseAnswers, PulseDraft, PulseKind, PulsePlace, PulseCondition } from "../types";
import { pulseProfiles } from "../pulseProfiles";
import { pulseCopy, pulseKindLabel, pulseNoteCounter, pulseOptionLabel } from "../copy/pulse";
import { PulseLevelGlyph, usePulseColors } from "./PulseVisuals";

export type AddLiveUpdateSheetProps = {
  visible: boolean;
  scopeKey: string;
  place: PulsePlace | null;
  initialAnswers?: PulseAnswers;
  onClose: () => void;
  onPost: (draft: PulseDraft) => Promise<unknown>;
  onPosted?: () => void;
};

function UpdateChoice({ kind, value, selected, disabled, onPress }: {
  kind: PulseKind; value: number | PulseCondition; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  const { styles, semanticColors: colors, tokens } = useTheme();
  const levels = usePulseColors();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const motionStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => { scale.set(reducedMotion ? 1 : withSpring(selected ? 1.04 : 1, { damping: 18, stiffness: 220 })); }, [selected, reducedMotion, scale]);
  const color = typeof value === "number" && (kind === "crowd" || kind === "wait") ? levels[Math.min(3, Math.max(0, value))] : colors.accent;
  return <Animated.View style={motionStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={pulseOptionLabel(kind, value)} accessibilityState={{ selected, disabled }}
      aria-pressed={selected} disabled={disabled} onPress={() => { void uiHaptics.light(); onPress(); }} style={({ pressed }) => ({
        minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: selected ? 2 : 1,
        borderColor: selected ? color : colors.border, backgroundColor: selected ? colors.surfaceRaised : colors.surface,
        flexDirection: "row", alignItems: "center", gap: 8, opacity: disabled ? tokens.motion.disabledOpacity : pressed ? 0.8 : 1,
      })}>
      {kind === "crowd" && typeof value === "number" && <PulseLevelGlyph level={value} compact color={color} />}
      <Text style={styles.body}>{pulseOptionLabel(kind, value)}</Text>
      {selected && <Check size={16} color={color} />}
    </Pressable>
  </Animated.View>;
}

export function AddLiveUpdateSheet(props: AddLiveUpdateSheetProps) {
  return <LiveUpdateSheetContent key={JSON.stringify([props.scopeKey, props.place?.placeKey, props.visible])} {...props} />;
}

function LiveUpdateSheetContent({ visible, place, initialAnswers, onClose, onPost, onPosted }: AddLiveUpdateSheetProps) {
  const { styles, semanticColors: colors, tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  const groups = useMemo(() => place ? pulseProfiles[place.category].groups : [], [place]);
  const [answers, setAnswers] = useState<PulseAnswers>(() => {
    const valid: PulseAnswers = {};
    for (const group of groups) {
      const value = initialAnswers?.[group.kind];
      if (value !== undefined && group.options.includes(value)) valid[group.kind] = value;
    }
    return valid;
  });
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "posting" | "success">("idle");
  const [error, setError] = useState("");
  const request = useRef(0);
  const locked = useRef(false);
  const ripple = useSharedValue(0);
  const rippleStyle = useAnimatedStyle(() => ({ opacity: (1 - ripple.value) * 0.18, transform: [{ scale: 1 + ripple.value * 0.45 }] }));
  useLayoutEffect(() => {
    locked.current = false;
    return () => { request.current += 1; locked.current = true; };
  }, []);
  const validAnswers = Object.fromEntries(groups.flatMap((group) => {
    const value = answers[group.kind];
    return value !== undefined && group.options.includes(value) ? [[group.kind, value]] : [];
  })) as PulseAnswers;
  const hasChoice = Object.keys(validAnswers).length > 0;
  const post = async () => {
    if (locked.current || !visible || !place || !hasChoice) return;
    locked.current = true; setPhase("posting"); setError("");
    const attempt = ++request.current;
    try {
      const result = await onPost({ place, answers: validAnswers, ...(note.trim() ? { note: note.trim().slice(0, 80) } : {}) });
      if (result === false) throw new Error(pulseCopy.postFailure);
      if (request.current !== attempt) return;
      setPhase("success");
      ripple.set(reducedMotion ? 1 : withTiming(1, { duration: 200 }));
      void uiHaptics.success();
      AccessibilityInfo.announceForAccessibility(pulseCopy.posted);
      onPosted?.();
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      if (request.current === attempt) onClose();
    } catch (failure) {
      if (request.current !== attempt) return;
      const message = failure instanceof Error ? failure.message : "";
      setError(/rate|limit|too many/i.test(message) ? pulseCopy.rateLimited : pulseCopy.postFailure);
      setPhase("idle");
    } finally { if (request.current === attempt) locked.current = false; }
  };
  const pending = phase !== "idle";
  return <Sheet title={pulseCopy.title} visible={visible && !!place} onClose={onClose} snapHeight={340} footer={
    <View style={{ gap: 8 }}>
      <View style={{ overflow: "hidden", borderRadius: tokens.radius.button }}>
        {phase === "success" && <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, zIndex: 1, borderRadius: tokens.radius.button, backgroundColor: colors.onAccent }, rippleStyle]} />}
        <Pressable accessibilityRole="button" accessibilityLabel={phase === "posting" ? pulseCopy.posting : phase === "success" ? pulseCopy.posted : pulseCopy.post}
          accessibilityState={{ disabled: !hasChoice || pending, busy: phase === "posting" }} disabled={!hasChoice || pending} onPress={() => { void post(); }}
          style={{ minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: tokens.radius.button,
            opacity: !hasChoice ? tokens.motion.disabledOpacity : 1, flexDirection: "row", gap: 8 }}>
          {phase === "posting" ? <ActivityIndicator color={colors.onAccent} /> : phase === "success" ? <Check color={colors.onAccent} size={24} /> : null}
          <Text style={[styles.body, { color: colors.onAccent, fontWeight: "600" }]}>{phase === "posting" ? pulseCopy.posting : phase === "success" ? pulseCopy.posted : pulseCopy.post}</Text>
        </Pressable>
      </View>
      {!!error && <Button title={pulseCopy.retry} secondary onPress={() => { void post(); }} disabled={!hasChoice || pending} />}
    </View>
  }>
    <View testID="add-live-update-sheet" style={{ gap: 12 }}>
      <Text style={styles.body}>{place?.name || pulseCopy.areaUpdate}</Text>
      {groups.map((group) => <View key={group.kind} style={{ gap: 8 }}>
        <Text style={styles.h2}>{pulseKindLabel(group.kind)}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 3 }}>
          {group.options.map((value) => <UpdateChoice key={String(value)} kind={group.kind} value={value} selected={answers[group.kind] === value} disabled={pending}
            onPress={() => setAnswers((previous) => { const next = { ...previous }; if (next[group.kind] === value) delete next[group.kind]; else next[group.kind] = value; return next; })} />)}
        </ScrollView>
      </View>)}
      <Animated.View layout={reducedMotion ? undefined : LinearTransition.duration(180)}>
      {!noteOpen ? <Button title={pulseCopy.shortUpdate} secondary disabled={pending} onPress={() => setNoteOpen(true)} /> :
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} exiting={reducedMotion ? undefined : FadeOut.duration(180)} style={{ gap: 4 }}>
          <Field label={pulseCopy.noteLabel} value={note} onChangeText={(value) => setNote(value.slice(0, 80))} multiline maxLength={80} editable={!pending} />
          <Text style={styles.muted}>{pulseCopy.noteHint} · {pulseNoteCounter(note.length)}</Text>
        </Animated.View>}
      </Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel={pulseCopy.retry} onPress={() => { void post(); }} disabled={pending || !error}>
        <Toast visible={!!error} message={error} tone="danger" onDismiss={() => setError("")} />
      </Pressable>
    </View>
  </Sheet>;
}
