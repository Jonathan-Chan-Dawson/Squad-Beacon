import React, { useState } from "react";
import { Image } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Category } from "@/src/shared/types";
import { beaconPinImage, beaconPinPath } from "../beaconPinArtwork";

export function BeaconPinGlyph({
  category,
  icon,
  size,
  color,
}: {
  category: Category;
  icon?: string | null;
  size: number;
  color: string;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = beaconPinImage(icon);
  const showImage = !!image && failedImage !== image;
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Path
          d={beaconPinPath(category, icon)}
          fill="none"
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {showImage ? (
        <Image
          accessible={false}
          source={{ uri: image }}
          onError={() => setFailedImage(image)}
          style={{
            position: "absolute",
            width: size + 5,
            height: size + 5,
            borderRadius: 7,
          }}
        />
      ) : null}
    </>
  );
}
