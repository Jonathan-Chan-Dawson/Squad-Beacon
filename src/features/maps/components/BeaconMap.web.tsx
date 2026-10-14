import { avatarAvailability } from "@/src/features/profile/AvatarStatusBadge";
import {
  clusterAreaSummary,
  mapClusterGroups,
  mapClusterTier,
  CLUSTER_PREVIEW_LIMIT,
} from "../mapClusterPolicy";
import { useDesignTheme } from "@/src/theme";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { LocateFixed, SlidersHorizontal } from "lucide-react-native";
import { pulseLayerPolicy } from "@/src/features/pulse/pulseLayerPolicy";
import {
  collidePulseBadges,
  pulseHasBeacon,
  type ProjectedPulse,
} from "@/src/features/maps/pulseMapPolicy";
import { providerMapBounds } from "../mapBounds";
import { PulseMapOverlay } from "./PulseMapOverlay";
import type * as Leaflet from "leaflet";
import Constants from "expo-constants";
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
  markerVisualSize,
  CLUSTER_PREVIEW_ICON_SIZE,
  CLUSTER_PREVIEW_GAP,
  rankClusterMembers,
  clusterPreviewOverflow,
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
  const configuredCartoKey = Constants.expoConfig?.extra?.cartoBasemapsApiKey;
  const cartoApiKey = typeof configuredCartoKey === "string" ? configuredCartoKey : undefined;

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
  const [pulsePoints, setPulsePoints] = useState<ProjectedPulse[]>([]);
  const [pulseHalos, setPulseHalos] = useState<ProjectedPulse[]>([]);
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
        tapHold: false,
      }).setView([41.885, -87.642], 13);
      map.current = m;
      L.control.scale({ position: "bottomleft" }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      const updateAnchor = () => {
        const p = latest.current.anchorCoordinate ?? latest.current.focused;
        latest.current.onAnchor?.(
          p && hasUsableMapViewport(m)
            ? m.latLngToContainerPoint([p.latitude, p.longitude])
            : null,
        );
      };
      m.on("move", updateAnchor);
      let holdTimer: ReturnType<typeof setTimeout> | null = null;
      let touchOrigin: { x: number; y: number } | null = null;
      let longPressFired = false;
      let suppressClickUntil = 0;
      const cancelHold = () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
      };
      const emptyMapTarget = (target: EventTarget | null) =>
        target instanceof Element &&
        !target.closest(
          ".leaflet-marker-icon, .leaflet-interactive, .leaflet-control, button, a, input, [role='button']",
        );
      const markGesture = () => {
        cancelHold();
        programmaticMove.current = false;
        gestureActive.current = true;
        latest.current.onGestureChange?.(true);
      };
      const markZoomGesture = () => {
        if (!programmaticMove.current) {
          gestureActive.current = true;
          latest.current.onGestureChange?.(true);
        }
      };
      const markPinchGesture = (event: TouchEvent) => {
        if (event.touches.length > 1) markGesture();
      };
      const container = m.getContainer();
      const startHold = (event: TouchEvent) => {
        cancelHold();
        touchOrigin = null;
        longPressFired = false;
        suppressClickUntil = 0;
        if (
          event.touches.length !== 1 ||
          latest.current.onPick ||
          !latest.current.onLongPress ||
          !emptyMapTarget(event.target)
        ) return;
        const touch = event.touches[0];
        touchOrigin = { x: touch.clientX, y: touch.clientY };
        const bounds = container.getBoundingClientRect();
        const point = L.point(touch.clientX - bounds.left, touch.clientY - bounds.top);
        const coordinate = m.containerPointToLatLng(point);
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (!touchOrigin || latest.current.onPick) return;
          longPressFired = true;
          suppressClickUntil = Date.now() + 1000;
          latest.current.onLongPress?.({
            coordinate: { latitude: coordinate.lat, longitude: coordinate.lng },
            point,
          });
        }, 550);
      };
      const moveHold = (event: TouchEvent) => {
        if (!touchOrigin) return;
        const touch = event.touches[0];
        if (
          event.touches.length !== 1 ||
          !touch ||
          Math.hypot(touch.clientX - touchOrigin.x, touch.clientY - touchOrigin.y) > 8
        ) {
          cancelHold();
          touchOrigin = null;
        }
      };
      const endHold = (event: TouchEvent) => {
        cancelHold();
        touchOrigin = null;
        if (longPressFired) {
          suppressClickUntil = Date.now() + 450;
          if (event.cancelable) event.preventDefault();
        }
      };
      const suppressHoldClick = (event: MouseEvent) => {
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
          suppressClickUntil = 0;
        }
      };
      m.on("dragstart boxzoomstart", markGesture);
      m.on("zoomstart", markZoomGesture);
      container.addEventListener("wheel", markGesture, { passive: true });
      container.addEventListener("dblclick", markGesture);
      container.addEventListener("keydown", markGesture);
      container.addEventListener("touchstart", markPinchGesture, {
        passive: true,
      });
      container.addEventListener("touchstart", startHold, { passive: true });
      container.addEventListener("touchmove", moveHold, { passive: true });
      container.addEventListener("touchend", endHold, { passive: false });
      container.addEventListener("touchcancel", endHold, { passive: false });
      container.addEventListener("click", suppressHoldClick, true);
      removeGestureListeners.current = () => {
        cancelHold();
        container.removeEventListener("wheel", markGesture);
        container.removeEventListener("dblclick", markGesture);
        container.removeEventListener("keydown", markGesture);
        container.removeEventListener("touchstart", markPinchGesture);
        container.removeEventListener("touchstart", startHold);
        container.removeEventListener("touchmove", moveHold);
        container.removeEventListener("touchend", endHold);
        container.removeEventListener("touchcancel", endHold);
        container.removeEventListener("click", suppressHoldClick, true);
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
              bounds: providerMapBounds(
                northEast.lat,
                southWest.lat,
                northEast.lng,
                southWest.lng,
              ),
            },
            gestureActive.current && !programmaticMove.current,
          );
        gestureActive.current = false;
        latest.current.onGestureChange?.(false);
        programmaticMove.current = false;
        setViewVersion((version) => version + 1);
      });
      m.on("click", (e) => {
        if (Date.now() < suppressClickUntil) return;
        if (latest.current.onPick)
          latest.current.onPick(e.latlng.lat, e.latlng.lng);
        else latest.current.onMapTap?.();
      });
      m.on("contextmenu", (event) => {
        cancelHold();
        if (
          !latest.current.onPick &&
          Date.now() >= suppressClickUntil &&
          emptyMapTarget(event.originalEvent.target)
        ) {
          if (touchOrigin) {
            longPressFired = true;
            suppressClickUntil = Date.now() + 1000;
          }
          latest.current.onLongPress?.({
            coordinate: {
              latitude: event.latlng.lat,
              longitude: event.latlng.lng,
            },
            point: event.containerPoint,
          });
        }
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
    tiles.current = L.tileLayer(cartoTileUrl(resolvedAppearance, cartoApiKey), {
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: 19,
      attribution: cartoAttribution,
    }).addTo(currentMap);
  }, [ready, resolvedAppearance, cartoApiKey]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !hasUsableMapViewport(m)) return;
    const bounds = m.getBounds();
    const policy = pulseLayerPolicy(
      m.getZoom(),
      providerMapBounds(
        bounds.getNorth(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getWest(),
      ),
      props.pulseSummaries ?? [],
    );
    const project = (summaries: typeof policy.badges) =>
      summaries.map((summary) => {
        const point = m.latLngToContainerPoint([summary.lat, summary.lng]);
        return {
          summary,
          x: point.x,
          y: point.y,
          satellite: pulseHasBeacon(
            summary,
            props.places.filter((place) =>
              props.activities.some(
                (activity) => activity.id === place.activity_id,
              ),
            ),
          ),
        };
      });
    setPulsePoints(
      collidePulseBadges(project(policy.badges), m.getSize().x, m.getSize().y),
    );
    setPulseHalos(project(policy.halos));
  }, [
    ready,
    viewVersion,
    layoutVersion,
    props.pulseSummaries,
    props.places,
    props.activities,
  ]);
  const {
    contextPoints = [],
    contextPaths = [],
    onContextPoint,
    activities,
    availabilityActivities = activities,
    places,
    locations,
    profiles,
    selected,
    selectionIsTemporary = false,
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
    clusterPersonCount,
    areaName,
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
      const usableHeight =
        currentMap.getSize().y - mapInsets.top - mapInsets.bottom;
      const previewOffset = props.previewHeight
        ? Math.min(props.previewHeight / 2, Math.max(0, usableHeight / 2 - 48))
        : 0;
      const offsetY = (mapInsets.top - mapInsets.bottom) / 2 + previewOffset;
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
    [
      mapInsets.bottom,
      mapInsets.left,
      mapInsets.right,
      mapInsets.top,
      props.previewHeight,
    ],
  );
  useEffect(() => {
    const L = library.current,
      m = map.current,
      group = layer.current;
    if (!ready || !L || !m || !group) return;
    group.clearLayers();
    for (const path of contextPaths)
      L.polyline(
        path.map((point) => [point.latitude, point.longitude]),
        {
          color: colors.green,
          opacity: 0.65,
          weight: 3,
          dashArray: "6 5",
          interactive: false,
        },
      ).addTo(group);
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
      const dot = !friend && m.getZoom() < 12;
      const visualSize = dot
        ? 10
        : markerVisualSize(friend ? "person" : "beacon");
      const iconWidth = 64;
      const iconHeight = friend ? 52 : timeChip ? 68 : 48;
      node.type = "button";
      node.setAttribute("aria-label", label);
      node.title = label;
      node.dataset.availability = availabilityLabel;
      node.style.cssText = `position:relative;border:0;border-radius:0;background:transparent;color:${colors.ink};padding:0;width:${iconWidth}px;height:${iconHeight}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font:600 16px system-ui;cursor:pointer;opacity:${dimmed ? 0.7 : 1};transform:scale(${selectedPin ? 1.25 : 1});transform-origin:50% 50%;transition:${reducedMotion ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease"};`;
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
        if (availabilityLabel !== "unknown") {
          const status = document.createElement("span");
          status.dataset.testid = `avatar-status-${availabilityLabel.replace(" ", "-")}`;
          status.style.cssText = `position:absolute;top:-3px;right:-3px;width:12px;height:12px;border:2px solid ${colors.white};border-radius:50%;background:${tone};box-sizing:border-box;`;
          frame.append(status);
        }
        node.append(frame);
        const age = document.createElement("span");
        age.textContent = ageLabel;
        age.style.cssText =
          "position:relative;margin-top:2px;padding:0 5px;border:1px solid #d5dedb;border-radius:8px;background:#fff;color:#34434a;font:700 9px system-ui;white-space:nowrap;";
        node.append(age);
      } else {
        const face = document.createElement("span");
        face.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
        if (nowBeacon) {
          const halo = document.createElement("span");
          halo.className = "map-now-halo";
          halo.setAttribute("aria-hidden", "true");
          halo.style.cssText = `position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;box-sizing:border-box;pointer-events:none;border-radius:50%;border:2px solid ${tone};background:${tone}22;`;
          face.append(halo);
        }
        const notch = document.createElement("span");
        if (dot) notch.style.display = "none";
        notch.style.cssText = `display:${dot ? "none" : "block"};position:absolute;top:34px;width:12px;height:12px;background:${tone};transform:rotate(45deg);border-radius:2px;z-index:-1;`;
        node.append(notch);
        const badge = document.createElement("span");
        badge.textContent = dot ? "" : text;
        badge.style.cssText = `position:relative;width:${visualSize}px;height:${visualSize}px;border:${dot ? 1 : 3}px solid ${dot ? colors.white : tone};border-radius:50%;background:${dot ? tone : colors.white};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #172c2940;font-size:22px;`;
        face.append(badge);
        node.append(face);
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
      ...contextPoints
        .filter((point) => point.publicBeaconId)
        .map((point) => ({
          id: `beacon:${point.publicBeaconId}`,
          kind: "beacon" as const,
          latitude: point.latitude,
          longitude: point.longitude,
          category: point.category,
        })),
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
    const groups = mapClusterGroups(
      clusterPoints,
      {
        centerLatitude: center.lat,
        centerLongitude: center.lng,
        zoom: m.getZoom(),
        width: size.x,
        height: size.y,
      },
      clusterPriorities,
    );
    const renderedSingletonIds = new Set(
      groups
        .filter(
          (group) =>
            group.members.length === 1 &&
            (mapClusterTier(m.getZoom()) !== "area" ||
              (clusterPriorities[group.members[0].id]?.tier ?? 7) < 0),
        )
        .map((group) => group.members[0].id),
    );
    for (const point of contextPoints) {
      if (
        point.publicBeaconId &&
        !renderedSingletonIds.has(`beacon:${point.publicBeaconId}`)
      )
        continue;
      if (
        point.activityId &&
        !renderedSingletonIds.has(`beacon:${point.activityId}`)
      )
        continue;
      if (point.activityId) {
        L.circleMarker([point.latitude, point.longitude], {
          radius: 22,
          color: colors.green,
          weight: 2,
          fillOpacity: 0.06,
          dashArray: point.suggestion ? "3 3" : undefined,
          interactive: false,
        }).addTo(group);
      } else {
        const node = document.createElement("button");
        node.type = "button";
        node.textContent = point.publicBeaconId
          ? `Public \u00b7 ${point.title}`
          : "? Suggestion";
        node.setAttribute(
          "aria-label",
          `${point.publicBeaconId ? "Public Beacon" : "Suggestion"}: ${point.title}`,
        );
        node.style.cssText = `max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:44px;padding:5px 8px;border:1px dashed ${colors.green};border-radius:12px;background:${colors.white};color:${colors.green};font:11px system-ui;cursor:pointer;`;
        L.DomEvent.disableClickPropagation(node);
        node.onclick = () => {
          if (!onPick) onContextPoint?.(point);
        };
        L.marker([point.latitude, point.longitude], {
          zIndexOffset: -100,
          icon: L.divIcon({
            html: node,
            className: "beacon-marker",
            iconSize: [point.publicBeaconId ? 150 : 88, 44],
            iconAnchor: [point.publicBeaconId ? 75 : 44, 22],
          }),
        }).addTo(group);
      }
    }
    groups
      .filter(
        (cluster) =>
          cluster.members.length > 1 ||
          (mapClusterTier(m.getZoom()) === "area" &&
            (clusterPriorities[cluster.members[0].id]?.tier ?? 7) >= 0),
      )
      .forEach((cluster) => {
        const beaconCount = cluster.members.filter(
          (member) => member.kind === "beacon",
        ).length;
        const personCount =
          clusterPersonCount?.(cluster.members) ??
          cluster.members.length - beaconCount;
        const ranked = rankClusterMembers(cluster.members, clusterPriorities);
        const previewLabels = ranked
          .slice(0, CLUSTER_PREVIEW_LIMIT)
          .map((member) =>
            member.kind === "beacon"
              ? (activities.find(
                  (activity) => `beacon:${activity.id}` === member.id,
                )?.title ??
                contextPoints.find(
                  (point) => `beacon:${point.publicBeaconId}` === member.id,
                )?.title)
              : profiles.find((profile) => `person:${profile.id}` === member.id)
                  ?.name,
          )
          .filter((label): label is string => !!label);
        const node = document.createElement("button");
        node.type = "button";
        const preview = ranked.slice(0, CLUSTER_PREVIEW_LIMIT);
        const columns = Math.min(CLUSTER_PREVIEW_LIMIT, preview.length);
        const iconSize = CLUSTER_PREVIEW_ICON_SIZE;
        node.style.cssText = `width:max-content;min-height:44px;padding:3px;border:1px solid ${colors.line};border-radius:22px;background:${colors.white};color:${colors.ink};display:flex;align-items:center;gap:4px;cursor:pointer;font-family:system-ui;`;
        const icons = document.createElement("span");
        icons.style.cssText = `display:grid;grid-template-columns:repeat(${columns},${iconSize}px);grid-auto-rows:${iconSize}px;gap:${CLUSTER_PREVIEW_GAP}px;`;
        const symbols = {
          Fitness: "\u{1F3C0}",
          Study: "\u{1F4DA}",
          Gaming: "\u{1F3AE}",
          Creative: "\u{1F3A8}",
          Social: "\u{1F44B}",
          Other: "\u{2728}",
        };
        preview.forEach((member) => {
          const icon = document.createElement("span");
          icon.style.cssText = `position:relative;width:${iconSize}px;height:${iconSize}px;display:flex;align-items:center;justify-content:center;font:24px/${iconSize}px system-ui;text-align:center;`;
          const profile =
            member.kind === "person"
              ? profiles.find((row) => `person:${row.id}` === member.id)
              : undefined;
          if (profile && showAvatars) {
            const img = document.createElement("img");
            img.src =
              "data:image/svg+xml;charset=utf-8," +
              encodeURIComponent(
                miniAvatarSvg(profile.avatar_seed ?? avatarSeed(profile.id)),
              );
            img.width = iconSize;
            img.height = iconSize;
            img.alt = "";
            img.style.cssText = "display:block;border-radius:50%;";
            icon.append(img);
            const state = avatarAvailability(
              availabilityActivities,
              profile.id,
              now,
            );
            if (state !== "unknown") {
              const status = document.createElement("span");
              const token =
                availability[state === "ending-soon" ? "endingSoon" : state];
              status.dataset.testid = `avatar-status-${state}`;
              status.style.cssText = `position:absolute;top:0;right:0;width:10px;height:10px;border:2px solid ${colors.white};border-radius:50%;background:${token.color};box-sizing:border-box;`;
              icon.append(status);
            }
          } else {
            icon.textContent =
              member.kind === "person"
                ? "\u{1F464}"
                : symbols[member.category ?? "Other"];
          }
          icons.append(icon);
        });
        node.append(icons);
        if (cluster.members.length > CLUSTER_PREVIEW_LIMIT) {
          const more = document.createElement("span");
          more.textContent = `+${cluster.members.length - CLUSTER_PREVIEW_LIMIT}`;
          more.style.cssText = "font:10px/12px system-ui;";
          node.append(more);
        }
        const overflow = clusterPreviewOverflow(cluster.members.length);
        node.setAttribute(
          "aria-label",
          `Map cluster: ${beaconCount} beacons, ${personCount} people. Preview: ${previewLabels.join(", ")}${overflow ? `, plus ${overflow} more` : ""}.`,
        );
        const areaSummary = mapClusterTier(m.getZoom()) === "area";
        if (areaSummary) {
          const summary = clusterAreaSummary(
            cluster,
            activities,
            places,
            now,
            areaName,
          );
          node.replaceChildren();
          const name = document.createElement("span");
          name.textContent = summary.name;
          const reason = document.createElement("span");
          reason.textContent = summary.reason;
          name.style.cssText =
            "font-weight:600;max-width:132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          reason.style.cssText = `color:${colors.green};font-size:10px;white-space:nowrap;`;
          node.append(name, reason);
          node.style.cssText = `width:max-content;min-height:36px;max-width:150px;padding:5px 9px;border:1px solid ${colors.line};border-radius:12px;background:${colors.white}DD;color:${colors.ink};display:flex;flex-direction:column;gap:1px;cursor:pointer;font:11px system-ui;`;
          node.setAttribute(
            "aria-label",
            `Explore ${summary.name}: ${summary.reason}`,
          );
        }
        if (
          contextPoints.some((point) => point.activityId) &&
          !cluster.members.some((member) =>
            contextPoints.some(
              (point) => member.id === `beacon:${point.activityId}`,
            ),
          )
        )
          node.style.opacity = "0.65";
        node.title = `${cluster.members.length} items · ${beaconCount} Beacons · ${personCount} people`;
        L.DomEvent.disableClickPropagation(node);
        node.onclick = () => {
          const zoom = m.getZoom();
          const targetZoom = areaSummary
            ? Math.min(16, Math.max(13, zoom + 2))
            : Math.min(MAP_MAX_ZOOM, zoom + (zoom < 16 ? 0.5 : 0));
          const center = adjustedMapCenter(
            cluster.latitude,
            cluster.longitude,
            targetZoom,
          );
          if (center) {
            programmaticMove.current = true;
            m.flyTo(center, targetZoom, { duration: reducedMotion ? 0 : 0.3 });
          }
          if (areaSummary) return;
          onCluster?.(
            cluster,
            m.latLngToContainerPoint([cluster.latitude, cluster.longitude]),
          );
        };
        // Measure the content so the Leaflet hit area and anchor fit the icons.
        node.style.visibility = "hidden";
        m.getContainer().append(node);
        const { width: badgeWidth, height: badgeHeight } =
          node.getBoundingClientRect();
        node.remove();
        node.style.visibility = "";
        L.marker([cluster.latitude, cluster.longitude], {
          icon: L.divIcon({
            html: node,
            className: "beacon-marker",
            iconSize: [badgeWidth, badgeHeight],
            iconAnchor: [badgeWidth / 2, badgeHeight / 2],
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
          (!!selectedActivityId && selectedActivityId !== a.id) ||
            (contextPoints.some((point) => point.activityId) &&
              !contextPoints.some((point) => point.activityId === a.id)),
          "",
          "unknown",
          isNowBeacon(a, now),
          contextPoints.find((point) => point.activityId === a.id)?.suggestion
            ? "Suggestion"
            : contextPoints.some((point) => point.activityId === a.id)
              ? "In focus"
              : m.getZoom() >= 15
                ? mapTimeChip(a, now)
                : "",
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
        interactive: !selectionIsTemporary,
        keyboard: !selectionIsTemporary,
        icon: L.divIcon({
          html: selectionIsTemporary
            ? `<span data-testid="map-temporary-pin" data-latitude="${selected.latitude}" data-longitude="${selected.longitude}" role="img" aria-label="Selected map location" style="display:block;width:26px;height:32px;filter:drop-shadow(0 2px 4px #0005)"><svg width="26" height="32" viewBox="0 0 24 28" fill="${colors.white}" stroke="${colors.green}" stroke-width="2"><path d="M21 10c0 7-9 15-9 15S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3" fill="${colors.green}" stroke="none"/></svg></span>`
            : `<span style="position:relative;width:34px;height:34px;border:2px solid ${colors.green};border-radius:50%;background:${colors.lime};display:flex;align-items:center;justify-content:center;color:${colors.green};font-size:22px;font-weight:700;box-shadow:0 3px 10px #172c2940"><span style="position:absolute;top:24px;z-index:-1;width:12px;height:12px;background:${colors.green};transform:rotate(45deg);border-radius:2px"></span>+</span>`,
          className: "beacon-marker",
          iconSize: selectionIsTemporary ? [26, 32] : [44, 50],
          iconAnchor: selectionIsTemporary ? [13, 32] : [22, 50],
        }),
      }).addTo(group);
    if (
      !fitted.current &&
      !controlCommand?.coordinates?.length &&
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
    contextPoints,
    contextPaths,
    onContextPoint,
    onPick,
    controlCommand,
    colors,
    categories,
    availability,
    activities,
    availabilityActivities,
    places,
    locations,
    profiles,
    selected,
    selectionIsTemporary,
    selectedActivityId,
    showAvatars,
    now,
    reducedMotion,
    onActivity,
    onPerson,
    onCluster,
    clusterPriorities,
    clusterPersonCount,
    areaName,
    adjustedMapCenter,
    mapInsets.bottom,
    mapInsets.left,
    mapInsets.right,
    mapInsets.top,
  ]);
  const anchorLat = props.anchorCoordinate?.latitude ?? focused?.latitude;
  const anchorLng = props.anchorCoordinate?.longitude ?? focused?.longitude;
  const onAnchor = props.onAnchor;
  useEffect(() => {
    const currentMap = map.current;
    onAnchor?.(
      ready &&
        currentMap &&
        anchorLat != null &&
        anchorLng != null &&
        hasUsableMapViewport(currentMap)
        ? currentMap.latLngToContainerPoint([anchorLat, anchorLng])
        : null,
    );
  }, [ready, anchorLat, anchorLng, onAnchor, layoutVersion]);
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
    fitted.current = true;

    // A context fit must cancel an in-flight overview/exploration animation.
    currentMap.stop();
    programmaticMove.current = true;
    if (command.kind === "restore" && command.camera)
      currentMap.setView(
        [command.camera.center.latitude, command.camera.center.longitude],
        command.camera.zoom,
        { animate: false },
      );
    else if (command.kind === "zoom-in") currentMap.zoomIn();
    else if (command.kind === "zoom-out") currentMap.zoomOut();
    else if (command.coordinates?.length)
      currentMap.fitBounds(
        command.coordinates.map(
          (point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple,
        ),
        {
          paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
          paddingBottomRight: [mapInsets.right + 24, mapInsets.bottom + 24],
          maxZoom: 18,
          // Apply explicit relationship fits atomically during initial map layout.
          animate: false,
        },
      );
    else fit();
  }, [
    controlCommand,
    fit,
    onPick,
    ready,
    layoutVersion,
    mapInsets.left,
    mapInsets.top,
    mapInsets.right,
    mapInsets.bottom,
    reducedMotion,
  ]);
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
      <PulseMapOverlay
        points={pulsePoints}
        halos={pulseHalos}
        places={props.pulsePlaces ?? []}
        onPlace={props.onPlace}
        popToken={props.pulsePopToken}
        popPlaceKey={props.pulsePopPlaceKey}
        calm={props.calm}
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
