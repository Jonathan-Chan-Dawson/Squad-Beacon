import type { ResolvedAppearance } from "@/src/theme/palettes";

/** Muted, palette-aware Google Maps JSON styles used on Android. */
export function googleMapStyles(appearance: ResolvedAppearance) {
  const dark = appearance === "dark";
  return [
    {
      elementType: "geometry",
      stylers: [{ color: dark ? "#172126" : "#EEF1EA" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: dark ? "#B7C2C1" : "#65716F" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: dark ? "#172126" : "#EEF1EA" }],
    },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: dark ? "#394747" : "#D1D8D0" }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: dark ? "#202C30" : "#E9EEE5" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: dark ? "#243431" : "#E1EADD" }],
    },
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "simplified" }],
    },
    {
      featureType: "poi.business",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: dark ? "#39484C" : "#FFFFFF" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: dark ? "#2B383C" : "#D7DED6" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: dark ? "#C3CECC" : "#687471" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: dark ? "#344B50" : "#D8E3DC" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: dark ? "#263F55" : "#C8DEE3" }],
    },
  ];
}

export function cartoTileUrl(appearance: ResolvedAppearance) {
  const style = appearance === "dark" ? "dark_all" : "light_all";
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
}

export const cartoAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
