import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import { useRoutineCalendar } from "../useRoutineCalendar";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { localDate } from "@/src/shared/domain";
import { isLocalDate } from "@/src/features/plans/routines";
import { Action, Button, IconButton, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { PastWeeklyProgressView } from "@/src/features/beacons/components/feed/PastPanels";
import { calendarMonthDates, calendarScheduleStart, calendarTimezone, calendarWeekDates, calendarWeeklyProgress, selectCalendarItems, selectCalendarWeekItems, type CalendarItem } from "../calendarSelectors";

export default function CalendarScreen() {
  const { data, userId, loading } = useBeacon();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { styles, semanticColors: colors, tokens } = useTheme();
  const now = useNow();
  const timezone = calendarTimezone(data, userId, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const today = localDate(new Date(now), timezone);
  const [selectedDate, setSelectedDate] = useState(typeof date === "string" && isLocalDate(date) ? date : today);
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const [monthOpen, setMonthOpen] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [expanded,setExpanded]=useState<string|null>(null);
  const [projected,setProjected]=useState<CalendarItem|null>(null);
  const {act}=useBeacon();
  const projectionRange=useMemo(()=>{
    if (monthOpen) { const {first,last}=calendarMonthDates(month); return {startOn:first,endOn:last}; }
    const dates=calendarWeekDates(selectedDate); return {startOn:dates[0],endOn:dates[6]};
  },[monthOpen,month,selectedDate]);
  const routineCalendar=useRoutineCalendar(projectionRange);
  const items = useMemo(() => monthOpen ? selectCalendarItems(data, userId, month, timezone, now, routineCalendar.rows) : selectCalendarWeekItems(data, userId, selectedDate, timezone, now, routineCalendar.rows), [data, userId, month, timezone, now, monthOpen, selectedDate, routineCalendar.rows]);
  const progress = useMemo(() => calendarWeeklyProgress(data, userId, timezone, now), [data, userId, timezone, now]);
  const monthDates = calendarMonthDates(month);
  const agenda = items.filter((item) => item.date === selectedDate);
  const heading = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const selectDay = (value: string) => { setSelectedDate(value); setMonth(value.slice(0, 7)); setScheduleOpen(false); setScheduleError(""); };
  const changeMonth = (delta: number) => {
    const value = new Date(`${month}-01T00:00:00Z`); value.setUTCMonth(value.getUTCMonth() + delta);
    const nextMonth = value.toISOString().slice(0, 7), range = calendarMonthDates(nextMonth);
    selectDay(`${nextMonth}-${String(Math.min(Number(selectedDate.slice(8)), range.days.length)).padStart(2, "0")}`);
  };
  const openItem = (item: CalendarItem) => {
    if(item.kind==="routine"){setProjected(item);return;}
    if(item.activities?.length){setExpanded(expanded===item.key?null:item.key);return;}
    router.push(item.kind==="beacon"?{pathname:"/activity/[id]",params:{id:item.id}}:{pathname:"/plan/[id]",params:{id:item.id}});
  };
  const dotColors = { beacon: colors.accent, plan: tokens.categories.Study.color, routine: tokens.categories.Creative.color };
  const renderDate = (value: string | null, index: number) => {
    if (!value) return <View key={`empty:${index}`} style={{ width: `${100 / 7}%`, minHeight: 52 }} />;
    const rows = items.filter((item) => item.date === value), kinds = [...new Set(rows.map((item) => item.kind))];
    return <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${heading(value)}${value === today ? ", today" : ""}, ${rows.length} calendar items`}
      accessibilityState={{ selected: value === selectedDate }} onPress={() => selectDay(value)}
      style={{ width: `${100 / 7}%`, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: tokens.radius.button, backgroundColor: value === selectedDate ? colors.surfaceRaised : "transparent", borderWidth: 1, borderColor: value === selectedDate ? colors.accent : "transparent" }}>
      <Text style={{ color: value === today ? colors.accent : colors.textPrimary, ...tokens.type.secondary, fontWeight: value === today || value === selectedDate ? "700" : "400" }}>{Number(value.slice(8))}</Text>
      <View style={{ flexDirection: "row", gap: 3, height: 5 }}>{kinds.map((kind) => <View key={kind} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColors[kind] }} />)}</View>
    </Pressable>;
  };
  const visibleDates: (string | null)[] = monthOpen ? [...Array.from({ length: monthDates.leading }, () => null), ...monthDates.days] : calendarWeekDates(selectedDate);
  return <Screen title="Your Calendar" eyebrow="MAKE TIME TOGETHER" create={false}>
    <Txt muted>Times shown in {timezone}</Txt>
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <IconButton label="Previous month" onPress={() => changeMonth(-1)}><ChevronLeft size={22} color={colors.textPrimary} /></IconButton>
      <Text style={styles.h2}>{new Date(`${month}-01T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</Text>
      <IconButton label="Next month" onPress={() => changeMonth(1)}><ChevronRight size={22} color={colors.textPrimary} /></IconButton>
    </View>
    <View style={[styles.row, { justifyContent: "space-between" }]}><Button compact secondary title="Today" onPress={() => selectDay(today)} /><Button compact secondary title={monthOpen ? "Show week" : "Show month"} onPress={() => setMonthOpen((open) => !open)} /></View>
    <View style={{ flexDirection: "row" }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <Text key={day} style={{ width: `${100 / 7}%`, textAlign: "center", color: colors.textSecondary, ...tokens.type.caption }}>{day}</Text>)}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{visibleDates.map(renderDate)}</View>
    <View style={[styles.row, { flexWrap: "wrap" }]}>{(["beacon", "plan", "routine"] as const).map((kind) => <View key={kind} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dotColors[kind] }} /><Txt muted>{kind === "beacon" ? "Your Beacons" : kind === "plan" ? "Plan schedule" : "Projected Routine"}</Txt></View>)}</View>
    {routineCalendar.loading ? <Txt muted>Loading Routine dates...</Txt> : null}
    {routineCalendar.error ? <View><Text accessibilityRole="alert" style={styles.error}>{routineCalendar.error}</Text><Button compact secondary title="Retry Routine dates" onPress={routineCalendar.retry} /></View> : null}
    {routineCalendar.truncated ? <Txt muted>Showing the first 500 Routine occurrences. Switch to week view for a smaller range.</Txt> : null}
    <View style={{ gap: tokens.space.sm }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}><Text accessibilityRole="header" style={[styles.h2, { flex: 1 }]}>{heading(selectedDate)}</Text>
        {selectedDate >= today ? <Button compact title="+ Schedule" onPress={() => { setScheduleError(""); setScheduleOpen(true); }} /> : null}
      </View>
      {!agenda.length && !routineCalendar.error ? loading || routineCalendar.loading ? <Txt muted>Loading your calendar…</Txt> : selectedDate < today ? <Txt muted>No activity history on this day.</Txt> : <SemanticEmpty name="empty.calendar" density="inline" /> : null}
      {agenda.map((item) => <View key={item.key} style={{gap:5}}><Pressable accessibilityRole="button" accessibilityState={item.activities?.length?{expanded:expanded===item.key}:undefined} onPress={() => openItem(item)} style={[styles.card, { gap: 4, borderLeftWidth: 3, borderLeftColor: dotColors[item.kind],borderStyle:item.tentative?"dashed":"solid" }]}>
        <Text style={styles.h2}>{item.title}</Text>
        <Txt muted>{item.label}{item.startsAt ? ` · ${new Date(item.startsAt).toLocaleTimeString([], { timeZone: timezone, hour: "numeric", minute: "2-digit" })}` : ""}</Txt>
        {item.activities?.length ? <Txt muted>{item.activities.length} activities · {expanded===item.key?"Collapse":"View itinerary"}</Txt> : null}
      </Pressable>{expanded===item.key&&item.activities?<View style={{paddingLeft:16,gap:8}}>{item.activities.map(a=><Button key={a.id} compact secondary title={`${new Date(a.startsAt).toLocaleTimeString([],{timeZone:timezone,hour:"numeric",minute:"2-digit"})} · ${a.title}`} onPress={()=>router.push({pathname:"/activity/[id]",params:{id:a.id}})} />)}<Button compact title="Open Plan" onPress={()=>router.push({pathname:"/plan/[id]",params:{id:item.id}})} /></View>:null}</View>)}
    </View>
    {!!progress.length && <PastWeeklyProgressView items={progress} />}
    <View style={[styles.row, { flexWrap: "wrap" }]}><Button compact secondary title="Plans" onPress={() => router.push("/plans")} /><Button compact secondary title="Routines" onPress={() => router.push("/routines")} /></View>
    <Txt muted>Routine dates use each Routine’s timezone.</Txt>
    <Sheet title={projected?.title??"Projected repeat"} visible={!!projected} onClose={()=>setProjected(null)}><Txt>{projected?.date} · Projected repeat</Txt><Txt muted>This is a preview. Its Beacons and attendance do not exist yet.</Txt><Button title="Future repeats" onPress={()=>{const item=projected;setProjected(null);if(item)router.push({pathname:"/routines",params:{planId:item.id}});}} />{projected&&data.plan_routines.some(r=>r.id===projected.routineId&&r.next_occurrence_on===projected.date)&&<Action secondary title="Skip this next repeat" run={async()=>{await act("skip_routine_next",{id:projected.routineId,expected_occurrence_on:projected.date});setProjected(null);}} />}</Sheet>
    <Sheet title={`Schedule · ${heading(selectedDate)}`} visible={scheduleOpen && selectedDate >= today} onClose={() => setScheduleOpen(false)}>
      {scheduleError ? <Text accessibilityRole="alert" style={styles.error}>{scheduleError}</Text> : null}
      <Button title="Schedule Once · Beacon" onPress={() => { setScheduleError(""); try { const startsAt = calendarScheduleStart(selectedDate, Date.now(), timezone); setScheduleOpen(false); router.push({ pathname: "/create", params: { startsAt, timezone } }); } catch (failure) { setScheduleError(failure instanceof Error ? failure.message : "Choose another date."); } }} />
      <Button title="Beacon Plan" onPress={() => { setScheduleOpen(false); router.push({ pathname: "/plans", params: { create: "yes", startDate: selectedDate, timezone } }); }} />
      <Button title="Repeat as Routine" onPress={() => { setScheduleOpen(false); router.push({ pathname: "/plans", params: { create: "yes", routine: "yes", startDate: selectedDate, timezone } }); }} />
    </Sheet>
  </Screen>;
}
