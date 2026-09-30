import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import BeaconMap from "@/components/BeaconMap";
import DateField from "@/components/DateField";
import { useBeacon } from "@/src/store";
import type { Audience, Category } from "@/src/types";
import { validateActivity } from "@/src/domain";
import {
  templates,
  repeatSuggestions,
  type BeaconTemplate,
} from "@/src/templates";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/ui";
export default function CreateActivity() {
  const { styles } = useTheme();

  const { data, userId, act } = useBeacon();
  const params = useLocalSearchParams<{
    kind?: string;
    squadId?: string;
    repeat?: string;
    template?: string;
    editTemplate?: string;
    saveTemplate?: string;
  }>();
  const saved = data.templates.find(
    (t) => t.id === params.template && t.owner_id === userId,
  );
  const templateEditor =
    params.editTemplate === "yes" || params.saveTemplate === "yes";
  const previous = data.activities.find((a) => a.id === params.repeat);
  const [timing, setTiming] = useState(false);
  const [view, setView] = useState("Normal");
  const [kind, setKind] = useState(
    params.kind === "status"
      ? "Status"
      : params.kind === "squad"
        ? "Squad"
        : "Beacon",
  );
  const [title, setTitle] = useState(saved?.title ?? previous?.title ?? "");
  const [description, setDescription] = useState(
    saved?.description ?? previous?.description ?? "",
  );
  const [templateName, setTemplateName] = useState(
    saved?.name ?? previous?.title ?? "",
  );
  const [available, setAvailable] = useState(false);
  const [category, setCategory] = useState<Category>(
    saved?.category ?? previous?.category ?? "Social",
  );
  const [audience, setAudience] = useState<Audience>(
    params.kind === "squad"
      ? "squad"
      : (data.profiles.find((p) => p.id === userId)?.default_audience ??
          "friends"),
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    params.squadId ?? null,
  );
  const [target, setTarget] = useState(
    saved?.target_count ? String(saved.target_count) : "",
  );
  const [approval, setApproval] = useState(
    saved?.approval_required ? "Host approval" : "Open joining",
  );
  const [when, setWhen] = useState("Now"),
    [duration, setDuration] = useState(
      saved
        ? saved.minutes === 30
          ? "30 min"
          : saved.minutes === 60
            ? "1 hour"
            : saved.minutes === 120
              ? "2 hours"
              : "Custom"
        : "1 hour",
    );
  const [starts, setStarts] = useState(() => new Date().toISOString());
  const [ends, setEnds] = useState(() =>
    new Date(Date.now() + (saved?.minutes ?? 60) * 60000).toISOString(),
  );
  const [label, setLabel] = useState(saved?.label ?? "");
  const [placeType, setPlaceType] = useState("In person"),
    [url, setUrl] = useState("");
  const [pin, setPin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showPin, setShowPin] = useState(false);
  const suggestions = repeatSuggestions(data.activities, userId!);
  function applyTemplate(t: BeaconTemplate) {
    setTitle(t.title);
    setCategory(t.category);
    setDuration(
      t.minutes === 30
        ? "30 min"
        : t.minutes === 60
          ? "1 hour"
          : t.minutes === 120
            ? "2 hours"
            : "Custom",
    );
    setEnds(new Date(Date.parse(starts) + t.minutes * 60000).toISOString());
  }
  async function saveTemplate() {
    const minutes =
      duration === "Custom"
        ? Math.round((Date.parse(ends) - Date.parse(starts)) / 60000)
        : duration === "30 min"
          ? 30
          : duration === "2 hours"
            ? 120
            : 60;
    if (!templateName.trim() || !title.trim())
      throw new Error("Give your template a name and activity.");
    await act("save_template", {
      id: saved?.id,
      name: templateName.trim(),
      title: title.trim(),
      description: description.trim(),
      category,
      minutes,
      label: label.trim(),
      target_count: target.trim() ? Number(target) : null,
      approval_required: approval === "Host approval",
    });
    router.replace("/(tabs)/activities");
  }
  async function publish() {
    const start =
      when === "Now"
        ? Date.now()
        : when === "In 30 min"
          ? Date.now() + 1800000
          : Date.parse(starts);
    const minutes =
      duration === "30 min" ? 30 : duration === "2 hours" ? 120 : 60;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      available: kind === "Status" && available,
      category,
      mode: kind === "Status" ? "solo" : "squad",
      starts_at: new Date(start).toISOString(),
      ends_at:
        duration === "Custom"
          ? ends
          : new Date(start + minutes * 60000).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      audience,
      audience_id: audienceId,
      target_count: kind === "Status" || !target.trim() ? null : Number(target),
      approval_required: kind !== "Status" && approval === "Host approval",
      label: label.trim(),
      online_url: placeType === "Online" ? url : null,
      latitude: placeType === "In person" ? (pin?.latitude ?? null) : null,
      longitude: placeType === "In person" ? (pin?.longitude ?? null) : null,
    };
    if (
      payload.target_count != null &&
      (!Number.isInteger(payload.target_count) ||
        payload.target_count < 2 ||
        payload.target_count > 100)
    )
      throw new Error("Choose a crew target from 2 to 100, or leave it blank.");
    validateActivity(payload);
    if ((audience === "list" || audience === "squad") && !audienceId)
      throw new Error("Choose who to share with first.");
    await act("create_activity", payload);
    router.replace("/(tabs)");
  }
  return (
    <Screen
      title={
        templateEditor
          ? "Your repeat plan"
          : kind === "Status"
            ? "Share a little update"
            : "Create a beacon"
      }
      eyebrow="SMALL PLANS. GOOD COMPANY."
      create={false}
      footer={
        <Action
          title={
            templateEditor
              ? "Save template"
              : kind === "Status"
                ? "Share my status"
                : "Light up this beacon"
          }
          run={templateEditor ? saveTemplate : publish}
        />
      }
    >
      <View style={styles.between}>
        <Chips
          options={["Normal", "Advanced"]}
          value={view}
          onChange={setView}
        />
        <Text style={styles.label}>{kind}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[...suggestions, ...templates].map((t) => (
          <Button
            key={t.label}
            secondary
            title={t.label}
            onPress={() => applyTemplate(t)}
          />
        ))}
      </ScrollView>
      {templateEditor && (
        <Field
          label="Template name"
          value={templateName}
          onChangeText={setTemplateName}
          maxLength={80}
        />
      )}
      {kind === "Status" && (
        <Chips
          options={["Busy", "Free to hang"]}
          value={available ? "Free to hang" : "Busy"}
          onChange={(v) => setAvailable(v === "Free to hang")}
        />
      )}
      <Field
        label="What are you doing?"
        placeholder="A tiny adventure with your people"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title={
              when === "Pick time"
                ? new Date(starts).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : when
            }
            onPress={() => setTiming(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary title={duration} onPress={() => setTiming(true)} />
        </View>
      </View>
      <Sheet
        title="When shall we?"
        visible={timing}
        onClose={() => setTiming(false)}
      >
        <Chips
          options={["Now", "In 30 min", "Pick time"]}
          value={when}
          onChange={setWhen}
        />
        {when === "Pick time" && (
          <DateField label="Starts" value={starts} onChange={setStarts} />
        )}
        <Txt muted>How long?</Txt>
        <Chips
          options={["30 min", "1 hour", "2 hours", "Custom"]}
          value={duration}
          onChange={setDuration}
        />
        {duration === "Custom" && (
          <DateField label="Ends" value={ends} onChange={setEnds} />
        )}
        <Button title="Done" onPress={() => setTiming(false)} />
      </Sheet>
      <Field
        label="Where? (optional)"
        placeholder="Your usual spot, or decide together"
        value={label}
        onChangeText={setLabel}
        maxLength={160}
      />
      <AudiencePicker
        value={audience}
        id={audienceId}
        onChange={(a, id) => {
          setAudience(a);
          setAudienceId(id);
        }}
      />
      <Txt muted>
        {kind === "Status"
          ? "Just your update. Switch to Beacon whenever you want company."
          : approval === "Host approval"
            ? "People request to join. You give the okay."
            : "One tap to join. Maybe is welcome. Plans can change."}
      </Txt>
      {view === "Advanced" && (
        <>
          <Text style={styles.h2}>Make it yours</Text>
          <Chips
            options={["Beacon", "Status", "Squad"]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setAudience(k === "Squad" ? "squad" : "friends");
              setAudienceId(null);
            }}
          />

          {kind !== "Status" && (
            <Field
              label="How many make it happen? (optional)"
              placeholder="4 people for doubles, including you"
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
            />
          )}
          <Chips
            options={
              [
                "Fitness",
                "Study",
                "Gaming",
                "Creative",
                "Social",
                "Other",
              ] as const
            }
            value={category}
            onChange={setCategory}
          />
          {kind !== "Status" && (
            <Chips
              options={["Open joining", "Host approval"]}
              value={approval}
              onChange={setApproval}
            />
          )}
          <Chips
            options={["In person", "Online"]}
            value={placeType}
            onChange={setPlaceType}
          />
          {placeType === "Online" ? (
            <Field
              label="HTTPS link"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          ) : (
            <>
              <Button
                secondary
                title={
                  showPin
                    ? "Hide map"
                    : pin
                      ? "Edit meeting pin"
                      : "Add a meeting pin"
                }
                onPress={() => setShowPin(!showPin)}
              />
              {showPin && (
                <BeaconMap
                  activities={[]}
                  places={[]}
                  locations={[]}
                  profiles={[]}
                  onActivity={() => {}}
                  onPerson={() => {}}
                  onPick={(latitude, longitude) =>
                    setPin({ latitude, longitude })
                  }
                  selected={pin}
                />
              )}
              {pin && (
                <Button
                  secondary
                  title="Remove pin"
                  onPress={() => setPin(null)}
                />
              )}
            </>
          )}
          <Button
            secondary
            title="Set a custom end time"
            onPress={() => setDuration("Custom")}
          />
          {duration === "Custom" && (
            <DateField label="Ends" value={ends} onChange={setEnds} />
          )}
          <Field
            label="A little more detail (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />
          {!templateEditor && (
            <>
              <Field
                label="Save this as a template (optional name)"
                value={templateName}
                onChangeText={setTemplateName}
                maxLength={80}
              />
              <Action title="Save as template" secondary run={saveTemplate} />
            </>
          )}
        </>
      )}
      {duration === "Custom" && view === "Normal" && (
        <Txt muted>
          Custom end: {new Date(ends).toLocaleString()}. Edit in Advanced.
        </Txt>
      )}
    </Screen>
  );
}
