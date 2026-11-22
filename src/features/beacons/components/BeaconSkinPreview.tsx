import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Chips, Txt, useTheme } from "@/src/shared/ui";
import { MapProjector } from "@/src/features/maps/components/MapProjector";
import type { Category } from "@/src/shared/types";
import { BeaconIcon } from "./BeaconIcon";

const skins = {
  Classic: {
    frame: "#65E5E8",
    beam: "#65E5E8",
    accent: "",
    description: "Free default projector",
  },
  Aurora: {
    frame: "#B19AFF",
    beam: "#75F3CD",
    accent: "✧",
    description: "Lavender lens with a mint beam",
  },
  Prism: {
    frame: "#9AC2FF",
    beam: "#F3A6DD",
    accent: "◇",
    description: "Iridescent frame and rose light",
  },
  Ember: {
    frame: "#FFA878",
    beam: "#FFC266",
    accent: "✦",
    description: "Warm amber beam",
  },
  Celestial: {
    frame: "#C6BBFF",
    beam: "#A2CAFF",
    accent: "✦ · ✧",
    description: "Star accents and cool light",
  },
  Legendary: {
    frame: "#FFE097",
    beam: "#FFC45A",
    accent: "♛",
    description: "Gold frame and crown accent",
  },
} as const;
const names = Object.keys(skins) as (keyof typeof skins)[];

export function BeaconSkinPreview({
  category = "Social",
}: {
  category?: Category;
}) {
  const { styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<keyof typeof skins>("Classic");
  const skin = skins[selected];
  return (
    <View style={{ gap: 8 }}>
      <Button
        compact
        secondary
        title={open ? "Hide skin previews" : "Preview Beacon skins"}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <View
            style={{
              backgroundColor: "#171E33",
              borderRadius: 14,
              alignItems: "center",
              minHeight: 142,
              paddingTop: 15,
            }}
          >
            <View
              style={{
                width: 112,
                height: 112,
                alignItems: "center",
                paddingTop: 12,
              }}
            >
              <MapProjector
                kind="beacon"
                color={skin.beam}
                top={62}
                center={56}
                width={76}
                height={31}
                opacity={1}
              />
              <View
                style={{
                  width: 58,
                  height: 58,
                  backgroundColor: "#262D48",
                  borderWidth: 2,
                  borderColor: skin.frame,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BeaconIcon category={category} size={32} />
              </View>
              {!!skin.accent && (
                <Text
                  style={{
                    position: "absolute",
                    top: 0,
                    color: skin.frame,
                    fontSize: 17,
                  }}
                >
                  {skin.accent}
                </Text>
              )}
            </View>
          </View>
          <Chips options={names} value={selected} onChange={setSelected} />
          <Text style={styles.body}>{skin.description}</Text>
          <Txt muted>
            Beacon Coins · Purchases and equipping are unavailable during
            previews.
          </Txt>
        </>
      )}
    </View>
  );
}
