import React from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/store";
import { friendIds } from "@/src/domain";
import { ChatThread } from "@/src/ChatThread";
import { BackButton, Txt, useTheme } from "@/src/ui";
export default function Messages() {
  const { colors, styles } = useTheme();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId } = useBeacon();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={[styles.content, { flex: 1 }]}>
          <BackButton />
          <Text style={styles.h2}>
            {data.profiles.find((p) => p.id === id)?.name ?? "Conversation"}
          </Text>
          {friendIds(data, userId!).includes(id) ? (
            <ChatThread personId={id} />
          ) : (
            <Txt>Connect as friends to send and read messages.</Txt>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
