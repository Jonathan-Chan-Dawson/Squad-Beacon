import { activityTones } from "@/src/features/beacons/ActivityBadge";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { LocateFixed, SlidersHorizontal } from "lucide-react-native";
import type * as Leaflet from "leaflet";
import "@/components/leaflet.web.css";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import { locationIsFresh } from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import { usePreferences } from "@/src/shared/preferences";
import { useTheme } from "@/src/shared/ui";
import {
  clusterMapPoints,
  markerVisualSize,
  rankClusterMembers,
  clusterPreviewOverflow,
} from "@/src/features/maps/cluster";

function hasUsableMapViewport(map: Leaflet.Map | null | undefined) {
  if (!map) return false;
  const container = map.getContainer();
  if (!container.isConnected) return false;
  const bounds = container.getBoundingClientRect();
  const size = map.getSize();
  return (
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    Number.isFinite(size.x) &&
    Number.isFinite(size.y) &&
    size.x > 0 &&
    size.y > 0
  );
}

function isValidMapZoom(zoom: number) {
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= 22;
}

function hasValidInsets(top: number, right: number, bottom: number, left: number) {
  return [top, right, bottom, left].every(
    (value) => Number.isFinite(value) && value >= 0,
  );
}

export default function BeaconMap(props: MapProps) {
  const { colors, resolvedAppearance } = useTheme();

  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    library = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    latest = useRef(props),
    fitted = useRef(false),
    appliedFocusedTarget = useRef<string | null>(null),
    appliedTargetRevision = useRef<number | null>(null),
    programmaticMove = useRef(false),
    gestureActive = useRef(false),
    removeGestureListeners = useRef<(() => void) | null>(null),
    appliedControlRevision = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
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
      // Satellite imagery is native-only; web deliberately stays on OSM tiles.
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
          p && hasUsableMapViewport(m)
            ? m.latLngToContainerPoint([p.latitude, p.longitude])
            : null,
        );
      };
      m.on("move", updateAnchor);
      const markGesture = () => {
        programmaticMove.current = false;
        gestureActive.current = true;
      };
      const markZoomGesture = () => {
        if (!programmaticMove.current) gestureActive.current = true;
      };
      const markPinchGesture = (event: TouchEvent) => {
        if (event.touches.length > 1) markGesture();
      };
      const container = m.getContainer();
      m.on("dragstart boxzoomstart", markGesture);
      m.on("zoomstart", markZoomGesture);
      container.addEventListener("wheel", markGesture, { passive: true });
      container.addEventListener("dblclick", markGesture);
      container.addEventListener("keydown", markGesture);
      container.addEventListener("touchstart", markPinchGesture, {
        passive: true,
      });
      removeGestureListeners.current = () => {
        container.removeEventListener("wheel", markGesture);
        container.removeEventListener("dblclick", markGesture);
        container.removeEventListener("keydown", markGesture);
        container.removeEventListener("touchstart", markPinchGesture);
      };
      m.on("moveend zoomend resize", () => {
        updateAnchor();
        const bounds = m.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        if (hasUsableMapViewport(m))
          latest.current.onViewportChange?.({
          center: { latitude: m.getCenter().lat, longitude: m.getCenter().lng },
          zoom: m.getZoom(),
          bounds: {
            north: northEast.lat,
            south: southWest.lat,
            east: northEast.lng,
            west: southWest.lng,
          },
          }, gestureActive.current && !programmaticMove.current);
        gestureActive.current = false;
        programmaticMove.current = false;
        setViewVersion((version) => version + 1);
      });
      m.on("click", (e) => {
        if (latest.current.onPick)
          latest.current.onPick(e.latlng.lat, e.latlng.lng);
        else latest.current.onMapTap?.();
      });
      setReady(true);
    });
    const resize = new ResizeObserver(() => {
      map.current?.invalidateSize();
      setLayoutVersion((version) => version + 1);
    });
    if (element.current) resize.observe(element.current);
    return () => {
      active = false;
      resize.disconnect();
      removeGestureListeners.current?.();
      removeGestureListeners.current = null;
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
    hideControls = false,
    controlsTop = 12,
    viewportInsets,
    onActivity,
    onPerson,
    onCluster,
    clusterPriorities = {},
    explorationTarget,
    onOptions,
    onRecenter,
    onPick,
    controlCommand,
  } = props;
  const mapInsets = {
    top: viewportInsets?.top ?? (fullScreen ? controlsTop : 0),
    right: viewportInsets?.right ?? 0,
    bottom: viewportInsets?.bottom ?? 0,
    left: viewportInsets?.left ?? 0,
  };
  const adjustedMapCenter = useCallback(
    (latitude: number, longitude: number, zoom: number) => {
      const L = library.current;
      const currentMap = map.current;
      if (
        !L ||
        !currentMap ||
        !hasUsableMapViewport(currentMap) ||
        !isValidCoordinate({ latitude, longitude }) ||
        !isValidMapZoom(zoom) ||
        ![
          mapInsets.top,
          mapInsets.right,
          mapInsets.bottom,
          mapInsets.left,
        ].every((value) => Number.isFinite(value) && value >= 0)
      )
        return undefined;
      const offsetX = (mapInsets.left - mapInsets.right) / 2;
      const offsetY = (mapInsets.top - mapInsets.bottom) / 2;
      const center = currentMap.unproject(
        currentMap.project([latitude, longitude], zoom).subtract(
          L.point(offsetX, offsetY),
        ),
        zoom,
      );
      return isValidCoordinate({
        latitude: center.lat,
        longitude: center.lng,
      })
        ? center
        : undefined;
    },
    [mapInsets.bottom, mapInsets.left, mapInsets.right, mapInsets.top],
  );
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
      node.style.cssText = `position:relative;border:0;border-radius:50%;background:transparent;color:${colors.ink};padding:0;width:44px;height:${friend ? 44 : 56}px;display:flex;align-items:${friend ? "center" : "flex-start"};justify-content:center;font:600 16px system-ui;cursor:pointer;`;
      const visual = friend
        ? (node.firstElementChild as HTMLElement)
        : document.createElement("span");
      if (!friend) {
        const point = document.createElement("span");
        point.style.cssText = `position:absolute;top:${visualSize - 5}px;width:13px;height:13px;background:${tone};transform:rotate(45deg);border-radius:3px;`;
        node.append(point);
        visual.textContent = text;
        visual.style.cssText = `position:relative;border:2px solid ${tone};border-radius:50%;background:${colors.white};width:${visualSize}px;height:${visualSize}px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;`;
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
          iconSize: [44, friend ? 44 : 56],
          iconAnchor: [22, friend ? 22 : 56],
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
        return activity &&
          place.online_url == null &&
          place.latitude != null &&
          place.longitude != null &&
          isValidCoordinate({
            latitude: place.latitude,
            longitude: place.longitude,
          })
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
              location.longitude != null &&
              isValidCoordinate({
                latitude: location.latitude,
                longitude: location.longitude,
              })
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
        const ranked = rankClusterMembers(cluster.members, clusterPriorities);
        const previewLabels = ranked
          .slice(0, 3)
          .map((member) =>
            member.kind === "beacon"
              ? activities.find(
                  (candidate) => `beacon:${candidate.id}` === member.id,
                )?.title
              : profiles.find(
                  (candidate) => `person:${candidate.id}` === member.id,
                )?.name,
          )
          .filter((label): label is string => !!label);
        const node = document.createElement("button");
        node.type = "button";
        ranked.slice(0, 3).forEach((member, index) => {
          const thumb = document.createElement("span");
          thumb.style.cssText = `width:30px;height:30px;margin-left:${index ? -6 : 0}px;border:2px solid ${colors.white};border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none;position:relative;z-index:${4 - index};`;
          if (member.kind === "person") {
            const profile = profiles.find(
              (candidate) => `person:${candidate.id}` === member.id,
            );
            if (profile) {
              const img = document.createElement("img");
              img.src =
                "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(
                  miniAvatarSvg(profile.avatar_seed ?? avatarSeed(profile.id)),
                );
              img.alt = "";
              img.width = 26;
              img.height = 26;
              img.style.cssText = "border-radius:50%;";
              thumb.append(img);
            }
          } else {
            const activity = activities.find(
              (candidate) => `beacon:${candidate.id}` === member.id,
            );
            const icon = {
              Fitness: "🏀",
              Study: "📚",
              Gaming: "🎮",
              Creative: "🎨",
              Social: "☕",
              Other: "✨",
            }[activity?.category ?? "Other"];
            thumb.textContent = icon;
            thumb.style.background = colors.lime;
            thumb.style.fontSize = "15px";
          }
          node.append(thumb);
        });
        const overflow = clusterPreviewOverflow(cluster.members.length);
        if (overflow) {
          const more = document.createElement("span");
          more.textContent = `+${overflow}`;
          more.style.cssText = `margin-left:3px;color:${colors.ink};font:800 11px system-ui;`;
          node.append(more);
        }
        node.setAttribute(
          "aria-label",
          `Map cluster: ${beaconCount} beacons, ${personCount} people. Preview: ${previewLabels.join(", ")}${overflow ? `, plus ${overflow} more` : ""}`,
        );
        node.style.cssText = `border:2px solid ${colors.lime};border-radius:24px;background:${colors.white};color:${colors.ink};min-width:58px;height:42px;padding:0 7px;display:flex;align-items:center;justify-content:center;font:800 11px system-ui;box-shadow:0 3px 10px #172c2940;cursor:pointer;`;
        L.DomEvent.disableClickPropagation(node);
        node.onclick = () =>
          onCluster?.(
            cluster,
            m.latLngToContainerPoint([cluster.latitude, cluster.longitude]),
          );
        L.marker([cluster.latitude, cluster.longitude], {
          icon: L.divIcon({
            html: node,
            className: "beacon-marker",
            iconSize: [100, 44],
            iconAnchor: [50, 22],
          }),
          keyboard: true,
        }).addTo(group);
        coordinates.push([cluster.latitude, cluster.longitude]);
      });
    places.forEach((p) => {
      const a = activities.find((a) => a.id === p.activity_id);
      if (
        a &&
        p.online_url == null &&
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
        .filter(
          (location) =>
            location.latitude != null &&
            location.longitude != null &&
            isValidCoordinate({
              latitude: location.latitude,
              longitude: location.longitude,
            }),
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
    if (selected && isValidCoordinate(selected))
      L.marker([selected.latitude, selected.longitude], {
        icon: L.divIcon({
          html: `<span style="position:relative;width:34px;height:34px;border:2px solid ${colors.green};border-radius:50%;background:${colors.lime};display:flex;align-items:center;justify-content:center;color:${colors.green};font-size:22px;font-weight:700;box-shadow:0 3px 10px #172c2940"><span style="position:absolute;top:24px;z-index:-1;width:12px;height:12px;background:${colors.green};transform:rotate(45deg);border-radius:2px"></span>+</span>`,
          className: "beacon-marker",
          iconSize: [44, 50],
          iconAnchor: [22, 50],
        }),
      }).addTo(group);
    if (
      !fitted.current &&
      clusterPoints.length &&
      hasUsableMapViewport(m) &&
      hasValidInsets(
        mapInsets.top,
        mapInsets.right,
        mapInsets.bottom,
        mapInsets.left,
      )
    ) {
      programmaticMove.current = true;
      m.fitBounds(
        L.latLngBounds(
          clusterPoints.map(
            (point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple,
          ),
        ),
        {
          paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
          paddingBottomRight: [mapInsets.right + 24, mapInsets.bottom + 24],
          maxZoom: 15,
        },
      );
      fitted.current = true;
    }
  }, [
    ready,
    layoutVersion,
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
    clusterPriorities,
    mapInsets.bottom,
    mapInsets.left,
    mapInsets.right,
    mapInsets.top,
  ]);
  const lat = focused?.latitude,
    lng = focused?.longitude;
  useEffect(() => {
    if (lat == null || lng == null) {
      appliedFocusedTarget.current = null;
      return;
    }
    const focusKey = `${lat},${lng}`;
    if (appliedFocusedTarget.current === focusKey) return;
    const currentMap = map.current;
    if (ready && currentMap && hasUsableMapViewport(currentMap)) {
      const center = adjustedMapCenter(lat, lng, 16);
      if (center) {
        programmaticMove.current = true;
        currentMap.flyTo(center, 16, { duration: 0.5 });
        appliedFocusedTarget.current = focusKey;
      }
    }
  }, [ready, lat, lng, adjustedMapCenter, layoutVersion]);
  useEffect(() => {
    if (!ready || !explorationTarget || onPick) return;
    if (appliedTargetRevision.current === explorationTarget.revision) return;
    if (!isValidMapZoom(explorationTarget.zoom)) return;
    const center = adjustedMapCenter(
      explorationTarget.center.latitude,
      explorationTarget.center.longitude,
      explorationTarget.zoom,
    );
    if (center) {
      appliedTargetRevision.current = explorationTarget.revision;
      fitted.current = true;
      programmaticMove.current = true;
      map.current?.flyTo(center, explorationTarget.zoom, { duration: 0.45 });
    }
  }, [ready, explorationTarget, onPick, adjustedMapCenter, layoutVersion]);
  function recenter() {
    if (onRecenter) onRecenter();
    else fit();
  }
  const fit = useCallback(() => {
    const L = library.current;
    const currentMap = map.current;
    if (
      !L ||
      !currentMap ||
      !hasUsableMapViewport(currentMap) ||
      !hasValidInsets(
        mapInsets.top,
        mapInsets.right,
        mapInsets.bottom,
        mapInsets.left,
      )
    )
      return;
    const points = places
      .filter(
        (p) =>
          p.online_url == null &&
          p.latitude != null &&
          p.longitude != null &&
          isValidCoordinate({ latitude: p.latitude, longitude: p.longitude }) &&
          activities.some((a) => a.id === p.activity_id),
      )
      .map((p) => [p.latitude!, p.longitude!] as Leaflet.LatLngTuple);
    if (showAvatars)
      locations
        .filter(
          (location) =>
            locationIsFresh(location) &&
            location.latitude != null &&
            location.longitude != null &&
            isValidCoordinate({
              latitude: location.latitude,
              longitude: location.longitude,
            }) &&
            profiles.some((profile) => profile.id === location.owner_id),
        )
        .forEach((location) =>
          points.push([location.latitude!, location.longitude!]),
        );
    if (points.length) {
      programmaticMove.current = true;
      currentMap.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
        paddingBottomRight: [mapInsets.right + 24, mapInsets.bottom + 24],
        maxZoom: 15,
      });
    }
  }, [
    activities,
    locations,
    places,
    profiles,
    showAvatars,
    mapInsets.bottom,
    mapInsets.left,
    mapInsets.right,
    mapInsets.top,
  ]);
  useEffect(() => {
    const command = controlCommand;
    const currentMap = map.current;
    if (
      !ready ||
      onPick ||
      !command ||
      !currentMap ||
      !hasUsableMapViewport(currentMap)
    )
      return;
    if (appliedControlRevision.current === command.revision) return;
    appliedControlRevision.current = command.revision;

    programmaticMove.current = true;
    if (command.kind === "zoom-in") currentMap.zoomIn();
    else if (command.kind === "zoom-out") currentMap.zoomOut();
    else fit();
  }, [controlCommand, fit, onPick, ready, layoutVersion]);
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
        className={resolvedAppearance === "dark" ? "map-midnight" : "map-day"}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: colors.bg,
        }}
      />
      {!onPick && !hideControls ? <View
        style={{ position: "absolute", top: controlsTop, right: 16, gap: 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Map options"
          onPress={onOptions}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white,
          }}
        >
          <SlidersHorizontal size={20} color={colors.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
          onPress={recenter}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white,
          }}
        >
          <LocateFixed size={20} color={colors.ink} />
        </Pressable>
      </View> : null}
    </View>
  );
}
