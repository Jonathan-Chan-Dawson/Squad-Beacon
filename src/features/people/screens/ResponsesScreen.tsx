import { BeaconParticipation } from "@/src/features/beacons/useBeaconParticipation";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Dices,
  Vote,
} from "lucide-react-native";
import { router } from "expo-router";
import { Action, Button, Empty, Screen, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { usePlanningResponses } from "../usePlanningResponses";

const filters = ["All", "Pings", "Votes", "Draws", "Invites"] as const;
type Filter = (typeof filters)[number];

export default function ResponsesScreen() {
  const { styles, colors } = useTheme();
  const { data, userId, loading, error, refresh } = useBeacon();
  const now = useNow();
  const { cards, invitations } = usePlanningResponses(now);
  const [filter, setFilter] = useState<Filter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = invitations.find((item) => item.id === selectedId);
  const rows = cards.filter(
    (item) =>
      filter === "All" ||
      filter ===
        ({ ping: "Pings", vote: "Votes", draw: "Draws" } as const)[item.kind],
  );
  const showInvites = filter === "All" || filter === "Invites";
  const answered =
    data.viewer_id === userId && userId
      ? data.activities
          .filter(
            (activity) =>
              activity.mode !== "solo" &&
              activity.status === "scheduled" &&
              Date.parse(activity.ends_at) > now &&
              canReadBeaconActivity(data, activity, userId) &&
              data.rsvps.some(
                (row) =>
                  row.activity_id === activity.id &&
                  row.user_id === userId &&
                  ["interested", "declined"].includes(row.status),
              ),
          )
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      : [];
  const selectedBeaconId =
    selected?.id.startsWith("beacon:") && selected.title === "Beacon invitation"
      ? selected.id.split(":")[1]
      : null;
  function row(
    id: string,
    title: string,
    source: string | undefined,
    status: string,
    Icon: typeof Bell,
    open: () => void,
  ) {
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        onPress={open}
        style={({ pressed }) => ({
          minHeight: 76,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon size={20} color={colors.green} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={2} style={[styles.body, { fontWeight: "700" }]}>
            {title}
          </Text>
          {source ? (
            <Text numberOfLines={1} style={styles.muted}>
              {source}
            </Text>
          ) : null}
          <Text style={styles.label}>{status}</Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
    );
  }
  return (
    <Screen title="Responses & Invitations" eyebrow="" showDemoNotice={false}>
      {selected ? (
        <View style={{ gap: 12 }}>
          <Button
            title="Back to requests"
            secondary
            onPress={() => setSelectedId(null)}
          />
          <Text style={styles.h2}>{selected.title}</Text>
          {selected.sourceLabel ? (
            <Txt muted>{selected.sourceLabel}</Txt>
          ) : null}
          {selectedBeaconId ? (
            <BeaconParticipation
              activityId={selectedBeaconId}
              stretch
              onOpen={() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: selectedBeaconId },
                })
              }
            />
          ) : null}
          {selected.actions.map((action) => (
            <Action
              key={action.id}
              title={action.label}
              disabled={selected.pending || action.disabled}
              run={async () => {
                if ((await action.onPress()) === false)
                  throw new Error("Invitation was not updated.");
                setSelectedId(null);
              }}
            />
          ))}
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {filters.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value}
                accessibilityState={{ selected: filter === value }}
                aria-selected={filter === value}
                onPress={() => setFilter(value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  borderRadius: 22,
                  backgroundColor:
                    filter === value ? colors.lime : colors.white,
                  borderWidth: 1,
                  borderColor: filter === value ? colors.green : colors.line,
                }}
              >
                <Text
                  style={[
                    styles.label,
                    { color: filter === value ? colors.green : colors.ink },
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {error ? (
            <Action title="Retry loading requests" secondary run={refresh} />
          ) : null}
          {loading && !cards.length && !invitations.length ? (
            <Txt muted>Loading requests…</Txt>
          ) : (
            <View>
              {rows.map((item) =>
                row(
                  item.id,
                  item.title,
                  item.sourceLabel,
                  item.disabled || Date.parse(item.deadline ?? "") <= now
                    ? "Closed · awaiting organizer"
                    : item.deadline
                      ? `Respond by ${new Date(item.deadline).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                      : "Awaiting response",
                  item.kind === "ping"
                    ? CircleHelp
                    : item.kind === "vote"
                      ? Vote
                      : Dices,
                  () => item.onOpen?.(),
                ),
              )}
              {showInvites
                ? invitations.map((item) =>
                    row(
                      item.id,
                      item.title,
                      item.sourceLabel,
                      "Awaiting response",
                      Bell,
                      () => setSelectedId(item.id),
                    ),
                  )
                : null}
            </View>
          )}
          {showInvites && answered.length ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Text style={styles.h2}>Your Beacon responses</Text>
              {answered.map((activity) => (
                <View key={activity.id} style={[styles.card, { gap: 6 }]}>
                  <Text style={styles.body}>{activity.title}</Text>
                  <BeaconParticipation
                    activityId={activity.id}
                    onOpen={() =>
                      router.push({
                        pathname: "/activity/[id]",
                        params: { id: activity.id },
                      })
                    }
                  />
                  <Button
                    compact
                    secondary
                    title="Open Beacon"
                    onPress={() =>
                      router.push({
                        pathname: "/activity/[id]",
                        params: { id: activity.id },
                      })
                    }
                  />
                </View>
              ))}
            </View>
          ) : null}
          {!loading &&
          !rows.length &&
          (!showInvites || (!invitations.length && !answered.length)) ? (
            <Empty
              title="You're all caught up"
              body="New responses and invitations will appear here."
            />
          ) : null}
          <Button
            compact
            secondary
            title="Decision history"
            onPress={() => router.push("/councils")}
          />
        </>
      )}
    </Screen>
  );
}
