import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, Field, Sheet, useTheme } from "@/src/shared/ui";
import { canReactToSoloActivity } from "@/src/features/maps/soloActivity";
import { QUICK_STATUS_REACTIONS, searchStatusReactions } from "../../statusReactions";

export function StatusReactionPicker({ activityId, compact = false }: { activityId: string; compact?: boolean }) {
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const activity = data.activities.find((item) => item.id === activityId);
  const allowed = !!activity && data.viewer_id === userId && canReactToSoloActivity(data, activity, userId, now);
  const selected = data.reactions.find((item) => item.activity_id === activityId && item.user_id === userId)?.emoji;
  const count = data.reactions.filter((item) => item.activity_id === activityId).length;
  const choices = expanded ? searchStatusReactions(query) : QUICK_STATUS_REACTIONS;
  const choose = async (emoji: string) => {
    if (busyRef.current || !allowed) return;
    busyRef.current = true; setBusy(true); setError("");
    try { const result = await act("react_status", { id: activityId, emoji, remove: selected === emoji });
      if (result.event !== "react_status" || result.id !== activityId) throw new Error("This server could not verify your status reaction. Try again after refreshing.");
      setOpen(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not react. Try again."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  if (!allowed && !open) return null;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose status reaction" accessibilityState={{ selected: !!selected, disabled: busy || !allowed }} disabled={busy || !allowed}
      onPress={() => { setExpanded(false); setQuery(""); setError(""); setOpen(true); }}
      style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: compact ? 2 : 10 }}>
      <Text style={{ color: colors.ink }}>{selected || "🙌"} {count || (compact ? "" : "React")}</Text>
    </Pressable>
    <Sheet title="Status reactions" visible={open} onClose={() => { if (!busy) setOpen(false); }}>
      <Text style={styles.muted}>Choose a reaction. Tap your current reaction to remove it.</Text>
      {!allowed ? <Text accessibilityRole="alert" style={styles.muted}>This status is no longer available for reactions.</Text> : null}
      {expanded ? <Field label="Search reactions" value={query} onChangeText={setQuery} editable={!busy} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {choices.map((choice) => <Pressable key={choice.emoji} accessibilityRole="button" accessibilityLabel={choice.name}
          accessibilityState={{ selected: selected === choice.emoji, disabled: busy || !allowed }} disabled={busy || !allowed}
          onPress={() => void choose(choice.emoji)} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: selected === choice.emoji ? 2 : 0, borderColor: colors.green }}>
          <Text style={{ fontSize: 26 }}>{choice.emoji}</Text>
        </Pressable>)}
      </View>
      {expanded && choices.length === 0 ? <Text style={styles.muted}>No matching reactions.</Text> : null}
      {!expanded ? <Action title="More reactions" run={async () => setExpanded(true)} disabled={busy} /> : null}
      {!!error && <Text accessibilityRole="alert" style={styles.muted}>{error}</Text>}
    </Sheet>
  </View>;
}
