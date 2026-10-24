import React from "react";
import { Text, View } from "react-native";
import { Button, Chips, useTheme } from "@/src/shared/ui";
import type { BeaconControlValues } from "../controls";
import { DECORATION_ACCENTS, DECORATION_EMOJIS } from "../controls";
export function CreationAppearance({
  value,
  onChange,
}: {
  value: BeaconControlValues;
  onChange: (value: BeaconControlValues) => void;
}) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Artwork</Text>
      <Button
        compact
        secondary
        title="Use category artwork"
        onPress={() => onChange({ ...value, decoration_emoji: null })}
      />
      <Chips
        options={[...DECORATION_EMOJIS]}
        value={value.decoration_emoji ?? ""}
        onChange={(emoji) =>
          onChange({
            ...value,
            decoration_emoji: emoji as BeaconControlValues["decoration_emoji"],
          })
        }
      />
      <Text style={styles.label}>Accent</Text>
      <Chips
        options={[...DECORATION_ACCENTS]}
        value={value.decoration_accent ?? "neutral"}
        onChange={(accent) =>
          onChange({
            ...value,
            decoration_accent:
              accent as BeaconControlValues["decoration_accent"],
          })
        }
      />
    </View>
  );
}
