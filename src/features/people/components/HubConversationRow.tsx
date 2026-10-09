import React, { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CalendarClock, Star } from "lucide-react-native";
import type { HubConversation } from "../hubState";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { Button, useTheme } from "@/src/shared/ui";

export function HubConversationRow({ chat, onProfile, onOpen, onFavorite, onGestureActive }: {
  chat: HubConversation; onProfile: () => void; onOpen: () => void;
  onFavorite: () => Promise<void>; onGestureActive: (active: boolean) => void;
}) {
  const { colors, styles } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const terminalGesture = useMemo(() => Gesture.Pan().activeOffsetX([-12, 12]).failOffsetY([-16, 16]).runOnJS(true)
    .onStart(() => onGestureActive(true)).onFinalize(() => onGestureActive(false)), [onGestureActive]);
  async function favorite() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await onFavorite(); ref.current?.close(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't update this favorite."); }
    finally { lock.current = false; setBusy(false); onGestureActive(false); }
  }
  const date = Date.parse(chat.latest);
  const today = Number.isFinite(date) && new Date(date).toDateString() === new Date().toDateString();
  const timestamp = Number.isFinite(date) ? today ? new Date(date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  return <View>
    <GestureDetector gesture={terminalGesture}>
    <Swipeable ref={ref} simultaneousWithExternalGesture={terminalGesture} overshootRight={false} friction={2} rightThreshold={50}
      onSwipeableOpen={() => onGestureActive(false)}
      onSwipeableOpenStartDrag={() => onGestureActive(true)} onSwipeableClose={() => onGestureActive(false)}
      onSwipeableCloseStartDrag={() => onGestureActive(true)}
      renderRightActions={() => <View style={{ width: 94, padding: 6, justifyContent: "center", backgroundColor: colors.lime }}>
        <Button compact title={busy ? "Saving…" : chat.starred ? "Unstar" : "Star"} disabled={busy} onPress={() => { void favorite(); }} />
      </View>}>
      <View style={{ height: 72, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${chat.kind === "squad" ? "squad profile" : "profile"} avatar ${chat.name}`}
          onPress={onProfile} style={{ width: 52, height: 52, justifyContent: "center", alignItems: "center" }}>
          {chat.kind === "squad" ? <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.lime, justifyContent: "center", alignItems: "center" }}>
            <Text style={[styles.h2, { color: colors.green }]}>{chat.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</Text>
          </View> : <ProfileAvatar profile={chat.profile} size={52} />}
          {chat.starred ? <View pointerEvents="none" style={{ position: "absolute", right: -2, bottom: -2, backgroundColor: colors.lime, borderRadius: 10, padding: 3, borderWidth: 2, borderColor: colors.white }}>
            <Star size={11} color={colors.green} fill={colors.green} />
          </View> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Message ${chat.name}`}
          accessibilityActions={[{ name: "favorite", label: chat.starred ? "Unstar conversation" : "Star conversation" }]}
          onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "favorite") void favorite(); }}
          onLongPress={() => { void favorite(); }} onPress={onOpen} style={{ flex: 1, minHeight: 60, justifyContent: "center", gap: 5, paddingRight: 4 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Text numberOfLines={1} style={[styles.body, { flex: 1, fontWeight: chat.unread > 0 ? "800" : "600" }]}>{chat.name}</Text>
            {timestamp ? <Text style={[styles.label, { color: chat.unread > 0 ? colors.green : colors.muted }]}>{timestamp}</Text> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {chat.pingId ? <CalendarClock size={14} color={colors.green} accessibilityLabel="Latest item is a Ping" /> : null}
            <Text numberOfLines={1} style={[styles.muted, { flex: 1, fontWeight: chat.unread > 0 ? "600" : "400" }]}>{chat.preview}</Text>
            {chat.unread > 0 ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" }}>
              <Text accessibilityLabel={`${chat.unread} unread messages`} style={[styles.label, { color: colors.white }]}>{chat.unread}</Text>
            </View> : null}
          </View>
        </Pressable>
      </View>
    </Swipeable>
    </GestureDetector>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
