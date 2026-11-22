import { randomUUID } from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import {
  BookOpen, ChevronDown, ChevronUp, Coffee, Dices, Flag, Leaf, Palette,
  Pencil, RadioTower, RotateCw, Swords, Zap,
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { composerTiming, storeComposerSession } from "@/src/features/planning/composerSession";
import { Chip } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, Screen, useTheme } from "@/src/shared/ui";
import { setCreationDraftField, startCreationDraft } from "../socialPlanningSession";
import { QuestPreview } from "./QuestPreview";
import {
  activityFilters, matchingQuests, questBeaconFields, questPing, rollQuest, vibes,
  type ActivityFilter, type SideQuest, type Vibe,
} from "./quests";

const vibeIcons = {
  Random: Dices, Chill: Coffee, Competitive: Swords,
  Productive: BookOpen, Creative: Palette, Outdoors: Leaf,
};

export default function SpontaneityScreen() {
  const { userId, viewerEpoch, demo } = useBeacon();
  return <Machine key={`${userId}:${viewerEpoch}:${demo}`} viewer={userId} />;
}

function Machine({ viewer }: { viewer: string | null }) {
  const { semanticColors: colors, styles, tokens } = useTheme();
  const [vibe, setVibe] = useState<Vibe>("Random");
  const [filter, setFilter] = useState<ActivityFilter>("Any Activity");
  const [more, setMore] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [quest, setQuest] = useState<SideQuest>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmReroll, setConfirmReroll] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  useFocusEffect(useCallback(() => { opening.current = false; }, []));

  const choices = matchingQuests(vibe, filter);
  const changed = quest && (title !== quest.title || description !== quest.description);
  const filteredOut = quest && !choices.includes(quest);
  const FilterToggle = more ? ChevronUp : ChevronDown;
  const wrap = { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs } as const;
  const rail = { gap: tokens.space.xs, paddingBottom: tokens.space.xs };
  const panel = {
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
    borderRadius: tokens.radius.card, padding: 12, gap: tokens.space.sm,
  };

  function roll() {
    const next = rollQuest(choices, recent);
    if (!next) return;
    setRecent([next.id, ...recent].slice(0, 5));
    setQuest(next);
    setTitle(next.title);
    setDescription(next.description);
    setEditing(false);
    setConfirmReroll(false);
    setError("");
  }

  function openEditor(kind: "beacon" | "ping") {
    if (!viewer || !quest || !title.trim() || opening.current) return;
    opening.current = true;
    setError("");
    try {
      if (kind === "beacon") {
        const token = startCreationDraft(viewer);
        for (const [field, value] of Object.entries(questBeaconFields(quest, title, description))) {
          setCreationDraftField(viewer, token, field, value);
        }
        router.push({ pathname: "/create", params: { editor: "yes", planSession: token } });
      } else {
        const id = randomUUID();
        storeComposerSession(viewer, id, {
          ...questPing(quest, title, description),
          ...composerTiming(Date.now()),
          audience: "friends", audienceId: null, place: "", minutes: "60",
          options: [], touched: ["title", "body", "category"], publication: {},
        });
        router.push({ pathname: "/planning/create", params: { kind: "ping", sessionId: id } });
      }
    } catch {
      opening.current = false;
      setError("Couldn’t open the editor. Try again.");
    }
  }

  return (
    <ChatKeyboardFrame compact>
      <Screen
        title="Spontaneity Machine" eyebrow="" compactHeader iconOnlyBack create={false}
        footer={quest && !editing ? (
          <View style={[wrap, { width: "100%", maxWidth: 520, alignSelf: "center", gap: tokens.space.sm }]}>
            <View style={{ flexGrow: 1 }}>
              <Button title="Create Beacon" compact disabled={!viewer || !title.trim()}
                icon={<Flag size={15} color={colors.onAccent} />} onPress={() => openEditor("beacon")} />
            </View>
            <View style={{ flexGrow: 1 }}>
              <Button title="Start Ping" compact secondary disabled={!viewer || !title.trim()}
                icon={<Zap size={15} color={colors.accent} />} onPress={() => openEditor("ping")} />
            </View>
          </View>
        ) : undefined}
      >
        <View style={{
          width: "100%", maxWidth: 520, alignSelf: "center",
          paddingVertical: tokens.space.xs, gap: tokens.space.sm,
        }}>
          <View style={panel}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space.sm }}>
              <View style={{
                width: 34, height: 34, borderRadius: tokens.radius.sm,
                backgroundColor: colors.surfaceSelected,
                justifyContent: "center", alignItems: "center",
              }}>
                <RadioTower size={19} color={colors.accent} strokeWidth={1.65} />
              </View>
              <Text accessibilityRole="header" style={[styles.h2, { flex: 1 }]}>Find your next side quest.</Text>
            </View>
            <View style={{ gap: tokens.space.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.xs }}>
                <Text style={[styles.label, { flexShrink: 1 }]}>Pick a vibe</Text>
                <Chip label={filter === "Any Activity" ? "More options" : filter}
                  accessibilityLabel="More options" accessibilityState={{ expanded: more }}
                  icon={<FilterToggle size={15} color={colors.textSecondary} />}
                  onPress={() => setMore(!more)} />
              </View>
              <ScrollView horizontal accessibilityLabel="Vibes" testID="quest-vibes"
                keyboardShouldPersistTaps="handled" contentContainerStyle={rail}>
                {vibes.map((choice) => {
                  const Icon = vibeIcons[choice];
                  return <Chip key={choice} label={choice} selected={choice === vibe}
                    style={{ paddingHorizontal: tokens.space.sm }}
                    icon={<Icon size={15} color={choice === vibe ? colors.accent : colors.textSecondary} />}
                    onPress={() => { setVibe(choice); setConfirmReroll(false); }} />;
                })}
              </ScrollView>
            </View>
            {more && (
              <ScrollView horizontal accessibilityLabel="Activity filters" testID="quest-activity-filters"
                keyboardShouldPersistTaps="handled" contentContainerStyle={rail}>
                {activityFilters.map((choice) => (
                  <Chip key={choice} label={choice} accessibilityLabel={`Activity filter: ${choice}`} selected={filter === choice}
                    onPress={() => { setFilter(choice); setConfirmReroll(false); }} />
                ))}
              </ScrollView>
            )}
            {choices.length ? (
              <>
                {filteredOut && <Text style={styles.label}>Your next roll will use the new filters.</Text>}
                {confirmReroll ? (
                  <View style={{ gap: tokens.space.xs }}>
                    <Text style={styles.body}>Replace this idea and its edits?</Text>
                    <View style={wrap}>
                      <Button compact title="Replace and Roll" onPress={roll} />
                      <Button compact secondary title="Keep Idea" onPress={() => setConfirmReroll(false)} />
                    </View>
                  </View>
                ) : (
                  <Button title={quest ? "Try Another" : "Generate Side Quest"} secondary={!!quest}
                    onPress={() => changed ? setConfirmReroll(true) : roll()}
                    icon={quest ? <RotateCw size={17} color={colors.accent} /> : <Dices size={19} color={colors.onAccent} />} />
                )}
              </>
            ) : (
              <View style={{ alignItems: "flex-start", gap: tokens.space.xs }}>
                <Text accessibilityLiveRegion="polite" style={styles.body}>No quests match these filters.</Text>
                <Button compact secondary title="Clear activity filter" onPress={() => setFilter("Any Activity")} />
              </View>
            )}
          </View>
          {quest && (
            <View testID="machine-quest" style={panel}>
              <QuestPreview quest={quest} title={title.trim() || quest.title} description={description} />
              {editing && (
                <View style={{ gap: tokens.space.sm }}>
                  <Field label="Quest title" value={title} maxLength={120} onChangeText={setTitle} />
                  <Field label="Quest description" value={description} maxLength={500} onChangeText={setDescription} multiline />
                </View>
              )}
              <View style={{ alignSelf: "flex-start" }}>
                <Chip label={editing ? "Done editing" : "Edit idea"}
                  icon={<Pencil size={14} color={colors.textSecondary} />}
                  onPress={() => setEditing(!editing)} />
              </View>
              {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            </View>
          )}
        </View>
      </Screen>
    </ChatKeyboardFrame>
  );
}
