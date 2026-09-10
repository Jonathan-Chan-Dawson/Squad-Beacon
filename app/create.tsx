import React, { useState } from "react";

import { router } from "expo-router";
import BeaconMap from "@/components/BeaconMap";
import DateField from "@/components/DateField";
import { useBeacon } from "@/src/store";
import type { Audience, Category, Mode } from "@/src/types";
import { validateActivity } from "@/src/domain";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Field,
  Screen,
  Txt,
} from "@/src/ui";
export default function CreateActivity() {
  const { data, userId, act } = useBeacon();
  const [title, setTitle] = useState(""),
    [category, setCategory] = useState<Category>("Fitness"),
    [mode, setMode] = useState<Mode>("squad"),
    [audience, setAudience] = useState<Audience>("friends"),
    [audienceId, setAudienceId] = useState<string | null>(null),
    [approval, setApproval] = useState("Open joining");
  const [starts, setStarts] = useState(() =>
      new Date(Date.now() + 3600000).toISOString(),
    ),
    [ends, setEnds] = useState(() =>
      new Date(Date.now() + 7200000).toISOString(),
    );
  const [placeType, setPlaceType] = useState("Decide later"),
    [label, setLabel] = useState(""),
    [url, setUrl] = useState(""),
    [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
      null,
    ),
    [habit, setHabit] = useState("None"),
    [goal, setGoal] = useState("None");
  return (
    <Screen
      title="Create activity"
      eyebrow="A simple plan starts here"
      create={false}
    >
      <Field
        label="What are you doing?"
        placeholder="A few rounds of boxing"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <Chips
        options={
          ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"] as const
        }
        value={category}
        onChange={setCategory}
      />
      <Txt muted>Activity mode</Txt>
      <Chips
        options={["solo", "squad", "invite"] as const}
        value={mode}
        onChange={setMode}
      />
      <Txt muted>
        {mode === "solo"
          ? "Share what you’re doing without opening attendance."
          : mode === "invite"
            ? "Only people you invite or approve can confirm attendance."
            : "Friends can express interest, then confirm they’re going."}
      </Txt>
      <DateField label="Starts" value={starts} onChange={setStarts} />
      <DateField label="Ends" value={ends} onChange={setEnds} />
      <AudiencePicker
        value={audience}
        id={audienceId}
        onChange={(a, id) => {
          setAudience(a);
          setAudienceId(id);
        }}
      />
      {mode === "squad" && (
        <Chips
          options={["Open joining", "Host approval"]}
          value={approval}
          onChange={setApproval}
        />
      )}
      <Chips
        options={["Decide later", "In person", "Online"]}
        value={placeType}
        onChange={setPlaceType}
      />
      {placeType !== "Decide later" && (
        <Field
          label={
            placeType === "Online"
              ? "Online activity label"
              : "Meeting place name"
          }
          value={label}
          onChangeText={setLabel}
        />
      )}
      {placeType === "Online" && (
        <Field
          label="HTTPS link"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
      )}
      {placeType === "In person" && (
        <>
          <Txt muted>
            Tap to deliberately choose a meeting pin. This does not share your
            live location.
          </Txt>
          <BeaconMap
            activities={[]}
            places={[]}
            locations={[]}
            profiles={[]}
            onActivity={() => {}}
            onPerson={() => {}}
            onPick={(latitude, longitude) => setPin({ latitude, longitude })}
            selected={pin}
          />
          {pin && (
            <Button secondary title="Remove pin" onPress={() => setPin(null)} />
          )}
        </>
      )}
      <Txt muted>Link your goal (optional)</Txt>
      <Chips
        options={[
          "None",
          ...data.goals
            .filter((g) => g.owner_id === userId)
            .map((g) => g.title),
        ]}
        value={goal}
        onChange={setGoal}
      />
      <Txt muted>Link your habit (optional)</Txt>
      <Chips
        options={[
          "None",
          ...data.habits
            .filter((h) => h.owner_id === userId)
            .map((h) => h.title),
        ]}
        value={habit}
        onChange={setHabit}
      />
      <Action
        title="Create activity →"
        run={async () => {
          const payload = {
            title: title.trim(),
            category,
            mode,
            starts_at: starts,
            ends_at: ends,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            audience,
            audience_id: audienceId,
            approval_required: approval === "Host approval",
            goal_id:
              data.goals.find((g) => g.owner_id === userId && g.title === goal)
                ?.id ?? null,
            habit_id:
              data.habits.find(
                (h) => h.owner_id === userId && h.title === habit,
              )?.id ?? null,
            label: placeType === "Decide later" ? "" : label,
            online_url: placeType === "Online" ? url : null,
            latitude:
              placeType === "In person" ? (pin?.latitude ?? null) : null,
            longitude:
              placeType === "In person" ? (pin?.longitude ?? null) : null,
          };
          validateActivity(payload);
          if ((audience === "list" || audience === "squad") && !audienceId)
            throw new Error("Select an audience.");
          await act("create_activity", payload);
          router.replace("/(tabs)/activities");
        }}
      />
      <Button title="Cancel" secondary onPress={() => router.back()} />
    </Screen>
  );
}
