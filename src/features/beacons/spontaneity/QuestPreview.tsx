import { Clock3 } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTheme } from "@/src/shared/ui";
import { ActivityBadge } from "../ActivityBadge";
import { formatDurationLabel } from "../createTiming";
import type { SideQuest } from "./quests";

export function QuestPreview({
  quest, title = quest.title, description = quest.description, compact = false,
}: {
  quest: SideQuest;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  const { semanticColors: colors, styles, tokens } = useTheme();
  const tone = tokens.categories[quest.category];
  const labels = compact ? [quest.category] : [...new Set([quest.vibe, quest.activity])];
  return (
    <View style={{ gap: tokens.space.sm }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space.sm }}>
        {compact ? (
          <ActivityBadge category={quest.category} size={38} />
        ) : (
          <View style={{
            width: 48, height: 48, borderRadius: tokens.radius.md,
            backgroundColor: tone.tint, alignItems: "center", justifyContent: "center",
          }}>
            <Text accessible={false} style={{ fontSize: 24 }}>{quest.icon}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>{labels.join(" · ")}</Text>
          <Text testID="side-quest-title" accessibilityRole="header" style={styles.h2}>{title}</Text>
        </View>
      </View>
      {!!description && <Text style={[styles.body, { color: colors.textSecondary }]}>{description}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Clock3 size={14} color={colors.textSecondary} />
        <Text style={styles.label}>{formatDurationLabel(quest.minutes)} suggested</Text>
      </View>
    </View>
  );
}
