import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import { BeaconParticipation } from "@/src/features/beacons/useBeaconParticipation";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Action, Button, Screen, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { usePlanningResponses } from "../usePlanningResponses";
import {
  planningInbox,
  inboxSections,
  type InboxSection,
} from "@/src/features/planning/inbox";
import { DecisionRow } from "@/src/features/planning/DecisionRow";
import { randomUUID } from "expo-crypto";

const filters = ["All", "Pings", "Decisions", "Invites"] as const;
type Filter = (typeof filters)[number];

export default function ResponsesScreen() {
  const { userId } = useBeacon();
  return <ResponsesContent key={userId ?? "signed-out"} />;
}

function ResponsesContent() {
  const { styles, colors } = useTheme();
  const { data, userId, loading, error, refresh } = useBeacon();
  const now = useNow();
  const { invitations } = usePlanningResponses(now);
  const params = useLocalSearchParams<{ threadId?: string }>();
  const [filter, setFilter] = useState<Filter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = invitations.find((item) => item.id === selectedId);
  const [expandedId, setExpandedId] = useState<string | null>(
    params.threadId ?? null,
  );
  const [sectionOpen, setSectionOpen] = useState<Record<InboxSection, boolean>>(
    {
      "Organizer Actions": true,
      "Needs Response": true,
      "Answered & Active": false,
      History: false,
    },
  );
  const [scrollRequest, setScrollRequest] = useState<{
    y: number;
    sequence: number;
  }>();
  const focusedLink = useRef<string | null>(null);
  const positions = useRef({ list: 0, sections: {} as Record<string, number> });
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [completedInvites, setCompletedInvites] = useState<
    { id: string; title: string }[]
  >([]);
  const decisions = planningInbox(data, userId, now);
  const linkedSection = params.threadId
    ? String(
        decisions.find((item) => item.thread.id === params.threadId)?.section ??
          "",
      )
    : "";
  useFocusEffect(
    useCallback(() => {
      if (params.threadId && linkedSection)
        setSectionOpen((current) => ({ ...current, [linkedSection]: true }));
    }, [params.threadId, linkedSection]),
  );
  const [placement, setPlacement] = useState<{
    viewer: string | null;
    sections: Record<string, InboxSection>;
  }>({ viewer: userId, sections: {} });
  const regroup = useCallback(
    () => setPlacement({ viewer: userId, sections: {} }),
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      regroup();
      focusedLink.current = null;
      if (params.threadId) {
        setExpandedId(params.threadId);
        setFilter("All");
      }
    }, [regroup, params.threadId]),
  );
  const rows = decisions.filter(
    (item) =>
      filter === "All" ||
      filter ===
        (
          {
            ping: "Pings",
            vote: "Decisions",
            draw: "Decisions",
            time: "Decisions",
          } as const
        )[item.thread.kind],
  );
  const showInvites = filter === "All" || filter === "Invites";
  function freezePlacement() {
    setPlacement((current) =>
      current.viewer === userId && Object.keys(current.sections).length
        ? current
        : {
            viewer: userId,
            sections: Object.fromEntries(
              decisions.map((item) => [item.thread.id, item.section]),
            ),
          },
    );
  }
  const sectionFor = (item: (typeof decisions)[number]) =>
    placement.viewer === userId
      ? (placement.sections[item.thread.id] ?? item.section)
      : item.section;
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
    <Screen
      title="Responses & Invitations"
      eyebrow=""
      showDemoNotice={false}
      compactHeader
      scrollRequest={scrollRequest}
      scrollStateKey="responses"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: -8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="+ New"
          accessibilityState={{ expanded: creating }}
          onPress={() => setCreating(!creating)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <View
            style={{
              minHeight: 32,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: colors.surfaceRaised,
              borderRadius: 9,
            }}
          >
            <Plus size={14} color={colors.ink} />
            <Text style={[styles.label, { fontSize: 12 }]}>New</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={refreshing ? "Refreshing" : "Refresh"}
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          onPress={() => {
            setRefreshing(true);
            setRefreshError("");
            void refresh()
              .then(regroup)
              .catch((e: unknown) =>
                setRefreshError(
                  e instanceof Error
                    ? e.message
                    : "Couldn't refresh. Try again.",
                ),
              )
              .finally(() => setRefreshing(false));
          }}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 8,
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} color={colors.muted} />
            <Text style={[styles.label, { fontSize: 12, color: colors.muted }]}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Text>
          </View>
        </Pressable>
      </View>
      {!!refreshError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {refreshError}
        </Text>
      )}
      {creating ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["ping", "vote", "draw", "time"] as const)
            .filter(
              (kind) =>
                kind !== "time" ||
                data.is_demo === true ||
                data.capabilities?.connected_planning === true,
            )
            .map((kind) => (
              <Button
                key={kind}
                compact
                secondary
                title={
                  kind === "time"
                    ? "Find a Time"
                    : kind[0].toUpperCase() + kind.slice(1)
                }
                onPress={() => {
                  setCreating(false);
                  router.push({
                    pathname: "/planning/create",
                    params: { kind, sessionId: randomUUID() },
                  });
                }}
              />
            ))}
        </View>
      ) : null}
      {params.threadId &&
      !loading &&
      !decisions.some((item) => item.thread.id === params.threadId) ? (
        <Txt muted>
          This decision is unavailable or you no longer have access.
        </Txt>
      ) : null}
      {completedInvites.map((item) => (
        <Txt key={item.id}>{item.title} � Updated</Txt>
      ))}
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
                setCompletedInvites((rows) => [
                  ...rows,
                  { id: selected.id, title: selected.title },
                ]);
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
            style={{ flexGrow: 0, marginBottom: -6 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {filters.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value}
                accessibilityState={{ selected: filter === value }}
                aria-selected={filter === value}
                onPress={() => {
                  setFilter(value);
                  regroup();
                }}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <View
                  style={{
                    minHeight: 32,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor:
                      filter === value ? colors.lime : colors.white,
                    borderWidth: 1,
                    borderColor: filter === value ? colors.green : colors.line,
                  }}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        fontSize: 12,
                        color: filter === value ? colors.green : colors.ink,
                      },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {error ? (
            <Action title="Retry loading requests" secondary run={refresh} />
          ) : null}
          {loading && !decisions.length && !invitations.length ? (
            <Txt muted>Loading requests…</Txt>
          ) : (
            <View
              onLayout={(event) => {
                positions.current.list = event.nativeEvent.layout.y;
              }}
            >
              {inboxSections.map((section) => {
                const items = rows.filter(
                  (item) => sectionFor(item) === section,
                );
                if (!items.length) return null;
                return (
                  <View
                    key={section}
                    onLayout={(event) => {
                      positions.current.sections[section] =
                        event.nativeEvent.layout.y;
                    }}
                    style={{
                      gap: 6,
                      marginTop:
                        rows[0] && section === sectionFor(rows[0]) ? 10 : 18,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        section === "History" && sectionOpen[section]
                          ? "Hide history"
                          : section === "Needs Response"
                            ? "Open"
                            : section
                      }
                      accessibilityState={{ expanded: sectionOpen[section] }}
                      aria-expanded={sectionOpen[section]}
                      onPress={() =>
                        setSectionOpen((current) => ({
                          ...current,
                          [section]: !current[section],
                        }))
                      }
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text
                        style={[
                          styles.label,
                          {
                            color: sectionOpen[section]
                              ? colors.ink
                              : colors.muted,
                          },
                        ]}
                      >
                        {section === "Needs Response" ? "Open" : section}
                      </Text>
                      <Text style={[styles.muted, { fontSize: 12 }]}>
                        {items.length}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {sectionOpen[section] ? (
                        <ChevronDown size={16} color={colors.muted} />
                      ) : (
                        <ChevronRight size={16} color={colors.muted} />
                      )}
                    </Pressable>
                    {items.map((item) => (
                      <View
                        key={item.thread.id}
                        style={{
                          display: sectionOpen[section] ? "flex" : "none",
                        }}
                        accessibilityElementsHidden={!sectionOpen[section]}
                        importantForAccessibility={
                          sectionOpen[section] ? "auto" : "no-hide-descendants"
                        }
                        onLayout={(event) => {
                          if (!sectionOpen[section]) return;
                          const rowY = event.nativeEvent.layout.y;
                          if (
                            params.threadId === item.thread.id &&
                            focusedLink.current !== item.thread.id
                          ) {
                            setTimeout(() => {
                              if (focusedLink.current === item.thread.id)
                                return;
                              focusedLink.current = item.thread.id;
                              setScrollRequest({
                                y:
                                  positions.current.list +
                                  (positions.current.sections[section] ?? 0) +
                                  rowY,
                                sequence: Date.now(),
                              });
                            }, 0);
                          }
                        }}
                      >
                        <DecisionRow
                          onBeforeRespond={freezePlacement}
                          item={item}
                          expanded={expandedId === item.thread.id}
                          onExpand={() => {
                            freezePlacement();
                            setExpandedId((current) =>
                              current === item.thread.id
                                ? null
                                : item.thread.id,
                            );
                          }}
                        />
                      </View>
                    ))}
                  </View>
                );
              })}
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
          !error &&
          !refreshError &&
          !rows.length &&
          (!showInvites || (!invitations.length && !answered.length)) ? (
            <SemanticEmpty
              name="empty.responses"
              illustration="complete"
              density="section"
            />
          ) : null}
          <Button
            compact
            secondary
            title="Manage my decisions"
            onPress={() => router.push("/councils")}
          />
        </>
      )}
    </Screen>
  );
}
