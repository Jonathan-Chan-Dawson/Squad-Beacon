import { useDesignTheme } from "@/src/theme";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { LocateFixed, SlidersHorizontal } from "lucide-react-native";
import type * as Leaflet from "leaflet";
import "@/components/leaflet.web.css";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import { friendAvailabilityState, locationIsFresh } from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import { usePreferences } from "@/src/shared/preferences";
import { useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { useReducedMotion } from "@/src/shared/design-system";
import { cartoAttribution, cartoTileUrl } from "@/src/theme/map";
import {
  clusterMapPoints,
  markerVisualSize,
  rankClusterMembers,
  clusterPreviewOverflow,
  clusterCategoryMix,
  clusterBounds,
  formatLocationAge,
  MAP_MAX_ZOOM,
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
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= MAP_MAX_ZOOM;
}

function hasValidInsets(
  top: number,
  right: number,
  bottom: number,
  left: number,
) {
  return [top, right, bottom, left].every(
    (value) => Number.isFinite(value) && value >= 0,
  );
}

function isNowBeacon(activity: MapProps["activities"][number], now: number) {
  return (
    activity.status === "scheduled" &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now
  );
}

function mapTimeChip(activity: MapProps["activities"][number], now: number) {
  const startsAt = Date.parse(activity.starts_at);
  const endsAt = Date.parse(activity.ends_at);
  if (startsAt <= now && endsAt > now)
    return `${Math.max(1, Math.ceil((endsAt - now) / 60_000))}m left`;
  return Number.isFinite(startsAt)
    ? new Date(startsAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

export default function BeaconMap(props: MapProps) {
  const { colors, resolvedAppearance } = useTheme();
  const { categories, availability } = useDesignTheme();
  const now = useNow();
  const reducedMotion = useReducedMotion();

  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    library = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    tiles = useRef<Leaflet.TileLayer | null>(null),
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
    if (reducedMotion) map.current?.stop();
  }, [ready, reducedMotion]);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !element.current) return;
      library.current = L;
      const m = L.map(element.current, {
        zoomControl: false,
        maxZoom: MAP_MAX_ZOOM,
      }).setView([41.885, -87.642], 13);
      map.current = m;
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
          latest.current.onViewportChange?.(
            {
              center: {
                latitude: m.getCenter().lat,
                longitude: m.getCenter().lng,
              },
              zoom: m.getZoom(),
              bounds: {
                north: northEast.lat,
                south: southWest.lat,
                east: northEast.lng,
                west: southWest.lng,
              },
            },
            gestureActive.current && !programmaticMove.current,
          );
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
  useEffect(() => {
    const L = library.current;
    const currentMap = map.current;
    if (!ready || !L || !currentMap) return;
    tiles.current?.remove();
    tiles.current = L.tileLayer(cartoTileUrl(resolvedAppearance), {
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: 19,
      attribution: cartoAttribution,
    }).addTo(currentMap);
  }, [ready, resolvedAppearance]);
  const {
    activities,
    availabilityActivities = activities,
    places,
    locations,
    profiles,
    selected,
    selectedActivityId = null,
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
        currentMap
          .project([latitude, longitude], zoom)
          .subtract(L.point(offsetX, offsetY)),
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
      selectedPin = false,
      dimmed = false,
      ageLabel = "",
      availabilityLabel = "unknown",
      nowBeacon = false,
      timeChip = "",
    ) => {
      const node = document.createElement("button");
      const visualSize = markerVisualSize(friend ? "person" : "beacon");
      const iconWidth = 64;
      const iconHeight = friend ? 52 : timeChip ? 68 : 48;
      node.type = "button";
      node.setAttribute("aria-label", label);
      node.title = label;
      node.dataset.availability = availabilityLabel;
      node.style.cssText = `position:relative;border:0;border-radius:0;background:transparent;color:${colors.ink};padding:0;width:${iconWidth}px;height:${iconHeight}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font:600 16px system-ui;cursor:pointer;opacity:${dimmed ? 0.7 : 1};transform:scale(${selectedPin ? 1.25 : 1});transform-origin:50% 50%;transition:${reducedMotion ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease"};`;
      if (nowBeacon) {
        const halo = document.createElement("span");
        halo.className = "map-now-halo";
        halo.setAttribute("aria-hidden", "true");
        halo.style.cssText = `position:absolute;left:50%;top:18px;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;border:2px solid ${tone};background:${tone}22;`;
        node.append(halo);
      }
      if (friend) {
        const frame = document.createElement("span");
        frame.style.cssText = `position:relative;width:${visualSize}px;height:${visualSize}px;border:3px solid ${tone};border-radius:50%;background:${colors.white};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;`;
        const img = document.createElement("img");
        img.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(miniAvatarSvg(seed));
        img.width = visualSize - 6;
        img.height = visualSize - 6;
        img.alt = "";
        img.style.cssText = "border-radius:50%;";
        frame.append(img);
        node.append(frame);
        const age = document.createElement("span");
        age.textContent = ageLabel;
        age.style.cssText =
          "position:relative;margin-top:2px;padding:0 5px;border:1px solid #d5dedb;border-radius:8px;background:#fff;color:#34434a;font:700 9px system-ui;white-space:nowrap;";
        node.append(age);
      } else {
        const notch = document.createElement("span");
        notch.style.cssText = `position:absolute;top:34px;width:12px;height:12px;background:${tone};transform:rotate(45deg);border-radius:2px;z-index:-1;`;
        node.append(notch);
        const badge = document.createElement("span");
        badge.textContent = text;
        badge.style.cssText = `position:relative;width:${visualSize}px;height:${visualSize}px;border:3px solid ${tone};border-radius:50%;background:${colors.white};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;font-size:22px;`;
        node.append(badge);
        if (timeChip) {
          const chip = document.createElement("span");
          chip.textContent = timeChip;
          chip.style.cssText = `position:relative;margin-top:5px;padding:1px 7px;border:1px solid ${tone};border-radius:9px;background:${colors.white};color:${colors.ink};font:700 10px system-ui;white-space:nowrap;`;
          node.append(chip);
        }
      }

      L.DomEvent.disableClickPropagation(node);
      node.onclick = click;
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: node,
          className: "beacon-marker",
          iconSize: [iconWidth, iconHeight],
          iconAnchor: friend
            ? [iconWidth / 2, visualSize / 2]
            : [iconWidth / 2, 40],
        }),
        title: label,
        keyboard: true,
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
                category: activity.category,
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
              locationIsFresh(location, new Date(now)) &&
              formatLocationAge(location.updated_at, now) !== null &&
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
    const renderedSingletonIds = new Set(
      groups
        .filter((group) => group.members.length === 1)
        .map((group) => group.members[0].id),
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
                  (activity) => `beacon:${activity.id}` === member.id,
                )?.title
              : profiles.find((profile) => `person:${profile.id}` === member.id)
                  ?.name,
          )
          .filter((label): label is string => !!label);
        const mix = clusterCategoryMix(cluster.members);
        const mixLabel = mix
          .map((entry) => `${entry.category} ${entry.count}`)
          .join(", ");
        const node = document.createElement("button");
        node.type = "button";
        const badgeSize = Math.min(
          74,
          54 + Math.log2(cluster.members.length) * 4,
        );
        const radius = badgeSize / 2 - 3;
        const circumference = 2 * Math.PI * radius;
        node.style.cssText = `position:relative;width:${badgeSize}px;height:${badgeSize}px;padding:0;border:0;border-radius:50%;background:${colors.white};color:${colors.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;cursor:pointer;font-family:system-ui;`;
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("width", String(badgeSize));
        svg.setAttribute("height", String(badgeSize));
        svg.style.cssText =
          "position:absolute;inset:0;overflow:visible;pointer-events:none;";
        const base = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        base.setAttribute("cx", String(badgeSize / 2));
        base.setAttribute("cy", String(badgeSize / 2));
        base.setAttribute("r", String(radius));
        base.setAttribute("fill", "none");
        base.setAttribute("stroke", colors.line);
        base.setAttribute("stroke-width", "3");
        svg.append(base);
        let offset = 0;
        mix.forEach((entry) => {
          const segment = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          const length = Math.max(
            1,
            (entry.count / cluster.members.length) * circumference - 2,
          );
          segment.setAttribute("cx", String(badgeSize / 2));
          segment.setAttribute("cy", String(badgeSize / 2));
          segment.setAttribute("r", String(radius));
          segment.setAttribute("fill", "none");
          segment.setAttribute(
            "stroke",
            entry.category === "People"
              ? "#74828A"
              : categories[entry.category].color,
          );
          segment.setAttribute("stroke-width", "3");
          segment.setAttribute(
            "stroke-dasharray",
            `${length} ${circumference}`,
          );
          segment.setAttribute("stroke-dashoffset", String(-offset));
          segment.setAttribute(
            "transform",
            `rotate(-90 ${badgeSize / 2} ${badgeSize / 2})`,
          );
          svg.append(segment);
          offset += length + 2;
        });
        node.append(svg);
        const total = document.createElement("span");
        total.textContent = String(cluster.members.length);
        total.style.cssText = "position:relative;font:800 17px/20px system-ui;";
        node.append(total);
        const counts = document.createElement("span");
        counts.textContent = `${beaconCount}B · ${personCount}P`;
        counts.style.cssText =
          "position:relative;color:#54636b;font:700 8px/10px system-ui;white-space:nowrap;";
        node.append(counts);
        const overflow = clusterPreviewOverflow(cluster.members.length);
        node.setAttribute(
          "aria-label",
          `Map cluster: ${beaconCount} beacons, ${personCount} people. Preview: ${previewLabels.join(", ")}${overflow ? `, plus ${overflow} more` : ""}. Category mix: ${mixLabel}.`,
        );
        node.title = `${cluster.members.length} items · ${beaconCount} Beacons · ${personCount} people`;
        L.DomEvent.disableClickPropagation(node);
        node.onclick = () => {
          const zoom = m.getZoom();
          const expansionZoom =
            cluster.expansionZoom ??
            Math.min(MAP_MAX_ZOOM + 1, Math.floor(zoom) + 1);
          if (zoom < expansionZoom && zoom < MAP_MAX_ZOOM) {
            const bounds = clusterBounds(cluster.members);
            if (bounds) {
              programmaticMove.current = true;
              const targetZoom = Math.min(
                MAP_MAX_ZOOM,
                Math.max(zoom + 1, expansionZoom),
              );
              if (
                bounds.longitudeSpan < 0.0001 &&
                bounds.north - bounds.south < 0.0001
              ) {
                if (reducedMotion)
                  m.setView([cluster.latitude, cluster.longitude], targetZoom, {
                    animate: false,
                  });
                else
                  m.flyTo([cluster.latitude, cluster.longitude], targetZoom, {
                    duration: 0.45,
                  });
              } else if (bounds.east < bounds.west) {
                m.fitBounds(
                  [
                    [bounds.south, bounds.west],
                    [bounds.north, bounds.east + 360],
                  ],
                  {
                    paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
                    paddingBottomRight: [
                      mapInsets.right + 24,
                      mapInsets.bottom + 24,
                    ],
                    maxZoom: targetZoom,
                    animate: reducedMotion ? false : undefined,
                  },
                );
              } else {
                m.fitBounds(
                  L.latLngBounds(
                    cluster.members.map(
                      (member) =>
                        [
                          member.latitude,
                          member.longitude,
                        ] as Leaflet.LatLngTuple,
                    ),
                  ),
                  {
                    paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
                    paddingBottomRight: [
                      mapInsets.right + 24,
                      mapInsets.bottom + 24,
                    ],
                    maxZoom: targetZoom,
                    animate: reducedMotion ? false : undefined,
                  },
                );
              }
              return;
            }
          }
          onCluster?.(
            cluster,
            m.latLngToContainerPoint([cluster.latitude, cluster.longitude]),
          );
        };
        L.marker([cluster.latitude, cluster.longitude], {
          icon: L.divIcon({
            html: node,
            className: "beacon-marker",
            iconSize: [badgeSize, badgeSize],
            iconAnchor: [badgeSize / 2, badgeSize / 2],
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
        renderedSingletonIds.has(`beacon:${p.activity_id}`)
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
          categories[a.category].color,
          selectedActivityId === a.id,
          !!selectedActivityId && selectedActivityId !== a.id,
          "",
          "unknown",
          isNowBeacon(a, now),
          m.getZoom() >= 16 ? mapTimeChip(a, now) : "",
        );
    });
    if (showAvatars)
      locations
        .filter(
          (l) =>
            locationIsFresh(l, new Date(now)) &&
            formatLocationAge(l.updated_at, now) !== null &&
            renderedSingletonIds.has(`person:${l.owner_id}`),
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
          if (p && l.latitude != null && l.longitude != null) {
            const availabilityState =
              availabilityActivities
                .filter((activity) => activity.owner_id === l.owner_id)
                .map((activity) => friendAvailabilityState(activity, now))
                .find((state) => state !== "unknown") ?? "unknown";
            const availabilityKey =
              availabilityState === "ending-soon"
                ? "endingSoon"
                : availabilityState;
            const ageLabel = formatLocationAge(l.updated_at, now) ?? "now";
            marker(
              l.latitude,
              l.longitude,
              p.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join(""),
              `Map friend: ${p.name}, ${availabilityState.replace("-", " ")}, location ${ageLabel}`,
              () => onPerson(p.id),
              true,
              p.avatar_seed ?? avatarSeed(p.id),
              availability[availabilityKey].color,
              false,
              false,
              ageLabel,
              availabilityState.replace("-", " "),
            );
          }
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
          animate: reducedMotion ? false : undefined,
        },
      );
      fitted.current = true;
    }
  }, [
    ready,
    layoutVersion,
    viewVersion,
    colors,
    categories,
    availability,
    activities,
    availabilityActivities,
    places,
    locations,
    profiles,
    selected,
    selectedActivityId,
    showAvatars,
    now,
    reducedMotion,
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
        if (reducedMotion) currentMap.setView(center, 16, { animate: false });
        else currentMap.flyTo(center, 16, { duration: 0.5 });
        appliedFocusedTarget.current = focusKey;
      }
    }
  }, [ready, lat, lng, adjustedMapCenter, layoutVersion, reducedMotion]);
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
      if (reducedMotion)
        map.current?.setView(center, explorationTarget.zoom, {
          animate: false,
        });
      else
        map.current?.flyTo(center, explorationTarget.zoom, { duration: 0.45 });
    }
  }, [
    ready,
    explorationTarget,
    onPick,
    adjustedMapCenter,
    layoutVersion,
    reducedMotion,
  ]);
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
            locationIsFresh(location, new Date(now)) &&
            formatLocationAge(location.updated_at, now) !== null &&
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
        animate: reducedMotion ? false : undefined,
      });
    }
  }, [
    activities,
    locations,
    places,
    profiles,
    showAvatars,
    now,
    reducedMotion,
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
      {!onPick && !hideControls ? (
        <View
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
        </View>
      ) : null}
    </View>
  );
}
