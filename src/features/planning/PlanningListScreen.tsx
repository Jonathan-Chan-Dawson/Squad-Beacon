import { randomUUID } from "expo-crypto";
import React from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Empty, Screen, useTheme } from "@/src/shared/ui";
import { planningInbox, planningDestination } from "./inbox";

export default function PlanningListScreen() {
  const { data, userId } = useBeacon();
  const now = useNow();
  const { styles, colors } = useTheme();
  const items = planningInbox(data, userId, now).filter(
    (item) =>
      item.manages ||
      item.thread.status !== "open" ||
      data.planning_proposals.some(
        (row) => row.thread_id === item.thread.id && row.author_id === userId,
      ),
  );
  return (
    <Screen title="Planning management" eyebrow="" showDemoNotice={false}>
      <Button
        compact
        secondary
        title="Responses & Invitations"
        onPress={() => router.push("/responses")}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["ping", "vote", "draw"] as const).map((kind) => (
          <Button
            key={kind}
            compact
            secondary
            title={`New ${kind}`}
            onPress={() =>
              router.push({
                pathname: "/planning/create",
                params: { kind, sessionId: randomUUID() },
              })
            }
          />
        ))}
      </View>
      {!items.length ? (
        <Empty
          title="No decisions to manage"
          body="Respond to decisions in Responses & Invitations, or create one for your group."
        />
      ) : (
        items.map((item) => (
          <View
            key={item.thread.id}
            style={{
              gap: 8,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Text style={styles.h2}>{item.thread.title}</Text>
            <Text style={styles.muted}>
              {item.thread.kind} � {item.thread.status.replaceAll("_", " ")}
              {item.actionable ? " � Organizer action needed" : ""}
            </Text>
            <Button
              compact
              secondary
              title={item.manages ? "Manage decision" : "View decision"}
              onPress={() =>
                router.push(planningDestination(item.thread.id, "manage"))
              }
            />
          </View>
        ))
      )}
    </Screen>
  );
}
