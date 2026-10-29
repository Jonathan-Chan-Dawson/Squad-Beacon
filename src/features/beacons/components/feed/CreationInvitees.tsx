import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useReducedMotion } from "@/src/shared/design-system";
import { socialFriends } from "../../socialFriends";
import { UserRoundPlus } from "lucide-react-native";
import { SocialSelector } from "@/src/features/people/components/SocialSelector";
import { DialogPortal } from "@/src/shared/DialogPortal";
import { useOverlayPresence, useTopOverlay } from "@/src/shared/overlays";
import {
  focusOverlay,
  useOverlayKeyboardFocus,
} from "@/src/shared/overlayFocus";

export function CreationInvitees({
  ids,
  onChange,
  allowedIds,
}: {
  ids: string[];
  allowedIds?: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const overlayId = useId();
  const dialogRef = useRef<View>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useOverlayPresence(overlayId, open, "Add People");
  const top = useTopOverlay(overlayId);
  const closePicker = useCallback(() => setOpen(false), []);
  const focus = useCallback(() => focusOverlay(dialogRef, "Cancel"), []);
  useOverlayKeyboardFocus(dialogRef, open && top, closePicker, focus);
  const openPicker = () => {
    if (Platform.OS === "web" && typeof document !== "undefined")
      returnFocus.current = document.activeElement as HTMLElement;
    setDraftIds([...ids]);
    setOpen(true);
  };

  const friends = useMemo(
    () =>
      socialFriends(data, userId, now).filter(
        (friend) => !allowedIds || allowedIds.includes(friend.id),
      ),
    [data, userId, now, allowedIds],
  );
  const unavailable = (open ? draftIds : ids).filter(
    (id) => !friends.some((friend) => friend.id === id),
  );
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {!ids.length ? (
            <Text style={[styles.muted, { fontSize: 12 }]}>
              No invitations yet
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {ids.slice(0, 3).map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${friends.find((friend) => friend.id === id)?.name ?? "unavailable friend"}`}
                onPress={() => onChange(ids.filter((value) => value !== id))}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ProfileAvatar
                  profile={data.profiles.find((person) => person.id === id)}
                  size={30}
                />
                <Text
                  accessible={false}
                  style={[
                    styles.muted,
                    { position: "absolute", right: 0, top: 0 },
                  ]}
                >
                  ×
                </Text>
              </Pressable>
            ))}
            {ids.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Review all ${ids.length} invited people`}
                onPress={openPicker}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <Txt>+{ids.length - 3}</Txt>
              </Pressable>
            ) : null}
          </View>
          {ids.length ? (
            <Text style={[styles.muted, { fontSize: 12 }]}>
              {ids.length} selected
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"+ Add People"}
          onPress={openPicker}
          style={{
            minHeight: 44,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 12,
            justifyContent: "center",
            backgroundColor: colors.bg,
          }}
        >
          <UserRoundPlus size={16} color={colors.ink} />
          <Text style={[styles.body, { fontSize: 13, fontWeight: "500" }]}>
            Add People
          </Text>
        </Pressable>
      </View>
      {unavailable.length ? (
        <Txt>
          {unavailable.length} selected friend(s) are no longer eligible. Review
          or remove them before publishing.
        </Txt>
      ) : null}
      <DialogPortal
        visible={open}
        presentationStyle="fullScreen"
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setOpen(false)}
        onShow={focus}
        onDismiss={() =>
          requestAnimationFrame(() => {
            if (returnFocus.current?.isConnected)
              returnFocus.current.focus({ preventScroll: true });
            returnFocus.current = null;
          })
        }
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
              >
                <View
                  ref={dialogRef}
                  aria-hidden={!top}
                  pointerEvents={top ? "auto" : "none"}
                  accessibilityViewIsModal
                  role="dialog"
                  aria-modal
                  accessibilityLabel="Add People"
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderColor: colors.line,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Button
                      compact
                      secondary
                      title="Cancel"
                      onPress={() => setOpen(false)}
                    />
                    <Text
                      accessibilityRole="header"
                      style={[styles.h2, { flex: 1 }]}
                    >
                      Add People
                    </Text>
                    <Button
                      compact
                      title="Done"
                      onPress={() => {
                        onChange(draftIds);
                        setOpen(false);
                      }}
                    />
                  </View>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                      padding: 16,
                      gap: 12,
                      width: "100%",
                      maxWidth: 720,
                      alignSelf: "center",
                    }}
                  >
                    <Txt muted>
                      {draftIds.length} selected · Invitations send when you
                      publish. We recommend 50 or fewer; larger selections can
                      be reviewed before publishing.
                    </Txt>
                    <Button
                      compact
                      secondary
                      title="Clear selection"
                      onPress={() => setDraftIds([])}
                    />

                    {unavailable.map((id) => (
                      <Button
                        key={id}
                        compact
                        secondary
                        title="Remove unavailable friend"
                        onPress={() =>
                          setDraftIds(draftIds.filter((value) => value !== id))
                        }
                      />
                    ))}
                    <SocialSelector
                      groupBehavior="filterFriends"
                      friends={friends}
                      selected={draftIds.map((id) => ({ kind: "friend", id }))}
                      onChange={(rows) => {
                        const ids = rows
                          .filter((row) => row.kind === "friend")
                          .map((row) => row.id);
                        setDraftIds(ids);
                      }}
                      supportedKinds={["friend"]}
                      bulk
                    />
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </DialogPortal>
    </View>
  );
}
