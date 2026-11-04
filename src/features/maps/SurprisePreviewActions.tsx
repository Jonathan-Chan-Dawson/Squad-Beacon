import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/src/shared/ui";

/** Map-owned accessory; ordinary Beacon previews never receive these actions. */
export function SurprisePreviewActions({
  visible,
  selectionId,
  canTryAnother,
  canReturn,
  onTryAnother,
  onBack,
}: {
  visible: boolean;
  selectionId: string;
  canTryAnother: boolean;
  canReturn: boolean;
  onTryAnother(eventTime: number): void;
  onBack(): void;
}) {
  const { colors, styles } = useTheme();
  if (!visible) return null;
  return (
    <View
      testID="map-surprise-actions"
      nativeID={`map-surprise-${selectionId}`}
      style={{ gap: 3, padding: 6 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try Another"
        accessibilityHint={
          canTryAnother
            ? "Discover another matching Beacon"
            : "Only one eligible Beacon in this area"
        }
        accessibilityState={{ disabled: !canTryAnother }}
        disabled={!canTryAnother}
        onPress={() => onTryAnother(Date.now())}
        style={{
          minHeight: 44,
          justifyContent: "center",
          alignItems: "center",
          opacity: canTryAnother ? 1 : 0.5,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: "600" }}>
          Try Another
        </Text>
      </Pressable>
      {!canTryAnother && (
        <Text style={styles.muted}>Only one eligible Beacon in this area.</Text>
      )}
      {canReturn && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Previous View"
          onPress={onBack}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={styles.muted}>Back to Previous View</Text>
        </Pressable>
      )}
    </View>
  );
}
