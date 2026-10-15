import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { ChatThread } from "@/src/features/messages/ChatThread";
import { BackButton, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ChatIdentityHeader } from "@/src/features/people/previews/ChatIdentityHeader";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { useNow } from "@/src/shared/useNow";
export default function Messages() {
  const { colors, styles } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId } = useBeacon();
  const selection = selectPersonPreview(data, id, userId, useNow());
  const name = selection.canViewFullProfile
    ? (selection.profile?.name ?? "Friend")
    : selection.canMessage
      ? "Friend"
      : "Conversation";
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={[styles.content, { flex: 1, minHeight: 0, gap: 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BackButton />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ChatIdentityHeader
              name={name}
              subtitle={
                selection.availability === "available"
                  ? "Available now"
                  : selection.availability === "ending-soon"
                    ? "Wrapping up soon"
                    : selection.availability === "unavailable"
                      ? "Not available right now"
                      : undefined
              }
              avatar={
                <ProfileAvatar
                  profile={
                    selection.canViewFullProfile ? selection.profile : undefined
                  }
                  size={42}
                />
              }
              accessibilityLabel={
                selection.canMessage
                  ? `View ${name}'s profile`
                  : "Profile preview unavailable"
              }
              onPress={() =>
                router.push({ pathname: "/person/[id]", params: { id } })
              }
            />
          </View>
        </View>
        {selection.canMessage ? (
          <ChatThread key={`${userId}:${id}`} personId={id} />
        ) : (
          <Txt>
            This conversation is unavailable. A current friendship is required
            to send and read messages.
          </Txt>
        )}
      </View>
    </SafeAreaView>
  );
}
