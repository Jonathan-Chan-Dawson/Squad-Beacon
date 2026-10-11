import React, { useLayoutEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Txt, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { PulsePlace } from "../types";
import { interestLabels, placeInterests } from "../placeKnowledge";
import { usePlaceKnowledge } from "../usePlaceKnowledge";

/** One place experience: only useful facts render; sharing is an inline disclosure. */
export function PlaceKnowledge({ place, scope, onPing, onNearby }: { place: PulsePlace; scope: string; onPing?: () => void; onNearby?: () => void }) {
  const { styles } = useTheme();
  const now = useNow();
  const { value, error, request, allowed } = usePlaceKnowledge(place, scope);
  const [sharing, setSharing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<string | null>(null);
  const [moreTips, setMoreTips] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: Parameters<typeof request>[0], payload?: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await request(action, payload); if (mounted.current && action === "tip") { setText(""); setSharing(false); } }
    catch { /* The scoped hook exposes a retryable error and retains the draft. */ }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  if (!allowed) return null;
  const tips = value.tips.filter((tip) => now - tip.accurateAt < 90 * 86400000);
  const interest = value.interest.filter((signal) => signal.validUntil > now);
  return <View style={{ gap: 8 }}>
    {interest.map((signal) => <Text key={signal.kind} style={styles.body}>People are looking for {interestLabels[signal.kind]} nearby</Text>)}
    {interest.length > 0 && <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
      {onPing && <Button title="Ping People" secondary onPress={onPing} />}
      {onNearby && <Button title="See Nearby Beacons" secondary onPress={onNearby} />}
    </View>}
    {(moreTips ? tips : tips.slice(0, 1)).map((tip) => <View key={tip.id} style={{ gap: 6 }}>
      <Text style={styles.body}>💡 {tip.text}</Text>
      {tip.helpful > 0 && <Txt muted>{tip.helpful} people found this helpful</Txt>}
      <Txt muted>{Math.max(0, Math.floor((now - tip.accurateAt) / 86400000)) === 0 ? "Checked today" : `Checked ${Math.floor((now - tip.accurateAt) / 86400000)} days ago`}</Txt>
      {!tip.own && <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
        <Button title={tip.helped ? "Helpful ✓" : "Helpful"} secondary disabled={busy || tip.helped} onPress={() => void run("helpful", tip.id)} />
        <Button title={tip.accuracy === "accurate" ? "Accuracy confirmed" : "Still accurate"} secondary disabled={busy || tip.accuracy === "accurate"} onPress={() => void run("accurate", tip.id)} />
        <Button title="Tip options" secondary onPress={() => setOptions(options === tip.id ? null : tip.id)} />
        {options === tip.id && <>
          <Button title={tip.accuracy === "stale" ? "Marked outdated" : "Outdated"} secondary disabled={busy || tip.accuracy === "stale"} onPress={() => void run("stale", tip.id)} />
          <Button title="Report tip" secondary disabled={busy} onPress={() => void run("report", tip.id)} />
        </>}
      </View>}
    </View>)}
    {tips.length > 1 && <Button title={moreTips ? "Fewer place tips" : "More place tips"} secondary onPress={() => setMoreTips(!moreTips)} />}
    {!!error && <><Txt muted>{error}</Txt><Button title="Retry place information" secondary disabled={busy} onPress={() => void run("read")} /></>}
    <Button title={sharing ? "Done sharing" : "Share something useful"} secondary onPress={() => setSharing(!sharing)} />
    {sharing && <View style={{ gap: 8 }}>
      <Field label="Useful place tip" placeholder="What would help someone visiting here?" value={text} onChangeText={setText} maxLength={180} multiline editable={!busy} />
      <Txt muted>Keep it about the place. Avoid personal information.</Txt>
      <Button title="Save tip" disabled={busy || !text.trim()} onPress={() => void run("tip", text.trim())} />
      {placeInterests[place.category].length > 0 && <>
        <Txt muted>Interested in meeting here? This lasts 2 hours. Only grouped interest is visible; this does not share your location.</Txt>
        <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>{placeInterests[place.category].map((kind) => <Button key={kind}
          title={`Interested in ${interestLabels[kind]}`} secondary disabled={busy || value.ownInterest === kind}
          onPress={() => void run("interest", kind)} />)}</View>
        {!!value.ownInterest && <Button title="Remove my interest" secondary disabled={busy} onPress={() => void run("withdraw")} />}
      </>}
    </View>}
  </View>;
}
