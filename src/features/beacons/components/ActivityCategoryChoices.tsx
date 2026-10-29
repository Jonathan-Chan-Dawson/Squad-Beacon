import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Briefcase,
  Check,
  ChevronDown,
  Headphones,
  Moon,
  TreePine,
  Utensils,
  Footprints,
} from "lucide-react-native";
import type { Category } from "@/src/shared/types";
import { useTheme } from "@/src/shared/ui";
import { BeaconIcon } from "./BeaconIcon";

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
// Friendly starting points retain the existing stored category and filtering contracts.
const ideas: { title: string; category: Category; icon: typeof Footprints }[] =
  [
    { title: "Walking", category: "Fitness", icon: Footprints },
    { title: "Outdoors", category: "Fitness", icon: TreePine },
    { title: "Food", category: "Social", icon: Utensils },
    { title: "Music", category: "Creative", icon: Headphones },
    { title: "Work", category: "Study", icon: Briefcase },
    { title: "Rest", category: "Other", icon: Moon },
  ];

export function ActivityCategoryChoices({
  value,
  onChange,
}: {
  value: Category;
  onChange(category: Category, idea?: string): void;
}) {
  const { styles, semanticColors: colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View
        accessibilityLabel="Activity category"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
      >
        {categories.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={category}
            accessibilityState={{ selected: value === category }}
            aria-pressed={value === category}
            onPress={() => onChange(category)}
            style={{
              width: "31%",
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: value === category ? colors.accent : colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <BeaconIcon category={category} size={18} />
            <Text style={[styles.body, { fontSize: 12 }]}>{category}</Text>
            {value === category && <Check size={12} color={colors.accent} />}
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? "See fewer activity choices" : "See more activity choices"
        }
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
          alignSelf: "flex-start",
        }}
      >
        <Text style={styles.muted}>{expanded ? "See less" : "See more"}</Text>
        <ChevronDown
          size={14}
          color={colors.textSecondary}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {expanded && (
        <View style={{ gap: 4 }}>
          <Text style={styles.muted}>
            More ways to spend your time. Each uses a category above.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ideas.map(({ title, category, icon: Icon }) => (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${category} category`}
                onPress={() => onChange(category, title)}
                style={{
                  width: "48%",
                  minHeight: 44,
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Icon size={18} color={colors.textSecondary} />
                <View>
                  <Text style={styles.body}>{title}</Text>
                  <Text style={styles.muted}>{category}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
