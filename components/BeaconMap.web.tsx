import { activityTones } from "@/src/ActivityBadge";
import { miniAvatarSvg, avatarSeed } from "@/src/avatarArt";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { LocateFixed, Minus, Plus } from "lucide-react-native";
import type * as Leaflet from "leaflet";
import "./leaflet.web.css";
import type { MapProps } from "./BeaconMap";
import { locationIsFresh } from "@/src/domain";
import { usePreferences } from "@/src/preferences";
import { useTheme } from "@/src/ui";
export default function BeaconMap(props: MapProps) {
  const { colors } = useTheme();

  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    library = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    latest = useRef(props),
    fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const { showAvatars } = usePreferences();
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !element.current) return;
      library.current = L;
      const m = L.map(element.current, { zoomControl: false }).setView(
        [41.885, -87.642],
        13,
      );
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      L.control.scale({ position: "bottomleft" }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      const updateAnchor = () => {
        const p = latest.current.focused;
        latest.current.onAnchor?.(
          p ? m.latLngToContainerPoint([p.latitude, p.longitude]) : null,
        );
      };
      m.on("move zoom resize", updateAnchor);
      m.on("click", (e) => latest.current.onPick?.(e.latlng.lat, e.latlng.lng));
      setReady(true);
    });
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    if (element.current) resize.observe(element.current);
    return () => {
      active = false;
      resize.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  const {
    activities,
    places,
    locations,
    profiles,
    selected,
    focused,
    fullScreen,
    controlsTop = 12,
    onActivity,
    onPerson,
  } = props;
  useEffect(() => {
    const L = library.current,
      m = map.current,
      group = layer.current;
    if (!ready || !L || !m || !group) return;
    group.clearLayers();
    const coordinates: Leaflet.LatLngTuple[] = [];
    const marker = (
      lat: number,
      lng: number,
      text: string,
      label: string,
      click: () => void,
      friend = false,
      seed = 0,
      tone = colors.green,
    ) => {
      const node = document.createElement("button");
      node.type = "button";
      if (friend) {
        const img = document.createElement("img");
        img.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(miniAvatarSvg(seed));
        img.width = 48;
        img.height = 48;
        img.alt = "";
        node.append(img);
      } else node.textContent = text;
      node.setAttribute("aria-label", label);
      node.title = label;
      node.style.cssText = `border:2px solid ${friend ? colors.white : tone};border-radius:${friend ? "50%" : "16px"};background:${colors.white};color:${colors.ink};padding:0;width:${friend ? 54 : 44}px;height:${friend ? 54 : 44}px;display:flex;align-items:center;justify-content:center;font:600 22px system-ui;box-shadow:0 3px 10px #172c2940;cursor:pointer;`;

      L.DomEvent.disableClickPropagation(node);
      node.onclick = click;
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: node,
          className: "beacon-marker",
          iconSize: [friend ? 54 : 44, friend ? 54 : 44],
          iconAnchor: [24, 22],
        }),
        title: label,
        keyboard: false,
      }).addTo(group);
      coordinates.push([lat, lng]);
    };
    places.forEach((p) => {
      const a = activities.find((a) => a.id === p.activity_id);
      if (a && p.latitude != null && p.longitude != null)
        marker(
          p.latitude,
          p.longitude,
          {
            Fitness: "\uD83C\uDFC0",
            Study: "\uD83D\uDCDA",
            Gaming: "\uD83C\uDFAE",
            Creative: "\uD83C\uDFA8",
            Social: "\u2615",
            Other: "\u2728",
          }[a.category],
          `Map: ${a.title}`,
          () => onActivity(a.id),
          false,
          0,
          activityTones[a.category],
        );
    });
    if (showAvatars)
      locations
        .filter((l) => locationIsFresh(l))
        .forEach((l) => {
          const p = profiles.find((p) => p.id === l.owner_id);
          if (p && l.latitude != null && l.longitude != null)
            marker(
              l.latitude,
              l.longitude,
              p.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join(""),
              `Map friend: ${p.name}`,
              () => onPerson(p.id),
              true,
              p.avatar_seed ?? avatarSeed(p.id),
            );
        });
    if (selected)
      L.marker([selected.latitude, selected.longitude], {
        icon: L.divIcon({
          html: "<span style='font-size:30px;color:#26735A'>+</span>",
          className: "beacon-marker",
        }),
      }).addTo(group);
    if (!fitted.current && coordinates.length) {
      m.fitBounds(L.latLngBounds(coordinates), {
        padding: [70, 100],
        maxZoom: 15,
      });
      fitted.current = true;
    }
  }, [
    ready,
    colors,
    activities,
    places,
    locations,
    profiles,
    selected,
    showAvatars,
    onActivity,
    onPerson,
  ]);
  const lat = focused?.latitude,
    lng = focused?.longitude;
  useEffect(() => {
    if (ready && lat != null && lng != null)
      map.current?.flyTo([lat, lng], 15, { duration: 0.5 });
  }, [ready, lat, lng]);
  function fit() {
    const L = library.current;
    const points = places
      .filter(
        (p) =>
          p.latitude != null &&
          p.longitude != null &&
          activities.some((a) => a.id === p.activity_id),
      )
      .map((p) => [p.latitude!, p.longitude!] as Leaflet.LatLngTuple);
    if (L && points.length)
      map.current?.fitBounds(L.latLngBounds(points), {
        padding: [70, 100],
        maxZoom: 15,
      });
  }
  return (
    <View
      style={{
        height: fullScreen ? "100%" : 300,
        width: "100%",
        overflow: "hidden",
        borderRadius: fullScreen ? 0 : 24,
      }}
    >
      <div
        ref={element}
        aria-label="Beacon map"
        className={colors.bg === "#151C30" ? "map-midnight" : "map-day"}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: "#E6ECDD",
        }}
      />
      <View
        style={{ position: "absolute", top: controlsTop, right: 16, gap: 8 }}
      >
        {[
          { label: "Fit all beacons", Icon: LocateFixed },
          { label: "Zoom in", Icon: Plus },
          { label: "Zoom out", Icon: Minus },
        ].map(({ label, Icon }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => {
              if (label === "Fit all beacons") fit();
              else if (label === "Zoom in") map.current?.zoomIn();
              else map.current?.zoomOut();
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.white,
            }}
          >
            <Icon size={20} color={colors.ink} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
