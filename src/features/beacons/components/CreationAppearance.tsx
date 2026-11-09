import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Chips, useTheme } from "@/src/shared/ui";
import type { BeaconControlValues } from "../controls";
import { DECORATION_ACCENTS, DECORATION_EMOJIS } from "../controls";
import type { Category } from "@/src/shared/types";
import { BeaconIcon } from "./BeaconIcon";
import {
  BeaconCardArtwork,
  beaconArtworkStyles,
  type BeaconArtworkStyle,
} from "./BeaconCardArtwork";

export function CardAppearancePreview({
  category,
  value,
}: {
  category: Category;
  value: BeaconControlValues;
}) {
  const { styles } = useTheme();
  const [variant, setVariant] = useState<BeaconArtworkStyle>("Constellation");
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Card Appearance · Preview only</Text>
      <View style={[styles.card, styles.row, { borderRadius: 12 }]}>
        <BeaconCardArtwork
          category={category}
          accent={value.decoration_accent}
          variant={variant}
          radius={12}
        />
        <BeaconIcon
          category={category}
          emoji={value.decoration_emoji}
          size={34}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>{category}</Text>
          <Text style={styles.body}>Beacon card preview</Text>
        </View>
      </View>
      <Chips
        accessibilityPrefix="Card background"
        options={beaconArtworkStyles}
        value={variant}
        onChange={setVariant}
      />
    </View>
  );
}

export function CreationAppearance({
  category,
  value,
  onChange,
}: {
  category: Category;
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
      <CardAppearancePreview category={category} value={value} />
    </View>
  );
}
