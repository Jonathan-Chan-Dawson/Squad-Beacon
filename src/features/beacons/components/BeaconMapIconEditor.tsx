import React, { useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Button, useTheme } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/theme";
import type { Category } from "@/src/shared/types";
import { BeaconPinGlyph } from "@/src/features/maps/components/BeaconPinGlyph";
import {
  beaconPinSymbols,
  makeBeaconPinImage,
} from "@/src/features/maps/beaconPinArtwork";

export function BeaconMapIconEditor({
  category,
  value,
  shared,
  onChange,
}: {
  category: Category;
  value: string | null;
  shared: boolean;
  onChange: (icon: string | null, shared: boolean) => void;
}) {
  const { styles, colors } = useTheme();
  const { categories } = useDesignTheme();
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function chooseImage() {
    setUploading(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (
        !asset ||
        (asset.fileSize ?? 0) > 12_000_000 ||
        !asset.width ||
        !asset.height
      )
        throw new Error("Choose an image under 12 MB.");
      const edge = Math.min(asset.width, asset.height);
      const crop = ImageManipulator.manipulate(asset.uri);
      crop.crop({
        originX: Math.floor((asset.width - edge) / 2),
        originY: Math.floor((asset.height - edge) / 2),
        width: edge,
        height: edge,
      });
      crop.resize({ width: 96, height: 96 });
      const image = await crop.renderAsync();
      const thumbnail = await image.saveAsync({
        base64: true,
        format: SaveFormat.JPEG,
        compress: 0.65,
      });
      const icon = makeBeaconPinImage(thumbnail.base64 ?? "");
      if (!icon) throw new Error("Try a different image for this pin.");
      onChange(icon, shared);
      setChoosing(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not use this image.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Map icon</Text>
      <View
        accessibilityLabel="Map pin preview"
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: categories[category].color,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BeaconPinGlyph
          category={category}
          icon={value}
          size={22}
          color={colors.ink}
        />
      </View>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Button
          compact
          secondary
          title="Category default"
          disabled={uploading}
          onPress={() => onChange(null, false)}
        />
        <Button
          compact
          secondary
          title={choosing ? "Hide icons" : "Choose an icon"}
          disabled={uploading}
          onPress={() => setChoosing(!choosing)}
        />
        <Button
          compact
          secondary
          title={uploading ? "Preparing image…" : "Upload an image"}
          disabled={uploading}
          onPress={() => void chooseImage()}
        />
      </View>
      {choosing && (
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          {Object.keys(beaconPinSymbols).map((icon) => (
            <Button
              key={icon}
              compact
              secondary
              title={icon[0].toUpperCase() + icon.slice(1)}
              icon={
                <BeaconPinGlyph
                  category={category}
                  icon={icon}
                  size={16}
                  color={colors.ink}
                />
              }
              onPress={() => {
                onChange(icon, shared);
                setChoosing(false);
              }}
            />
          ))}
        </View>
      )}
      {value && (
        <Button
          compact
          secondary
          title={
            shared
              ? "Use default icon in public discovery"
              : "Show custom icon in public discovery"
          }
          onPress={() => onChange(value, !shared)}
          disabled={uploading}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
