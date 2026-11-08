import { BookOpen, FileText, Link2, Search, Type } from "lucide-react-native";
import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Action, Chips, Field, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { resolvePremiumFeature } from "@/src/shared/entitlements";
import { canReadBeaconNote } from "../beaconModules";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import type { Activity, BeaconNote } from "@/src/shared/types";
export function RichNote({ body, rich }: { body: string; rich: boolean }) {
  const { colors, styles } = useTheme();
  if (!rich) return <Text style={styles.body}>{body}</Text>;
  return (
    <View style={{ gap: 4 }}>
      {body.split("\n").map((line, n) => (
        <Text key={n} style={styles.body}>
          {line
            .replace(/^[-*] /, "• ")
            .split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g)
            .map((part, i) =>
              part.startsWith("**") ? (
                <Text key={i} style={{ fontWeight: "700" }}>
                  {part.slice(2, -2)}
                </Text>
              ) : part.startsWith("*") ? (
                <Text key={i} style={{ fontStyle: "italic" }}>
                  {part.slice(1, -1)}
                </Text>
              ) : /^\[.*\]\(https:\/\//.test(part) ? (
                <Text
                  key={i}
                  accessibilityRole="link"
                  style={{ color: colors.primary }}
                  onPress={() =>
                    void Linking.openURL(
                      part.slice(part.indexOf("](") + 2, -1),
                    ).catch(() => undefined)
                  }
                >
                  {part.slice(1, part.indexOf("]("))}
                </Text>
              ) : (
                part
              ),
            )}
        </Text>
      ))}
    </View>
  );
}
export function JournalEntryDetails({
  note,
  activity,
}: {
  note: BeaconNote;
  activity: Activity;
}) {
  const { data, userId, act } = useBeacon();
  const [open, setOpen] = useState(false),
    [body, setBody] = useState(note.body),
    [format, setFormat] = useState<"plain" | "markdown">("plain"),
    [tags, setTags] = useState(""),
    [links, setLinks] = useState<string[]>([]),
    [name, setName] = useState(""),
    [expectedRevision, setExpectedRevision] = useState(note.revision);
  if (!userId || !canReadBeaconNote(data, note, userId)) return null;
  const details = data.journal_details?.find((d) => d.note_id === note.id);
  const plus = resolvePremiumFeature(
    data,
    "journal_formatting",
    activity,
    note.visibility === "private",
  ).available;
  const pro = resolvePremiumFeature(
    data,
    "journal_reflections",
    activity,
    note.visibility === "private",
  ).available;
  const eligible = data.beacon_notes.filter(
    (n) => n.id !== note.id && canReadBeaconNote(data, n, userId),
  );
  return (
    <View style={{ gap: 6 }}>
      <RichNote body={note.body} rich={details?.format === "markdown"} />
      {!!details?.tags.length && (
        <Txt muted>{details.tags.map((t) => `#${t}`).join(" ")}</Txt>
      )}
      {details?.linked_note_ids.map((id) => {
        const linked = eligible.find((n) => n.id === id);
        return linked ? (
          <View key={id}>
            <Txt muted>{linked.section_heading || "Linked reflection"}</Txt>
            <Txt>{linked.body}</Txt>
          </View>
        ) : null;
      })}
      {note.author_id === userId &&
        (data.is_demo || data.capabilities?.advanced_beacon_tools) && (
          <PlanChoice
            title="Formatting & organization"
            detail="Format this entry, add tags or link reflections"
            icon={Type}
            expanded={open}
            onPress={() => {
              setBody(note.body);
              setExpectedRevision(note.revision);
              setFormat(details?.format ?? "plain");
              setTags(details?.tags.join(", ") ?? "");
              setLinks(details?.linked_note_ids ?? []);
              setOpen(!open);
            }}
          />
        )}
      {open && (
        <View style={{ gap: 8 }}>
          {!plus ? (
            <PremiumPreview />
          ) : (
            <>
              <Chips
                options={["Plain text", "Rich text"]}
                value={format === "markdown" ? "Rich text" : "Plain text"}
                onChange={(v) =>
                  setFormat(v === "Rich text" ? "markdown" : "plain")
                }
              />
              <Field
                label="Entry text"
                value={body}
                onChangeText={setBody}
                maxLength={1000}
                multiline
              />
              {format === "markdown" && (
                <>
                  <Chips
                    options={["Bold", "Italic", "List"]}
                    value=""
                    onChange={(v) =>
                      setBody((b) =>
                        v === "Bold"
                          ? `${b} **bold text**`
                          : v === "Italic"
                            ? `${b} *italic text*`
                            : `${b}\n- List item`,
                      )
                    }
                  />
                  <Txt muted>Links use [label](https://example.com).</Txt>
                  <RichNote body={body} rich />
                </>
              )}
              <Field
                label="Tags · comma separated"
                value={tags}
                onChangeText={setTags}
              />
              {pro && (
                <>
                  <Txt muted>Link an authorized reflection</Txt>
                  {eligible.slice(0, 12).map((n) => (
                    <PlanChoice
                      key={n.id}
                      title={n.section_heading || n.body.slice(0, 60)}
                      detail="Link this reflection"
                      icon={Link2}
                      selected={links.includes(n.id)}
                      onPress={() =>
                        setLinks((ids) =>
                          ids.includes(n.id)
                            ? ids.filter((id) => id !== n.id)
                            : [...ids, n.id],
                        )
                      }
                    />
                  ))}
                </>
              )}
              <Action
                title="Save entry details"
                run={async () => {
                  await act("save_journal_details", {
                    note_id: note.id,
                    body,
                    expected_revision: expectedRevision,
                    format,
                    tags: tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    linked_note_ids: links,
                  });
                  setOpen(false);
                }}
              />
              <Field
                label="Entry template name · optional"
                value={name}
                onChangeText={setName}
              />
              {name.trim() && (
                <Action
                  secondary
                  title="Save personal entry template"
                  run={() =>
                    act("save_tool_preset", {
                      id: randomUUID(),
                      kind: "journal",
                      title: name,
                      settings: {
                        body,
                        heading: note.section_heading,
                        format,
                        tags: tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              )}
            </>
          )}
          {details && (
            <Action
              secondary
              title="Clear formatting and organization"
              run={() =>
                act("save_journal_details", {
                  note_id: note.id,
                  format: "plain",
                  tags: [],
                  linked_note_ids: [],
                })
              }
            />
          )}
        </View>
      )}
    </View>
  );
}
export function JournalTemplates({
  activity,
  onApply,
}: {
  activity: Activity;
  onApply: (body: string, heading: string) => void;
}) {
  const { data, userId } = useBeacon();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const templates =
    data.premium_presets?.filter(
      (p) =>
        p.owner_id === userId &&
        p.kind === "journal" &&
        p.title.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  if (!templates.length || activity.status === "cancelled") return null;
  return (
    <View style={{ gap: 8 }}>
      <PlanChoice
        title="Use entry template"
        detail="Start with a saved entry structure"
        icon={BookOpen}
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Field
            label="Find entry template"
            value={query}
            onChangeText={setQuery}
          />
          {templates.slice(0, 8).map((p) => (
            <PlanChoice
              key={p.id}
              title={p.title}
              detail={p.settings.heading || "Saved journal template"}
              icon={FileText}
              onPress={() => {
                onApply(p.settings.body ?? "", p.settings.heading ?? "");
                setOpen(false);
              }}
            />
          ))}
        </>
      )}
    </View>
  );
}
export function JournalReflectionSearch() {
  const { data, userId } = useBeacon();
  const [open, setOpen] = useState(false),
    [tag, setTag] = useState(""),
    [date, setDate] = useState(""),
    [beacon, setBeacon] = useState("");
  if (!userId || !resolvePremiumFeature(data, "journal_reflections").available)
    return null;
  const notes = data.beacon_notes.filter(
    (n) =>
      canReadBeaconNote(data, n, userId) &&
      (!date || n.created_at.slice(0, 10) === date) &&
      (!tag ||
        data.journal_details
          ?.find((d) => d.note_id === n.id)
          ?.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))) &&
      (!beacon ||
        data.activities
          .find((a) => a.id === n.activity_id)
          ?.title.toLowerCase()
          .includes(beacon.toLowerCase())),
  );
  return (
    <View style={{ gap: 8 }}>
      <PlanChoice
        title="Find linked reflections"
        detail="Search by tag, Beacon or date"
        icon={Search}
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Field label="Filter tags" value={tag} onChangeText={setTag} />
          <Field
            label="Filter Beacon"
            value={beacon}
            onChangeText={setBeacon}
          />
          <Field
            label="Entry date · YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
          />
          {notes.slice(0, 30).map((n) => (
            <View key={n.id}>
              <Txt muted>{n.section_heading || "Reflection"}</Txt>
              <RichNote
                body={n.body}
                rich={
                  data.journal_details?.find((d) => d.note_id === n.id)
                    ?.format === "markdown"
                }
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}
