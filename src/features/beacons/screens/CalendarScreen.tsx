import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import { ActivityFrame } from "@/src/features/activity/ActivityFrame";
import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import { useRoutineCalendar } from "../useRoutineCalendar";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Radio,
  Route,
  Repeat2,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { localDate } from "@/src/shared/domain";
import { addLocalDays, isLocalDate } from "@/src/features/plans/routines";
import {
  Action,
  Button,
  IconButton,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import {
  calendarMonthDates,
  calendarScheduleStart,
  calendarTimezone,
  calendarWeekDates,
  selectCalendarItems,
  selectCalendarWeekItems,
  type CalendarItem,
} from "../calendarSelectors";

export default function CalendarScreen() {
  const { data, userId, loading } = useBeacon();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { styles, semanticColors: colors, tokens } = useTheme();
  const now = useNow();
  const timezone = calendarTimezone(
    data,
    userId,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const today = localDate(new Date(now), timezone);
  const [selectedDate, setSelectedDate] = useState(
    typeof date === "string" && isLocalDate(date) ? date : today,
  );
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const [lastRouteDate, setLastRouteDate] = useState(date);
  if (lastRouteDate !== date) {
    setLastRouteDate(date);
    if (typeof date === "string" && isLocalDate(date)) {
      setSelectedDate(date);
      setMonth(date.slice(0, 7));
    }
  }
  const [monthOpen, setMonthOpen] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [projected, setProjected] = useState<CalendarItem | null>(null);
  const { act } = useBeacon();
  const projectionRange = useMemo(() => {
    if (monthOpen) {
      const { first, last } = calendarMonthDates(month);
      return { startOn: first, endOn: last };
    }
    const dates = calendarWeekDates(selectedDate);
    return { startOn: dates[0], endOn: dates[6] };
  }, [monthOpen, month, selectedDate]);
  const routineCalendar = useRoutineCalendar(projectionRange);
  const items = useMemo(
    () =>
      monthOpen
        ? selectCalendarItems(
            data,
            userId,
            month,
            timezone,
            now,
            routineCalendar.rows,
          )
        : selectCalendarWeekItems(
            data,
            userId,
            selectedDate,
            timezone,
            now,
            routineCalendar.rows,
          ),
    [
      data,
      userId,
      month,
      timezone,
      now,
      monthOpen,
      selectedDate,
      routineCalendar.rows,
    ],
  );
  const monthDates = calendarMonthDates(month);
  const agenda = items.filter((item) => item.date === selectedDate);
  const heading = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  const selectDay = (value: string) => {
    setSelectedDate(value);
    setMonth(value.slice(0, 7));
    setScheduleOpen(false);
    setScheduleError("");
  };
  const changeMonth = (delta: number) => {
    if (!monthOpen) {
      selectDay(addLocalDays(selectedDate, delta * 7));
      return;
    }
    const value = new Date(`${month}-01T00:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + delta);
    const nextMonth = value.toISOString().slice(0, 7),
      range = calendarMonthDates(nextMonth);
    selectDay(
      `${nextMonth}-${String(Math.min(Number(selectedDate.slice(8)), range.days.length)).padStart(2, "0")}`,
    );
  };
  const openItem = (item: CalendarItem) => {
    if (item.kind === "routine") {
      setProjected(item);
      return;
    }
    if (item.activities?.length) {
      setExpanded(expanded === item.key ? null : item.key);
      return;
    }
    router.push(
      item.kind === "beacon"
        ? { pathname: "/activity/[id]", params: { id: item.id } }
        : { pathname: "/plan/[id]", params: { id: item.id } },
    );
  };
  const dotColors = {
    beacon: colors.accent,
    plan: tokens.categories.Study.color,
    routine: tokens.categories.Creative.color,
  };
  const renderDate = (value: string | null, index: number) => {
    if (!value)
      return (
        <View
          key={`empty:${index}`}
          style={{ width: `${100 / 7}%`, minHeight: 44 }}
        />
      );
    const rows = items.filter((item) => item.date === value),
      kinds = [...new Set(rows.map((item) => item.kind))];
    return (
      <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityLabel={`${heading(value)}${value === today ? ", today" : ""}, ${rows.length} calendar items`}
        accessibilityState={{ selected: value === selectedDate }}
        onPress={() => selectDay(value)}
        style={{
          width: `${100 / 7}%`,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          borderRadius: tokens.radius.button,
          backgroundColor:
            value === selectedDate ? colors.surfaceRaised : "transparent",
          borderWidth: 1,
          borderColor: value === selectedDate ? colors.accent : "transparent",
        }}
      >
        <Text
          style={{
            color: value === today ? colors.accent : colors.textPrimary,
            ...tokens.type.secondary,
            fontWeight:
              value === today || value === selectedDate ? "700" : "400",
          }}
        >
          {Number(value.slice(8))}
        </Text>
        <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
          {kinds.map((kind) => (
            <View
              key={kind}
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: dotColors[kind],
              }}
            />
          ))}
        </View>
      </Pressable>
    );
  };
  const visibleDates: (string | null)[] = monthOpen
    ? [
        ...Array.from({ length: monthDates.leading }, () => null),
        ...monthDates.days,
      ]
    : calendarWeekDates(selectedDate);
  return (
    <ActivityFrame
      title="Your Calendar"
      eyebrow="MAKE TIME TOGETHER"
      create={false}
    >
      <Txt muted>Times shown in {timezone}</Txt>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <IconButton
          label={monthOpen ? "Previous month" : "Previous week"}
          onPress={() => changeMonth(-1)}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </IconButton>
        <Text style={styles.h2}>
          {new Date(`${month}-01T12:00:00`).toLocaleDateString([], {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <IconButton
          label={monthOpen ? "Next month" : "Next week"}
          onPress={() => changeMonth(1)}
        >
          <ChevronRight size={22} color={colors.textPrimary} />
        </IconButton>
      </View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Button
          compact
          secondary
          title="Today"
          onPress={() => selectDay(today)}
        />
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <Button
            compact
            secondary={!monthOpen}
            title="Month"
            onPress={() => setMonthOpen(true)}
          />
          <Button
            compact
            secondary={monthOpen}
            title="Week"
            onPress={() => setMonthOpen(false)}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <Text
            key={day}
            style={{
              width: `${100 / 7}%`,
              textAlign: "center",
              color: colors.textSecondary,
              ...tokens.type.caption,
            }}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {visibleDates.map(renderDate)}
      </View>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {(["beacon", "plan", "routine"] as const).map((kind) => (
          <View
            key={kind}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: dotColors[kind],
              }}
            />
            <Txt muted>
              {kind === "beacon"
                ? "Your Beacons"
                : kind === "plan"
                  ? "Plan schedule"
                  : "Projected Routine"}
            </Txt>
          </View>
        ))}
      </View>
      {routineCalendar.loading ? (
        <Txt muted>Loading Routine dates...</Txt>
      ) : null}
      {routineCalendar.error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {routineCalendar.error}
          </Text>
          <Button
            compact
            secondary
            title="Retry Routine dates"
            onPress={routineCalendar.retry}
          />
        </View>
      ) : null}
      {routineCalendar.truncated ? (
        <Txt muted>
          Showing the first 500 Routine occurrences. Switch to week view for a
          smaller range.
        </Txt>
      ) : null}
      <View style={{ gap: tokens.space.sm }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text accessibilityRole="header" style={[styles.h2, { flex: 1 }]}>
            {heading(selectedDate)}
          </Text>
          {selectedDate >= today ? (
            <Button
              compact
              title="+ Schedule"
              onPress={() => {
                setScheduleError("");
                setScheduleOpen(true);
              }}
            />
          ) : null}
        </View>
        {!agenda.length && !routineCalendar.error ? (
          loading || routineCalendar.loading ? (
            <Txt muted>Loading your calendar…</Txt>
          ) : selectedDate < today ? (
            <Txt muted>No activity history on this day.</Txt>
          ) : (
            <SemanticEmpty name="empty.calendar" density="inline" />
          )
        ) : null}
        {agenda.map((item) => {
          const KindIcon =
            item.kind === "beacon"
              ? Radio
              : item.kind === "plan"
                ? Route
                : Repeat2;
          const time = item.startsAt
            ? new Date(item.startsAt).toLocaleTimeString([], {
                timeZone: timezone,
                hour: "numeric",
                minute: "2-digit",
              })
            : "";
          const isExpanded = expanded === item.key;
          const hasItinerary = !!item.activities?.length;
          return (
            <View key={item.key} style={{ gap: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${time ? time + ", " : ""}${item.label}${hasItinerary ? `, ${item.activities!.length} Beacons` : ""}`}
                accessibilityState={
                  hasItinerary ? { expanded: isExpanded } : undefined
                }
                onPress={() => openItem(item)}
                style={{
                  minHeight: 64,
                  padding: 12,
                  borderRadius: tokens.radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: item.tentative ? "dashed" : "solid",
                  backgroundColor: item.tentative ? colors.bg : colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <KindIcon size={17} color={dotColors[item.kind]} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      ...tokens.type.secondary,
                      fontWeight: "700",
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      ...tokens.type.caption,
                    }}
                  >
                    {time ? `${time} · ` : ""}
                    {item.label}
                  </Text>
                  {hasItinerary && (
                    <Text
                      style={{ color: colors.accent, ...tokens.type.caption }}
                    >
                      {item.activities!.length} Beacons ·{" "}
                      {isExpanded ? "Hide itinerary" : "View itinerary"}
                    </Text>
                  )}
                </View>
                {isExpanded && hasItinerary ? (
                  <ChevronDown size={17} color={colors.textSecondary} />
                ) : (
                  <ChevronRight size={17} color={colors.textSecondary} />
                )}
              </Pressable>
              {isExpanded && item.activities && (
                <View
                  testID="calendar-itinerary"
                  style={{
                    marginLeft: 16,
                    paddingLeft: 12,
                    borderLeftWidth: 2,
                    borderLeftColor: colors.border,
                    gap: 2,
                  }}
                >
                  {item.activities.map((activity) => (
                    <Pressable
                      key={activity.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open Beacon: ${activity.title}`}
                      onPress={() =>
                        router.push({
                          pathname: "/activity/[id]",
                          params: { id: activity.id },
                        })
                      }
                      style={{
                        minHeight: 44,
                        paddingVertical: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          width: 70,
                          color: colors.textSecondary,
                          ...tokens.type.caption,
                        }}
                      >
                        {new Date(activity.startsAt).toLocaleTimeString([], {
                          timeZone: timezone,
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          minWidth: 0,
                          color: colors.textPrimary,
                          ...tokens.type.secondary,
                        }}
                      >
                        {activity.title}
                      </Text>
                      <ChevronRight size={15} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open Plan"
                    onPress={() =>
                      router.push({
                        pathname: "/plan/[id]",
                        params: { id: item.id },
                      })
                    }
                    style={{
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Route size={15} color={colors.accent} />
                    <Text
                      style={{
                        color: colors.accent,
                        ...tokens.type.caption,
                        fontWeight: "700",
                      }}
                    >
                      Open Plan
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Aspirations in Profile"
        onPress={() => router.push("/(tabs)/profile")}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>
          Aspirations in Profile →
        </Text>
      </Pressable>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Button
          compact
          secondary
          title="Routines"
          onPress={() => router.push("/routines")}
        />
      </View>
      <Txt muted>Routine dates use each Routine’s timezone.</Txt>
      <Sheet
        title={projected?.title ?? "Projected repeat"}
        visible={!!projected}
        onClose={() => setProjected(null)}
      >
        <Txt>{projected?.date} · Projected repeat</Txt>
        <Txt muted>
          This is a preview. Its Beacons and attendance do not exist yet.
        </Txt>
        <Button
          title="Future repeats"
          onPress={() => {
            const item = projected;
            setProjected(null);
            if (item)
              router.push({
                pathname: "/routines",
                params: { planId: item.id },
              });
          }}
        />
        {projected &&
          data.plan_routines.some(
            (r) =>
              r.id === projected.routineId &&
              r.next_occurrence_on === projected.date,
          ) && (
            <Action
              secondary
              title="Skip this next repeat"
              run={async () => {
                await act("skip_routine_next", {
                  id: projected.routineId,
                  expected_occurrence_on: projected.date,
                });
                setProjected(null);
              }}
            />
          )}
      </Sheet>
      <Sheet
        title={`Schedule · ${heading(selectedDate)}`}
        visible={scheduleOpen && selectedDate >= today}
        onClose={() => setScheduleOpen(false)}
      >
        {scheduleError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {scheduleError}
          </Text>
        ) : null}
        <PlanChoice
          title="Beacon"
          icon={Radio}
          detail="One scheduled activity"
          onPress={() => {
            setScheduleError("");
            try {
              const startsAt = calendarScheduleStart(
                selectedDate,
                Date.now(),
                timezone,
              );
              setScheduleOpen(false);
              router.push({
                pathname: "/create",
                params: { startsAt, timezone },
              });
            } catch (failure) {
              setScheduleError(
                failure instanceof Error
                  ? failure.message
                  : "Choose another date.",
              );
            }
          }}
        />
        <PlanChoice
          title="Plan"
          icon={Route}
          detail="Start a tentative itinerary"
          onPress={() => {
            setScheduleOpen(false);
            router.push({
              pathname: "/plans",
              params: { create: "yes", startDate: selectedDate, timezone },
            });
          }}
        />
        <PlanChoice
          title="Routine"
          icon={Repeat2}
          detail="Make time for a regular favorite"
          onPress={() => {
            setScheduleOpen(false);
            router.push({
              pathname: "/plans",
              params: {
                create: "yes",
                routine: "yes",
                startDate: selectedDate,
                timezone,
              },
            });
          }}
        />
      </Sheet>
    </ActivityFrame>
  );
}
