import React, { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Check, Flame, Target, Trophy } from "lucide-react-native";
import { useBeacon } from "../store";
import { habitStats } from "../domain";
import type { Audience, Goal } from "../types";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  colors,
  styles,
} from "../ui";
export default function ProgressScreen() {
  const { data, userId, act } = useBeacon();
  const [sheet, setSheet] = useState<"goal" | "habit" | null>(null),
    [editing, setEditing] = useState<Goal | null>(null);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [progress, setProgress] = useState("0"),
    [milestone, setMilestone] = useState("");
  const [audience, setAudience] = useState<Audience>("private"),
    [audienceId, setAudienceId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("Weekly target"),
    [target, setTarget] = useState("3"),
    [days, setDays] = useState([1, 2, 3, 4, 5]),
    [goal, setGoal] = useState<string | null>(null),
    [reminder, setReminder] = useState("");
  const goals = data.goals.filter((g) => g.owner_id === userId),
    habits = data.habits.filter((h) => h.owner_id === userId),
    stats = habits.map((h) => habitStats(h, data.checkins));
  const checkins = stats.reduce((sum, s) => sum + s.weekCount, 0);
  function open(kind: "goal" | "habit", g?: Goal) {
    setSheet(kind);
    setEditing(g ?? null);
    setTitle(g?.title ?? "");
    setDescription(g?.description ?? "");
    setDate(g?.target_date ?? "");
    setProgress(String(g?.progress ?? 0));
    setAudience(g?.audience ?? "private");
    setAudienceId(g?.audience_id ?? null);
    setMilestone("");
  }
  return (
    <Screen title="Small steps. Real progress." eyebrow="SHOW UP FOR YOURSELF">
      <View style={styles.hero}>
        <Text style={[styles.label, { color: colors.lime }]}>
          YOUR WEEK, SO FAR
        </Text>
        <View style={styles.between}>
          <View>
            <Text style={[styles.title, { fontSize: 46, color: "white" }]}>
              {checkins}
            </Text>
            <Text style={{ color: "#C7D8CC" }}>habit check-ins</Text>
          </View>
          <Trophy size={45} color={colors.lime} />
        </View>
        <Text style={{ color: "#C7D8CC", lineHeight: 22 }}>
          {checkins
            ? "Every small step counts. Keep making room for what matters."
            : "A fresh start is always available. Try one small step today."}
        </Text>
      </View>
      <View style={styles.between}>
        <Text style={styles.h2}>The bigger picture</Text>
        <Button secondary title="+ Goal" onPress={() => open("goal")} />
      </View>
      {goals.map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          accessibilityLabel={"Edit goal " + g.title}
          onPress={() => open("goal", g)}
          style={styles.card}
        >
          <View style={styles.between}>
            <Target size={23} color={colors.green} />
            <Text style={styles.label}>{g.audience}</Text>
          </View>
          <Text style={styles.h2}>{g.title}</Text>
          <Txt muted>{g.description || "Add the why behind this goal."}</Txt>
          <View
            style={{
              height: 7,
              backgroundColor: "#EEF1E9",
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 7,
                width: (g.progress + "%") as any,
                backgroundColor: colors.green,
              }}
            />
          </View>
          <View style={styles.between}>
            <Txt muted>{g.progress}% of the way</Txt>
            <Txt muted>{g.target_date ?? "At your own pace"}</Txt>
          </View>
          {g.progress === 100 && <Txt>🏅 Goal reached</Txt>}
        </Pressable>
      ))}
      {Array.from({ length: Math.max(0, 3 - goals.length) }, (_, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel="Add a long-term goal"
          onPress={() => open("goal")}
        >
          <Empty
            title={"Your next big thing · " + (goals.length + i + 1)}
            body="What would you like to work toward? Fill this in whenever you’re ready."
          />
        </Pressable>
      ))}
      <View style={styles.between}>
        <Text style={styles.h2}>Your everyday wins</Text>
        <Button secondary title="+ Habit" onPress={() => open("habit")} />
      </View>
      {habits.map((h, i) => (
        <View key={h.id} style={styles.card}>
          <View style={styles.between}>
            <Text style={[styles.h2, { flex: 1 }]}>{h.title}</Text>
            <Flame color={colors.green} size={23} />
          </View>
          <Txt muted>
            {h.schedule === "weekly"
              ? h.weekly_target + " times a week"
              : h.weekdays
                  .map(
                    (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d],
                  )
                  .join(" · ")}{" "}
            · {h.audience}
          </Txt>
          <View style={styles.between}>
            <Txt>
              {stats[i].streak} {stats[i].unit} streak
            </Txt>
            <Txt muted>Best: {stats[i].best}</Txt>
          </View>
          <Txt muted>
            {stats[i].weekCount} check-ins this week
            {stats[i].best >= 3 ? " · 🏅 Consistency badge" : ""}
          </Txt>
          {stats[i].checkedToday ? (
            <View style={styles.row}>
              <Check color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700" }}>
                You showed up today.
              </Text>
            </View>
          ) : (
            <Action
              title="Check in for today"
              secondary
              run={() => act("checkin", { id: h.id })}
            />
          )}
        </View>
      ))}
      {!habits.length && (
        <Empty
          title="Build a rhythm."
          body="Pick a habit small enough to repeat. Rest days count as rest, not broken streaks."
        />
      )}
      <Sheet
        title={
          sheet === "goal"
            ? editing
              ? "Your long-term goal"
              : "A new long-term goal"
            : "Build a habit"
        }
        visible={!!sheet}
        onClose={() => setSheet(null)}
      >
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        {sheet === "goal" ? (
          <>
            <Field
              label="Why it matters"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Field
              label="Optional target date · YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />
            {editing && (
              <Field
                label="Progress · 0–100"
                value={progress}
                onChangeText={setProgress}
                keyboardType="numeric"
              />
            )}
          </>
        ) : (
          <>
            <Chips
              options={["Weekly target", "Selected weekdays"]}
              value={schedule}
              onChange={setSchedule}
            />
            {schedule === "Weekly target" ? (
              <Field
                label="Completions per week · 1–7"
                value={target}
                onChangeText={setTarget}
                keyboardType="numeric"
              />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (d, i) => (
                    <Button
                      key={d}
                      secondary={!days.includes(i)}
                      title={d}
                      onPress={() =>
                        setDays((prev) =>
                          prev.includes(i)
                            ? prev.filter((x) => x !== i)
                            : [...prev, i],
                        )
                      }
                    />
                  ),
                )}
              </View>
            )}
            <Txt muted>Link to a goal (optional)</Txt>
            <Chips
              options={["None", ...goals.map((g) => g.title)]}
              value={goals.find((g) => g.id === goal)?.title ?? "None"}
              onChange={(name) =>
                setGoal(goals.find((g) => g.title === name)?.id ?? null)
              }
            />
            <Field
              label="Reminder hour · 0–23, or leave blank"
              value={reminder}
              onChangeText={setReminder}
              keyboardType="numeric"
            />
          </>
        )}
        <AudiencePicker
          value={audience}
          id={audienceId}
          onChange={(a, id) => {
            setAudience(a);
            setAudienceId(id);
          }}
        />
        <Action
          title="Save"
          run={async () => {
            if (!title.trim()) throw new Error("Add a title.");
            if ((audience === "list" || audience === "squad") && !audienceId)
              throw new Error("Select an audience.");
            if (sheet === "goal")
              await act("save_goal", {
                id: editing?.id ?? null,
                title: title.trim(),
                description,
                target_date: date || null,
                progress: Number(progress),
                audience,
                audience_id: audienceId,
              });
            else {
              if (schedule === "Selected weekdays" && !days.length)
                throw new Error("Choose at least one weekday.");
              if (Number(target) < 1 || Number(target) > 7)
                throw new Error("Choose a weekly target from 1 to 7.");
              await act("save_habit", {
                title: title.trim(),
                schedule: schedule === "Weekly target" ? "weekly" : "days",
                weekdays: days,
                weekly_target: Number(target),
                goal_id: goal,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                reminder_hour: reminder === "" ? null : Number(reminder),
                audience,
                audience_id: audienceId,
              });
            }
            setSheet(null);
          }}
        />
        {sheet === "goal" && editing && (
          <>
            <Text style={styles.h2}>Milestones</Text>
            {data.milestones
              .filter((m) => m.goal_id === editing.id)
              .map((m) => (
                <Action
                  key={m.id}
                  secondary
                  title={(m.done ? "✓ " : "○ ") + m.title}
                  run={() =>
                    act("milestone", { id: editing.id, milestone_id: m.id })
                  }
                />
              ))}
            <Field
              label="New milestone"
              value={milestone}
              onChangeText={setMilestone}
            />
            <Action
              title="Add milestone"
              secondary
              run={async () => {
                if (!milestone.trim())
                  throw new Error("Describe the milestone.");
                await act("milestone", { id: editing.id, title: milestone });
                setMilestone("");
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
