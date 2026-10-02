import React from "react";
import { View } from "react-native";
import {
  Dumbbell,
  BookOpen,
  Gamepad2,
  Palette,
  Coffee,
  Sparkles,
} from "lucide-react-native";
import type { Category } from "@/src/shared/types";
export const activityTones = {
  Fitness: "#E99663",
  Study: "#839DDC",
  Gaming: "#AC89DB",
  Creative: "#D67CA6",
  Social: "#5EB29C",
  Other: "#9BAB70",
};
export function ActivityBadge({
  category,
  size = 40,
}: {
  category: Category;
  size?: number;
}) {
  const Icon = {
    Fitness: Dumbbell,
    Study: BookOpen,
    Gaming: Gamepad2,
    Creative: Palette,
    Social: Coffee,
    Other: Sparkles,
  }[category];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        backgroundColor: activityTones[category] + "28",
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "-5deg" }],
      }}
    >
      <Icon size={size * 0.5} color={activityTones[category]} />
    </View>
  );
}
