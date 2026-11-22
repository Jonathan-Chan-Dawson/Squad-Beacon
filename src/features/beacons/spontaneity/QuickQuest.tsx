import { Dices, RotateCw } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, useTheme } from "@/src/shared/ui";
import { QuestPreview } from "./QuestPreview";
import { questBeaconFields, rollQuest, sideQuests, type SideQuest } from "./quests";

export function QuickQuest({
  replacesText, onApply,
}: {
  replacesText: boolean;
  onApply: (fields: ReturnType<typeof questBeaconFields>) => void;
}) {
  const { semanticColors: colors, styles, tokens } = useTheme();
  const [quest, setQuest] = useState<SideQuest>();
  const [recent, setRecent] = useState<string[]>([]);

  function roll() {
    const next = rollQuest(sideQuests, recent);
    if (!next) return;
    setRecent([next.id, ...recent].slice(0, 5));
    setQuest(next);
  }

  if (!quest) {
    return (
      <View style={{ alignSelf: "flex-start" }}>
        <Button title="Surprise Me" compact secondary onPress={roll}
          icon={<Dices size={16} color={colors.accent} />} />
      </View>
    );
  }
  return (
    <View testID="quick-quest-preview" style={{
      gap: tokens.space.sm, padding: tokens.space.md, borderRadius: tokens.radius.md,
      backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    }}>
      <QuestPreview quest={quest} compact />
      {replacesText && <Text style={styles.label}>Applying this idea replaces the title and description in your draft.</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs }}>
        <Button title="Use This Idea" compact onPress={() => {
          onApply(questBeaconFields(quest));
          setQuest(undefined);
        }} />
        <Button title="Reroll" compact secondary onPress={roll}
          icon={<RotateCw size={15} color={colors.accent} />} />
        <Button title="Cancel" compact secondary onPress={() => setQuest(undefined)} />
      </View>
    </View>
  );
}
