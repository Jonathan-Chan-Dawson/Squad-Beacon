import { router, useFocusEffect, type Href } from "expo-router";
import { ChevronRight, RadioTower } from "lucide-react-native";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { IconButton, useTheme } from "@/src/shared/ui";

const spontaneityLabel = "I'm Bored, open Spontaneity Machine";

export function useSpontaneityEntry() {
  const opening = useRef(false);
  useFocusEffect(useCallback(() => {
    opening.current = false;
  }, []));
  return useCallback(() => {
    if (opening.current) return;
    opening.current = true;
    router.push("/spontaneity" as Href);
  }, []);
}

export function SpontaneityEntry({ compact = false }: { compact?: boolean }) {
  const open = useSpontaneityEntry();
  const { semanticColors: colors, styles, tokens } = useTheme();
  if (compact) {
    return (
      <IconButton label={spontaneityLabel} onPress={open}>
        <RadioTower size={20} color={colors.accent} />
      </IconButton>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spontaneityLabel}
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space.sm,
          padding: tokens.space.sm,
          backgroundColor: pressed ? colors.surfaceSelected : colors.surfaceRaised,
        },
      ]}
    >
      <View style={{
        padding: tokens.space.sm,
        borderRadius: tokens.radius.md,
        backgroundColor: colors.surfaceSelected,
      }}>
        <RadioTower size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.h2}>I’m Bored</Text>
        <Text style={styles.label}>Roll a side quest</Text>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
