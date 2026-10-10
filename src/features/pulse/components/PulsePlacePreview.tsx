import React, { useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";
import { Check, MoreHorizontal, Radio, X } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { FadeInDown, FadeOutUp, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { Toast, uiHaptics, useReducedMotion } from "@/src/shared/design-system";
import { Button, IconButton, Txt, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { PulseAnswers, PulsePlace, PulseSummary } from "../types";
import { pulseCategoryLabel, pulseConditionText, pulseCopy, pulseLevelText, pulseMetaText } from "../copy/pulse";
import { PulseLevelGlyph } from "./PulseVisuals";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 10;
export type PulsePlacePreviewProps = {
  scopeKey: string;
  place: PulsePlace;
  summary?: PulseSummary | null;
  onClose: () => void;
  onAdd: (initialAnswers?: PulseAnswers) => void;
  onConfirm: (placeKey: string) => Promise<unknown>;
  confirmedUntil?: number;
  lastAnswers?: PulseAnswers;
  onCreateBeacon: () => void;
  happeningHere?: React.ReactNode;
  onReportNote: (placeKey: string) => Promise<unknown>;
};

export function PulsePlacePreview(props: PulsePlacePreviewProps) {
  return <PulsePreviewContent key={JSON.stringify([props.scopeKey, props.place.placeKey])} {...props} />;
}

function PulsePreviewContent({ place, summary, onClose, onAdd, onConfirm, confirmedUntil = 0, lastAnswers,
  onCreateBeacon, happeningHere, onReportNote }: PulsePlacePreviewProps) {
  const { styles, semanticColors: colors, tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  const tick = useNow();
  const [confirmedAt, setConfirmedAt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [noteMenu, setNoteMenu] = useState(false);
  const [noteHidden, setNoteHidden] = useState(false);
  const [reporting, setReporting] = useState(false);
  const attempt = useRef(0);
  const reportAttempt = useRef(0);
  const locked = useRef(false);
  const progress = useSharedValue(0);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  useLayoutEffect(() => () => { attempt.current += 1; reportAttempt.current += 1; }, []);
  const current = summary?.placeKey === place.placeKey && summary.recentCount > 0 ? summary : undefined;
  const cooldown = Math.max(confirmedUntil, confirmedAt ? confirmedAt + 10 * 60 * 1000 : 0) > tick;
  const confirm = async () => {
    if (locked.current || cooldown || !current) return;
    locked.current = true; setConfirming(true); setError("");
    const request = ++attempt.current;
    const started = Date.now();
    progress.set(reducedMotion ? 1 : withTiming(1, { duration: 600 }));
    try {
      const result = await onConfirm(place.placeKey);
      if (result === false) throw new Error(pulseCopy.confirmFailure);
      if (!reducedMotion) await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, 600 - (Date.now() - started))));
      if (attempt.current !== request) return;
      setConfirmedAt(Date.now()); void uiHaptics.success(); AccessibilityInfo.announceForAccessibility(pulseCopy.confirmSuccess);
    } catch {
      if (attempt.current !== request) return;
      progress.set(0); setError(pulseCopy.confirmFailure);
    } finally { if (attempt.current === request) { locked.current = false; setConfirming(false); } }
  };
  return <View testID="live-update-place-preview" style={[styles.card, { gap: 8, minHeight: current ? 220 : undefined }]}>
    <View style={[styles.row, { gap: 8 }]}>
      <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={2} style={styles.h2}>{place.name || pulseCopy.areaUpdate}</Text><Txt muted>{pulseCategoryLabel(place.category)}</Txt></View>
      <IconButton label={pulseCopy.close} onPress={onClose}><X size={20} color={colors.textPrimary} /></IconButton>
    </View>
    {!current ? <>
      <View style={[styles.row, { gap: 8, paddingVertical: 8 }]}><Radio size={22} color={colors.textSecondary} /><Text style={styles.body}>{pulseCopy.noData}</Text></View>
      <Button title={pulseCopy.add} onPress={() => onAdd()} />
    </> : <>
      {current.crowd !== undefined && <View style={[styles.row, { gap: 12 }]}><PulseLevelGlyph level={current.crowd} />
        <Text style={[styles.body, { flex: 1 }]}>{pulseLevelText("crowd", current.crowd, (current.confidence?.crowd ?? 0) < 2)}</Text></View>}
      <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
        {current.wait !== undefined && <Text style={[styles.body, { borderRadius: 12, padding: 8, backgroundColor: colors.surfaceRaised }]}>{pulseLevelText("wait", current.wait, (current.confidence?.wait ?? 0) < 2)}</Text>}
        {current.parking !== undefined && <Text style={[styles.body, { borderRadius: 12, padding: 8, backgroundColor: colors.surfaceRaised }]}>{pulseLevelText("parking", current.parking, (current.confidence?.parking ?? 0) < 2)}</Text>}
        {current.conditions.map((entry) => <View key={entry.key} style={{ borderRadius: 12, padding: 8, gap: 2, backgroundColor: colors.surfaceRaised }}>
          <Text style={styles.body}>{pulseConditionText(entry.key, entry.strength)}</Text>
          {entry.strength === "reported" && <Txt muted>{pulseCopy.communityReported}</Txt>}
        </View>)}
      </View>
      <View style={{ overflow: "hidden", minHeight: 20 }}>
        <Animated.Text key={current.recentCount} entering={reducedMotion ? undefined : FadeInDown.duration(180)} exiting={reducedMotion ? undefined : FadeOutUp.duration(180)}
          style={[styles.muted, { fontVariant: ["tabular-nums"] }]}>{pulseMetaText(current.recentCount, Math.max(current.updatedAt, confirmedAt), Math.max(tick, confirmedAt))}</Animated.Text>
      </View>
      {!!current.noteSample && !noteHidden && <View style={[styles.row, { gap: 4 }]}>
        <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>{current.noteSample}</Text>
        <IconButton label={pulseCopy.noteMenu} onPress={() => setNoteMenu((value) => !value)}><MoreHorizontal size={20} color={colors.textSecondary} /></IconButton>
      </View>}
      {noteMenu && !noteHidden && <Button title={pulseCopy.reportNote} secondary disabled={reporting} onPress={() => {
        if (reporting) return;
        setReporting(true); setNoteHidden(true); setNoteMenu(false);
        const report = ++reportAttempt.current;
        void onReportNote(place.placeKey).then(() => { if (reportAttempt.current === report) AccessibilityInfo.announceForAccessibility(pulseCopy.reportSuccess); })
          .catch(() => { if (reportAttempt.current === report) setError(pulseCopy.reportFailure); })
          .finally(() => { if (reportAttempt.current === report) setReporting(false); });
      }} />}
      <View style={[styles.row, { alignItems: "stretch", gap: 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={confirming ? pulseCopy.confirming : cooldown ? pulseCopy.confirmed : pulseCopy.stillTrue}
          accessibilityState={{ disabled: confirming || cooldown, busy: confirming }} disabled={confirming || cooldown} onPress={() => { void confirm(); }}
          style={{ flex: 1, minHeight: 48, padding: 8, borderRadius: tokens.radius.button, backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center", gap: 4, opacity: cooldown ? tokens.motion.disabledOpacity : 1 }}>
          {confirming && <Svg width={24} height={24}><Circle cx={12} cy={12} r={10} stroke={colors.onAccent} strokeWidth={2} fill="none" opacity={0.25} />
            <AnimatedCircle cx={12} cy={12} r={10} stroke={colors.onAccent} strokeWidth={2} fill="none" strokeDasharray={circumference} animatedProps={ringProps} rotation={-90} origin="12,12" /></Svg>}
          {cooldown && !confirming && <Check size={18} color={colors.onAccent} />}
          <Text style={[styles.body, { color: colors.onAccent, textAlign: "center" }]}>{confirming ? pulseCopy.confirming : cooldown ? pulseCopy.confirmed : pulseCopy.stillTrue}</Text>
        </Pressable>
        <View style={{ flex: 1 }}><Button title={pulseCopy.update} secondary onPress={() => onAdd(lastAnswers)} /></View>
        <View style={{ flex: 1 }}><Button title={pulseCopy.createBeacon} secondary onPress={onCreateBeacon} /></View>
      </View>
      {happeningHere && <View style={{ gap: 8 }}><Text style={styles.h2}>{pulseCopy.happeningHere}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{happeningHere}</ScrollView></View>}
    </>}
    <Toast visible={!!error} message={error} tone="danger" onDismiss={() => setError("")} />
  </View>;
}
