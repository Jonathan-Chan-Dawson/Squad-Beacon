import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  Text,
  Modal,
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

export function CreationInvitees({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
  const unavailable = ids.filter(
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
                onPress={() => setOpen(true)}
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
              {ids.length}/20 selected
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"+ Add People"}
          onPress={() => setOpen(true)}
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
          <UserRoundPlus accessible={false} size={16} color={colors.ink} />
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
      <Modal
        visible={open}
        presentationStyle="fullScreen"
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
              >
                <View
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
                      title="Back"
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
                      onPress={() => setOpen(false)}
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
                      {ids.length}/20 selected · Invitations send when you
                      publish.
                    </Txt>
                    <Button
                      compact
                      secondary
                      title="Clear selection"
                      onPress={() => onChange([])}
                    />
                    {selectionError ? <Txt>{selectionError}</Txt> : null}
                    {unavailable.map((id) => (
                      <Button
                        key={id}
                        compact
                        secondary
                        title="Remove unavailable friend"
                        onPress={() =>
                          onChange(ids.filter((value) => value !== id))
                        }
                      />
                    ))}
                    {ids.length > 0 && (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 4,
                        }}
                      >
                        {ids.map((id) => (
                          <Button
                            key={id}
                            compact
                            secondary
                            title={`Remove ${friends.find((friend) => friend.id === id)?.name ?? "unavailable friend"}`}
                            onPress={() =>
                              onChange(ids.filter((value) => value !== id))
                            }
                          />
                        ))}
                      </View>
                    )}
                    <SocialSelector
                      friends={friends}
                      selected={ids.map((id) => ({ kind: "friend", id }))}
                      onChange={(rows) => {
                        const ids = rows
                          .filter((row) => row.kind === "friend")
                          .map((row) => row.id);
                        if (ids.length > 20) {
                          setSelectionError(
                            "Choose up to 20 friends for this invitation batch.",
                          );
                          return;
                        }
                        setSelectionError("");
                        onChange(ids);
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
      </Modal>
    </View>
  );
}
