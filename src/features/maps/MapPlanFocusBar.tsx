import React from "react";
import { Text, View } from "react-native";
import { BookOpen, Maximize, Route, X } from "lucide-react-native";
import { IconButton } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/theme";

export function MapPlanFocusBar({ title, stopCount, onFit, onOpen, onExit }: {
  title: string;
  stopCount: number;
  onFit: () => void;
  onOpen: () => void;
  onExit: () => void;
}) {
  const { colors } = useDesignTheme();
  const ink = colors.onSecondaryContainer;
  return (
    <View
      testID="map-plan-focus"
      style={{
        width: "100%",
        maxWidth: 396,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 10,
        paddingRight: 3,
        borderRadius: 14,
        backgroundColor: colors.secondaryContainer,
      }}
    >
      <Route size={17} color={ink} />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
        <Text testID="map-plan-filter-name" accessibilityLabel={`Plan: ${title}`} numberOfLines={1} ellipsizeMode="tail" style={{ color: ink, fontSize: 12, fontWeight: "700" }}>
          {title}
        </Text>
        <Text accessibilityLabel={stopCount ? `${stopCount} visible physical ${stopCount === 1 ? "stop" : "stops"}` : "No visible physical stops"} style={{ color: ink, fontSize: 10 }}>
          {stopCount ? `${stopCount} ${stopCount === 1 ? "stop" : "stops"}` : "No visible stops"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexShrink: 0, alignItems: "center" }}>
        <IconButton label="Fit Plan" onPress={onFit} disabled={!stopCount}>
          <Maximize size={15} color={ink} />
        </IconButton>
        <IconButton label="View Plan" onPress={onOpen}>
          <BookOpen size={15} color={ink} />
        </IconButton>
        <IconButton label="Exit Plan Focus" onPress={onExit}>
          <X size={16} color={ink} />
        </IconButton>
      </View>
    </View>
  );
}
