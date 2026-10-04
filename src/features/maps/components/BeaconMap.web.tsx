import { activityTones } from "@/src/features/beacons/ActivityBadge";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { LocateFixed, Minus, Plus } from "lucide-react-native";
import type * as Leaflet from "leaflet";
import "@/components/leaflet.web.css";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import { locationIsFresh } from "@/src/shared/domain";
import { usePreferences } from "@/src/shared/preferences";
import { useTheme } from "@/src/shared/ui";
import {
  clusterMapPoints,
  markerVisualSize,
} from "@/src/features/maps/cluster";
export default function BeaconMap(props: MapProps) {
  const { colors } = useTheme();

  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    library = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    latest = useRef(props),
    fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
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
      m.on("move", updateAnchor);
      m.on("moveend zoomend resize", () => {
        updateAnchor();
        latest.current.onViewportChange?.();
        setViewVersion((version) => version + 1);
      });
      m.on("click", (e) => {
        if (latest.current.onPick)
          latest.current.onPick(e.latlng.lat, e.latlng.lng);
        else latest.current.onMapTap?.();
      });
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
    onCluster,
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
      const visualSize = markerVisualSize(
        friend ? "person" : "beacon",
        map.current?.getZoom() ?? 13,
      );
      node.type = "button";
      if (friend) {
        const img = document.createElement("img");
        img.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(miniAvatarSvg(seed));
        img.width = Math.max(16, visualSize - 4);
        img.height = Math.max(16, visualSize - 4);
        img.alt = "";
        node.append(img);
      }
      node.setAttribute("aria-label", label);
      node.title = label;
      node.style.cssText = `border:0;border-radius:50%;background:transparent;color:${colors.ink};padding:0;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font:600 16px system-ui;cursor:pointer;`;
      const visual = friend
        ? (node.firstElementChild as HTMLElement)
        : document.createElement("span");
      if (!friend) {
        visual.textContent = text;
        visual.style.cssText = `border:2px solid ${tone};border-radius:12px;background:${colors.white};width:${visualSize}px;height:${visualSize}px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;`;
        node.append(visual);
      } else {
        visual.style.cssText = `border:2px solid ${colors.white};border-radius:50%;width:${visualSize}px;height:${visualSize}px;box-shadow:0 3px 10px #172c2940;`;
      }

      L.DomEvent.disableClickPropagation(node);
      node.onclick = click;
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: node,
          className: "beacon-marker",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        title: label,
        keyboard: false,
      }).addTo(group);
      coordinates.push([lat, lng]);
    };
    const size = m.getSize();
    const center = m.getCenter();
    const clusterPoints = [
      ...places.flatMap((place) => {
        const activity = activities.find(
          (item) => item.id === place.activity_id,
        );
        return activity && place.latitude != null && place.longitude != null
          ? [
              {
                id: `beacon:${place.activity_id}`,
                kind: "beacon" as const,
                latitude: place.latitude,
                longitude: place.longitude,
              },
            ]
          : [];
      }),
      ...(showAvatars
        ? locations.flatMap((location) => {
            const profile = profiles.find(
              (item) => item.id === location.owner_id,
            );
            return profile &&
              locationIsFresh(location) &&
              location.latitude != null &&
              location.longitude != null
              ? [
                  {
                    id: `person:${location.owner_id}`,
                    kind: "person" as const,
                    latitude: location.latitude,
                    longitude: location.longitude,
                  },
                ]
              : [];
          })
        : []),
    ];
    const groups = clusterMapPoints(clusterPoints, {
      centerLatitude: center.lat,
      centerLongitude: center.lng,
      zoom: m.getZoom(),
      width: size.x,
      height: size.y,
    });
    const clustered = new Set(
      groups
        .filter((group) => group.members.length > 1)
        .flatMap((group) => group.members.map((member) => member.id)),
    );
    groups
      .filter((cluster) => cluster.members.length > 1)
      .forEach((cluster) => {
        const beaconCount = cluster.members.filter(
          (member) => member.kind === "beacon",
        ).length;
        const personCount = cluster.members.length - beaconCount;
        const node = document.createElement("button");
        node.type = "button";
        node.textContent = String(cluster.members.length);
        node.setAttribute(
          "aria-label",
          `Map cluster: ${beaconCount} beacons, ${personCount} people`,
        );
        node.style.cssText = `border:3px solid ${colors.lime};border-radius:50%;background:${colors.ink};color:${colors.white};width:44px;height:44px;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;box-shadow:0 3px 10px #172c2940;cursor:pointer;`;
        L.DomEvent.disableClickPropagation(node);
        node.onclick = () => onCluster?.(cluster);
        L.marker([cluster.latitude, cluster.longitude], {
          icon: L.divIcon({
            html: node,
            className: "beacon-marker",
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          keyboard: true,
        }).addTo(group);
        coordinates.push([cluster.latitude, cluster.longitude]);
      });
    places.forEach((p) => {
      const a = activities.find((a) => a.id === p.activity_id);
      if (
        a &&
        p.latitude != null &&
        p.longitude != null &&
        !clustered.has(`beacon:${p.activity_id}`)
      )
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
        .filter(
          (l) => locationIsFresh(l) && !clustered.has(`person:${l.owner_id}`),
        )
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
    if (!fitted.current && clusterPoints.length) {
      m.fitBounds(
        L.latLngBounds(
          clusterPoints.map(
            (point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple,
          ),
        ),
        {
          padding: [70, 100],
          maxZoom: 15,
        },
      );
      fitted.current = true;
    }
  }, [
    ready,
    viewVersion,
    colors,
    activities,
    places,
    locations,
    profiles,
    selected,
    showAvatars,
    onActivity,
    onPerson,
    onCluster,
  ]);
  const lat = focused?.latitude,
    lng = focused?.longitude;
  useEffect(() => {
    if (ready && lat != null && lng != null)
      map.current?.flyTo([lat, lng], 16, { duration: 0.5 });
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
