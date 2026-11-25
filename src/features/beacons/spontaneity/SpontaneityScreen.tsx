import { randomUUID } from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Coffee,
  Dices,
  Flag,
  Leaf,
  Palette,
  Pencil,
  RotateCw,
  Swords,
  Zap,
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import {
  composerTiming,
  storeComposerSession,
} from "@/src/features/planning/composerSession";
import { Chip } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, Screen, useTheme } from "@/src/shared/ui";
import {
  setCreationDraftField,
  startCreationDraft,
} from "../socialPlanningSession";
import { QuestPreview } from "./QuestPreview";
import {
  activityFilters,
  matchingQuests,
  questBeaconFields,
  questPing,
  rollQuest,
  vibes,
  type ActivityFilter,
  type SideQuest,
  type Vibe,
} from "./quests";

const vibeIcons = {
  Random: Dices,
  Chill: Coffee,
  Competitive: Swords,
  Productive: BookOpen,
  Creative: Palette,
  Outdoors: Leaf,
};
const reveal = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const initialQuest = matchingQuests("Random", "Any Activity")[0];

export default function SpontaneityScreen() {
  const { userId, viewerEpoch, demo } = useBeacon();
  return <Machine key={`${userId}:${viewerEpoch}:${demo}`} viewer={userId} />;
}

function Machine({ viewer }: { viewer: string | null }) {
  const { semanticColors: colors, styles, tokens } = useTheme();
  const [vibe, setVibe] = useState<Vibe>("Random");
  const [filter, setFilter] = useState<ActivityFilter>("Any Activity");
  const [more, setMore] = useState(false);
  const [recent, setRecent] = useState<string[]>([initialQuest.id]);
  const [quest, setQuest] = useState<SideQuest>(initialQuest);
  const [title, setTitle] = useState(initialQuest.title);
  const [description, setDescription] = useState(initialQuest.description);
  const [editing, setEditing] = useState(false);
  const [confirmReroll, setConfirmReroll] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  useFocusEffect(
    useCallback(() => {
      opening.current = false;
    }, []),
  );

  const choices = matchingQuests(vibe, filter);
  const changed =
    quest && (title !== quest.title || description !== quest.description);
  const filteredOut = quest && !choices.includes(quest);
  const FilterToggle = more ? ChevronUp : ChevronDown;
  const wrap = {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space.xs,
  } as const;
  const onlyCurrentMatch = choices.length === 1 && !filteredOut && !!quest;

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
        for (const [field, value] of Object.entries(
          questBeaconFields(quest, title, description),
        )) {
          setCreationDraftField(viewer, token, field, value);
        }
        router.push({
          pathname: "/create",
          params: { editor: "yes", planSession: token },
        });
      } else {
        const id = randomUUID();
        storeComposerSession(viewer, id, {
          ...questPing(quest, title, description),
          ...composerTiming(Date.now()),
          audience: "friends",
          audienceId: null,
          place: "",
          minutes: String(quest.minutes),
          options: [],
          touched: ["title", "body", "category"],
          publication: {},
        });
        router.push({
          pathname: "/planning/create",
          params: { kind: "ping", sessionId: id },
        });
      }
    } catch {
      opening.current = false;
      setError("Couldn’t open the editor. Try again.");
    }
  }

  return (
    <ChatKeyboardFrame compact>
      <Screen
        title="Spontaneity Machine"
        eyebrow=""
        compactHeader
        iconOnlyBack
        create={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 480,
            alignSelf: "center",
            gap: tokens.space.sm,
          }}
        >
          <View style={{ gap: tokens.space.xxs }}>
            <Text accessibilityRole="header" style={styles.title}>
              What’s the move?
            </Text>
            <Text style={styles.muted}>Find your next little adventure.</Text>
          </View>
          <View accessibilityLabel="Vibes" testID="quest-vibes" style={wrap}>
            {vibes.map((choice) => {
              const Icon = vibeIcons[choice];
              return (
                <Chip
                  key={choice}
                  label={choice === "Random" ? "Surprise me" : choice}
                  selected={choice === vibe}
                  icon={
                    <Icon
                      size={15}
                      color={
                        choice === vibe ? colors.accent : colors.textSecondary
                      }
                    />
                  }
                  onPress={() => {
                    setVibe(choice);
                    setConfirmReroll(false);
                  }}
                />
              );
            })}
          </View>
          <View style={{ alignSelf: "flex-start" }}>
            <Chip
              label={filter === "Any Activity" ? "More options" : filter}
              accessibilityLabel="More options"
              accessibilityState={{ expanded: more }}
              icon={<FilterToggle size={15} color={colors.textSecondary} />}
              onPress={() => setMore(!more)}
            />
          </View>
          {more && (
            <View
              accessibilityLabel="Activity filters"
              testID="quest-activity-filters"
              style={wrap}
            >
              {activityFilters.map((choice) => (
                <Chip
                  key={choice}
                  label={choice}
                  accessibilityLabel={`Activity filter: ${choice}`}
                  selected={filter === choice}
                  onPress={() => {
                    setFilter(choice);
                    setConfirmReroll(false);
                  }}
                />
              ))}
            </View>
          )}
          {quest && (
            <View
              testID="machine-quest"
              style={[
                styles.card,
                {
                  gap: tokens.space.sm,
                  borderColor: colors.border,
                  backgroundColor: tokens.categories[quest.category].tint,
                  padding: tokens.space.md,
                },
              ]}
            >
              <Animated.View key={quest.id} entering={reveal}>
                <QuestPreview
                  quest={quest}
                  title={title.trim() || quest.title}
                  description={description}
                />
              </Animated.View>
              {editing && (
                <View style={{ gap: tokens.space.sm }}>
                  <Field
                    label="Quest title"
                    value={title}
                    maxLength={120}
                    onChangeText={setTitle}
                  />
                  <Field
                    label="Quest description"
                    value={description}
                    maxLength={500}
                    onChangeText={setDescription}
                    multiline
                  />
                </View>
              )}
            </View>
          )}
          {!choices.length ? (
            <View style={{ gap: tokens.space.xs, alignItems: "flex-start" }}>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                No ideas match these filters.
              </Text>
              <Button
                compact
                secondary
                title="Clear activity filter"
                onPress={() => setFilter("Any Activity")}
              />
            </View>
          ) : onlyCurrentMatch ? (
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              This is the only idea that matches. Change the filters for more.
            </Text>
          ) : confirmReroll ? (
            <View style={{ gap: tokens.space.xs }}>
              <Text style={styles.body}>Replace this idea and its edits?</Text>
              <View style={wrap}>
                <Button compact title="Replace and roll" onPress={roll} />
                <Button
                  compact
                  secondary
                  title="Keep idea"
                  onPress={() => setConfirmReroll(false)}
                />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "flex-start", gap: tokens.space.xs }}>
              {filteredOut && (
                <Text style={styles.label}>
                  Your next roll will use the new filters.
                </Text>
              )}
              <Button
                compact
                secondary
                title={quest ? "Try another" : "Generate idea"}
                onPress={() => (changed ? setConfirmReroll(true) : roll())}
                icon={<RotateCw size={16} color={colors.accent} />}
              />
            </View>
          )}
          {quest && (
            <>
              {!editing && (
                <Button
                  title="Create Beacon"
                  disabled={!viewer || !title.trim()}
                  icon={<Flag size={17} color={colors.onAccent} />}
                  onPress={() => openEditor("beacon")}
                />
              )}
              <View style={wrap}>
                {!editing && (
                  <Button
                    title="Ask friends (Ping)"
                    compact
                    secondary
                    disabled={!viewer || !title.trim()}
                    icon={<Zap size={15} color={colors.accent} />}
                    onPress={() => openEditor("ping")}
                  />
                )}
                <Button
                  title={editing ? "Done editing" : "Edit idea"}
                  compact
                  secondary
                  icon={<Pencil size={14} color={colors.textSecondary} />}
                  onPress={() => setEditing(!editing)}
                />
              </View>
            </>
          )}
          {!!error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
        </View>
      </Screen>
    </ChatKeyboardFrame>
  );
}
