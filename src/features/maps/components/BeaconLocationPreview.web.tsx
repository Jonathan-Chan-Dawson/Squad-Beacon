import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import Constants from "expo-constants";
import { useDesignTheme } from "@/src/shared/design-system";
import { isValidCoordinate } from "@/src/shared/exploration";
import { cartoTileUrl } from "@/src/theme/map";
import type { BeaconLocationPreviewProps } from "./BeaconLocationPreview";
import "@/components/leaflet.web.css";

export function BeaconLocationPreview({
  latitude,
  longitude,
  label,
  compact = false,
  onPress,
}: BeaconLocationPreviewProps) {
  const { colors, resolvedAppearance } = useDesignTheme();
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const configuredKey = Constants.expoConfig?.extra?.cartoBasemapsApiKey;
  const apiKey = typeof configuredKey === "string" ? configuredKey : undefined;
  const valid = isValidCoordinate({ latitude, longitude });
  useEffect(() => {
    if (!compact || !valid || !element.current) return;
    let active = true;
    let destroy: (() => void) | undefined;
    void import("leaflet")
      .then((L) => {
        if (!active || !element.current) return;
        const map = L.map(element.current, {
          center: [latitude, longitude],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false,
        });
        L.tileLayer(cartoTileUrl(resolvedAppearance, apiKey), { maxZoom: 19 })
          .on("tileerror", () => {
            if (active) setFailed(true);
          })
          .on("tileload", () => {
            if (active) setFailed(false);
          })
          .addTo(map);
        destroy = () => map.remove();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      destroy?.();
    };
  }, [apiKey, compact, latitude, longitude, resolvedAppearance, valid]);
  if (!compact || !valid) return null;
  return (
    <View style={{ width: 96, gap: 3 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${label || "Beacon location"} on Map`}
        onPress={onPress}
        disabled={!onPress}
        style={{
          height: 112,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={element}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: failed ? 0 : 1,
          }}
        />
        <View pointerEvents="none" style={{
          position: "absolute", inset: 0, zIndex: 1000,
          alignItems: "center", justifyContent: "center",
        }}>
        <MapPin
          size={23}
          color={colors.accent}
          fill={colors.surface}
          accessible={false}
          style={{ transform: [{ translateY: failed ? 0 : -8 }] }}
        />
        {failed && <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Open map</Text>}
        </View>
      </Pressable>
      <div
        style={{
          fontSize: 9,
          textAlign: "center",
          color: colors.textSecondary,
        }}
      >
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit" }}
        >
          OSM
        </a>{" "}
        ©{" "}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit" }}
        >
          CARTO
        </a>
      </div>
    </View>
  );
}
