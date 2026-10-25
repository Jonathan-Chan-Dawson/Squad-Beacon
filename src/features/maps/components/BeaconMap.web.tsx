import { bloomGeometry } from "../clusterBloom";
import { KeyedMapLayers } from "../keyedMapLayers";
import { ClusterArtworkCache } from "../clusterArtwork";
import {
  markerIdentity,
  categoryMarkerGlyphs,
  ownsMapBeacon,
  mapIdentityColors,
  friendLocationLabel,
  visibleFriendLabels,
} from "../markerIdentity";
import { useBeacon } from "@/src/shared/store";
import {
  nativeMapMode,
  MapPresentationCache,
  presentationArtworkPoints,
  type NativeMapMode,
} from "../nativeMapPresentation";
import { webConstellation } from "../webConstellation";
import type { ClusterPoint } from "../cluster";
import { useDesignTheme } from "@/src/theme";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { cartoAttribution, cartoBasemapLayers } from "@/src/theme/map";
import {
  markerVisualSize,
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
  const { data: identityData, userId: identityViewer } = useBeacon();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const configuredCartoKey = Constants.expoConfig?.extra?.cartoBasemapsApiKey;
  const cartoApiKey =
    typeof configuredCartoKey === "string" ? configuredCartoKey : undefined;
  const [tileError, setTileError] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);

  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    library = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    decorationLayer = useRef<Leaflet.LayerGroup | null>(null),
    tiles = useRef<Leaflet.TileLayer | null>(null),
    latest = useRef(props),
    fitted = useRef(false),
    appliedFocusedTarget = useRef<string | null>(null),
    appliedTargetRevision = useRef<number | null>(null),
    programmaticMove = useRef(false),
    gestureActive = useRef(false),
    removeGestureListeners = useRef<(() => void) | null>(null),
    appliedControlRevision = useRef<number | null>(null);
  const presentationMode = useRef<NativeMapMode | undefined>(undefined);
  const clusterOpenSection = useRef<"Beacons" | "Friends" | undefined>(
    undefined,
  );
  const [markerCache] = useState(() => new KeyedMapLayers<Leaflet.Layer>());
  const [decorationCache] = useState(() => new KeyedMapLayers<Leaflet.Layer>());
  const [presentationCache] = useState(() => new MapPresentationCache());
  const [artworkCache] = useState(() => new ClusterArtworkCache());
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
      decorationLayer.current = L.layerGroup().addTo(m);
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
        )
          return;
        const touch = event.touches[0];
        touchOrigin = { x: touch.clientX, y: touch.clientY };
        const bounds = container.getBoundingClientRect();
        const point = L.point(
          touch.clientX - bounds.left,
          touch.clientY - bounds.top,
        );
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
          Math.hypot(
            touch.clientX - touchOrigin.x,
            touch.clientY - touchOrigin.y,
          ) > 8
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
      markerCache.clear();
      decorationCache.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [markerCache, decorationCache]);
  useEffect(() => {
    const L = library.current;
    const currentMap = map.current;
    if (!ready || !L || !currentMap) return;
    tiles.current?.remove();
    setTileError(false);
    let active = true;
    const failed = new Set<string>();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retried = false;
    const urls = cartoBasemapLayers(resolvedAppearance, cartoApiKey);
    const layer = L.tileLayer(urls.base, {
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: 19,
      attribution: cartoAttribution,
    });
    const labelPane =
      currentMap.getPane("beacon-basemap-labels") ??
      currentMap.createPane("beacon-basemap-labels");
    labelPane.style.zIndex = "250";
    labelPane.style.pointerEvents = "none";
    const labels = urls.labels
      ? L.tileLayer(urls.labels, {
          maxZoom: MAP_MAX_ZOOM,
          maxNativeZoom: 19,
          pane: "beacon-basemap-labels",
          className: "beacon-basemap-labels",
        })
      : null;
    const layers = labels ? [layer, labels] : [layer];
    layers.forEach((tileLayer, index) => {
      tileLayer.on("tileerror", (event: Leaflet.TileErrorEvent) => {
        failed.add(
          `${index}:${event.coords.z}/${event.coords.x}/${event.coords.y}`,
        );
        if (!active) return;
        setTileError(true);
        if (!retried) {
          retried = true;
          retry = setTimeout(() => {
            if (active) layers.forEach((item) => item.redraw());
          }, 1500);
        }
      });
      tileLayer.on("tileload", (event: Leaflet.TileEvent) => {
        failed.delete(
          `${index}:${event.coords.z}/${event.coords.x}/${event.coords.y}`,
        );
      });
      tileLayer.on("load", () => {
        if (active) setTileError(failed.size > 0);
      });
    });
    tiles.current = layer.addTo(currentMap);
    labels?.addTo(currentMap);
    return () => {
      active = false;
      clearTimeout(retry);
      layers.forEach((item) => {
        item.off();
        item.remove();
      });
    };
  }, [ready, resolvedAppearance, cartoApiKey, tileRetry]);
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
    friendsProminent = false,
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
    const decorations = decorationLayer.current;
    if (!ready || !L || !m || !group || !decorations) return;
    markerCache.begin(group);
    decorationCache.begin(decorations);
    contextPaths.forEach((path, index) =>
      decorationCache.use(
        `path:${index}`,
        JSON.stringify([path, colors.green]),
        () =>
          L.polyline(
            path.map((point) => [point.latitude, point.longitude]),
            {
              color: colors.green,
              opacity: 0.65,
              weight: 3,
              dashArray: "6 5",
              interactive: false,
            },
          ).addTo(decorations),
      ),
    );
    const physicalPlaces = [
      ...new Map(
        places
          .filter(
            (place) =>
              place.online_url == null &&
              place.latitude != null &&
              place.longitude != null &&
              isValidCoordinate({
                latitude: place.latitude,
                longitude: place.longitude,
              }) &&
              activities.some((activity) => activity.id === place.activity_id),
          )
          .map((place) => [place.activity_id, place]),
      ).values(),
    ];
    const freshLocations = [
      ...new Map(
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
              }),
          )
          .sort(
            (a, b) =>
              Date.parse(a.updated_at ?? "") - Date.parse(b.updated_at ?? "") ||
              a.id.localeCompare(b.id),
          )
          .map((location) => [location.owner_id, location]),
      ).values(),
    ];
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
      identity: ReturnType<typeof markerIdentity> = null,
      owned = false,
      detached = false,
      fullMarker = false,
      cacheKey?: string,
    ): HTMLButtonElement | Leaflet.Marker => {
      if (cacheKey && !detached) {
        const revision = JSON.stringify([
          text,
          label,
          friend,
          seed,
          tone,
          selectedPin,
          dimmed,
          ageLabel,
          availabilityLabel,
          nowBeacon,
          timeChip,
          identity,
          owned,
          fullMarker,
          colors.white,
          colors.ink,
          colors.line,
          resolvedAppearance,
        ]);
        const entry = markerCache.use(
          cacheKey,
          revision,
          () =>
            marker(
              lat,
              lng,
              text,
              label,
              () => markerCache.activate(cacheKey),
              friend,
              seed,
              tone,
              selectedPin,
              dimmed,
              ageLabel,
              availabilityLabel,
              nowBeacon,
              timeChip,
              identity,
              owned,
              false,
              fullMarker,
            ) as Leaflet.Marker,
          click,
        ) as Leaflet.Marker;
        const previous = entry.getLatLng();
        if (previous.lat !== lat || previous.lng !== lng)
          entry.setLatLng([lat, lng]);
        return entry;
      }
      const compact = detached && !fullMarker;
      const node = document.createElement("button");
      const dot =
        !friend && m.getZoom() < 12 && !detached && !owned && !fullMarker;
      const visualSize = compact
        ? 32
        : dot
          ? 10
          : markerVisualSize(friend ? "person" : "beacon");
      const iconWidth = compact ? 32 : 64;
      const iconHeight = compact ? 32 : friend ? 52 : timeChip ? 68 : 48;
      node.type = "button";
      node.setAttribute("aria-label", label);
      node.title = label;
      node.dataset.availability = availabilityLabel;
      node.style.cssText = `position:relative;border:0;border-radius:0;background:transparent;color:${colors.ink};padding:0;width:${iconWidth}px;height:${iconHeight}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font:600 16px system-ui;cursor:pointer;opacity:${dimmed ? 0.7 : 1};transform:scale(${selectedPin && !compact ? 1.25 : 1});transform-origin:50% 50%;transition:${reducedMotion ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease"};`;
      if (friend) {
        const frame = document.createElement("span");
        frame.dataset.clusterFace = "true";
        frame.style.cssText = `position:relative;box-sizing:border-box;flex-shrink:0;width:${visualSize}px;height:${visualSize}px;border:${compact ? 2 : 3}px solid ${tone};border-radius:50%;background:${colors.white};display:flex;align-items:center;justify-content:center;box-shadow:${compact ? "none" : "0 3px 10px #172c2940"};`;
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
        age.style.cssText = `position:relative;margin-top:2px;padding:0 5px;border:1px solid ${colors.line};border-radius:8px;background:${colors.white};color:${colors.ink};font:700 9px system-ui;white-space:nowrap;max-width:94px;overflow:hidden;text-overflow:ellipsis;`;
        if (ageLabel) node.append(age);
      } else {
        const face = document.createElement("span");
        face.dataset.clusterFace = "true";
        face.style.cssText =
          "position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
        if (nowBeacon && !detached) {
          const halo = document.createElement("span");
          halo.className = "map-now-halo";
          halo.setAttribute("aria-hidden", "true");
          halo.style.cssText = `position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;box-sizing:border-box;pointer-events:none;border-radius:50%;border:2px solid ${tone};background:${tone}22;`;
          face.append(halo);
        }
        const notch = document.createElement("span");
        if (dot) notch.style.display = "none";
        notch.style.cssText = `display:${dot || compact ? "none" : "block"};position:absolute;top:34px;width:12px;height:12px;background:${tone};transform:rotate(45deg);border-radius:2px;z-index:-1;`;
        node.append(notch);
        const badge = document.createElement("span");
        badge.textContent = dot ? "" : text;
        badge.style.cssText = `position:relative;box-sizing:border-box;flex-shrink:0;width:${visualSize}px;height:${visualSize}px;border:${dot ? 1 : compact ? 2 : 3}px solid ${dot ? colors.white : tone};border-radius:50%;background:${dot ? tone : colors.white};display:flex;align-items:center;justify-content:center;box-shadow:${compact ? "none" : "0 3px 10px #172c2940"};font-size:${compact ? 20 : 22}px;`;
        face.append(badge);
        if (identity && !dot) {
          const emblem = document.createElement("span");
          emblem.textContent = identity.glyph;
          emblem.setAttribute("aria-label", identity.label);
          emblem.style.cssText = `position:absolute;${owned ? "left" : "right"}:${compact ? -2 : -7}px;bottom:${compact ? -2 : -4}px;width:${compact ? 12 : 21}px;height:${compact ? 12 : 21}px;border:2px solid ${colors.white};border-radius:${identity.kind === "community" ? 6 : 11}px;background:${identity.glyph === "♥" ? (resolvedAppearance === "dark" ? "#3D2430" : "#FFF0F5") : colors.ink};color:${identity.glyph === "♥" ? mapIdentityColors.heart[resolvedAppearance] : colors.white};display:flex;align-items:center;justify-content:center;font:700 12px system-ui;`;
          face.append(emblem);
        }
        if (owned && !dot) {
          const star = document.createElement("span");
          star.textContent = "★";
          star.setAttribute("aria-label", "Your Beacon");
          star.dataset.testid = "beacon-ownership-star";
          star.style.cssText = `position:absolute;right:${compact ? -3 : -6}px;bottom:${compact ? -2 : -4}px;width:${compact ? 12 : 16}px;height:${compact ? 12 : 16}px;border:2px solid ${colors.white};border-radius:50%;background:${mapIdentityColors.ownership};color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px system-ui;`;
          face.append(star);
        }
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
      if (detached) return node;
      return L.marker([lat, lng], {
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
      ...physicalPlaces.flatMap((place) => {
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
        ? freshLocations.flatMap((location) => {
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
    presentationMode.current = nativeMapMode(
      m.getZoom(),
      presentationMode.current,
    );
    const ownedIds = new Set(
      activities
        .filter((activity) =>
          ownsMapBeacon(identityData, activity, identityViewer),
        )
        .map((activity) => `beacon:${activity.id}`),
    );
    const presentations = presentationCache.select(
      clusterPoints,
      {
        centerLatitude: center.lat,
        centerLongitude: center.lng,
        zoom: m.getZoom(),
        width: size.x,
        height: size.y,
      },
      presentationMode.current,
      clusterPriorities,
      ownedIds,
      Math.max(
        10,
        Math.floor(
          (150 -
            contextPaths.length -
            contextPoints.length -
            Number(!!selected)) *
            0.75,
        ),
      ),
      friendsProminent,
    );
    const renderedSingletonIds = new Set(
      presentations
        .filter(
          (item) => item.mode === "stack" && item.group.members.length === 1,
        )
        .map((item) => item.group.members[0].id),
    );
    for (const point of contextPoints) {
      if (
        point.publicBeaconId &&
        (!renderedSingletonIds.has(`beacon:${point.publicBeaconId}`) ||
          physicalPlaces.some(
            (place) => place.activity_id === point.publicBeaconId,
          ))
      )
        continue;
      if (
        point.activityId &&
        !renderedSingletonIds.has(`beacon:${point.activityId}`)
      )
        continue;
      if (point.activityId) {
        decorationCache.use(
          `context:${point.id}`,
          JSON.stringify([point, colors.green]),
          () =>
            L.circleMarker([point.latitude, point.longitude], {
              radius: 22,
              color: colors.green,
              weight: 2,
              fillOpacity: 0.06,
              dashArray: point.suggestion ? "3 3" : undefined,
              interactive: false,
            }).addTo(decorations),
        );
      } else {
        const contextKey = `context:${point.id}`;
        markerCache.use(
          contextKey,
          JSON.stringify([point, colors.green, colors.white, !!onPick]),
          () => {
            const node = document.createElement("button");
            node.type = "button";
            node.textContent = point.publicBeaconId
              ? categoryMarkerGlyphs[point.category ?? "Other"]
              : "?";
            node.setAttribute(
              "aria-label",
              `${point.publicBeaconId ? "Public Beacon" : "Suggestion"}: ${point.title}`,
            );
            node.style.cssText = `max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:44px;padding:5px 8px;border:1px dashed ${colors.green};border-radius:12px;background:${colors.white};color:${colors.green};font:11px system-ui;cursor:pointer;`;
            if (point.publicBeaconId)
              node.style.cssText = `width:46px;height:46px;border:3px solid ${colors.green};border-radius:16px 16px 16px 5px;background:${colors.white};font-size:25px;cursor:pointer;box-shadow:0 3px 8px #172c2920;`;
            L.DomEvent.disableClickPropagation(node);
            node.onclick = () => markerCache.activate(contextKey);
            return L.marker([point.latitude, point.longitude], {
              zIndexOffset: -100,
              icon: L.divIcon({
                html: node,
                className: "beacon-marker",
                iconSize: [point.publicBeaconId ? 46 : 88, 46],
                iconAnchor: [point.publicBeaconId ? 23 : 44, 23],
              }),
            }).addTo(group);
          },
          () => {
            if (!onPick) onContextPoint?.(point);
          },
        );
      }
    }
    const models = artworkCache.build(
      presentations.flatMap(presentationArtworkPoints),
      activities,
      profiles,
      freshLocations,
      availabilityActivities,
      identityData,
      identityViewer,
      now,
    );
    const activitiesById = new Map(activities.map((item) => [item.id, item]));
    const contextsById = new Map(
      contextPoints
        .filter((point) => point.publicBeaconId)
        .map((point) => [point.publicBeaconId, point]),
    );
    const memberArtwork = (member: ClusterPoint, full = false) => {
      const id = member.id.slice(7);
      const model = models.get(member.id)!;
      const activity = activitiesById.get(id);
      const context = contextsById.get(id);
      const profile = model.profile;
      const state = model.availability,
        age = model.age;
      return marker(
        member.latitude,
        member.longitude,
        categoryMarkerGlyphs[member.category ?? "Other"],
        profile
          ? `Map friend: ${profile.name}, ${state}, location ${age}`
          : `Map: ${activity?.title ?? context?.title ?? "Beacon"}`,
        () => {
          if (latest.current.onPick) return;
          if (profile) latest.current.onPerson(profile.id);
          else if (activity) latest.current.onActivity(activity.id);
          else if (context) {
            const current = latest.current.contextPoints?.find(
              (point) => point.id === context.id,
            );
            if (current) latest.current.onContextPoint?.(current);
          }
        },
        !!profile,
        profile ? (profile.avatar_seed ?? avatarSeed(profile.id)) : 0,
        profile
          ? availability[state === "ending-soon" ? "endingSoon" : state].color
          : categories[member.category ?? "Other"].color,
        selectedActivityId === id,
        false,
        "",
        state,
        false,
        "",
        activity
          ? markerIdentity(identityData, activity, identityViewer)
          : null,
        !!activity && ownsMapBeacon(identityData, activity, identityViewer),
        true,
        full,
      ) as HTMLButtonElement;
    };
    for (const presentation of presentations.filter(
      (item) => item.mode !== "stack" || item.group.members.length > 1,
    )) {
      const cluster = presentation.group;
      const open = () => {
        if (onPick) return;
        const targetZoom = Math.min(
          MAP_MAX_ZOOM,
          m.getZoom() + (m.getZoom() < 16 ? 0.5 : 0),
        );
        const target = adjustedMapCenter(
          cluster.latitude,
          cluster.longitude,
          targetZoom,
        );
        if (target) {
          programmaticMove.current = true;
          m.flyTo(target, targetZoom, { duration: reducedMotion ? 0 : 0.3 });
        }
        onCluster?.(
          cluster,
          m.latLngToContainerPoint([cluster.latitude, cluster.longitude]),
          clusterOpenSection.current,
        );
      };
      const clusterKey = `cluster:${cluster.id}`;
      const dimmed =
        contextPoints.some((point) => point.activityId) &&
        !cluster.members.some((member) =>
          contextPoints.some(
            (point) => member.id === `beacon:${point.activityId}`,
          ),
        );
      const visualRevision = JSON.stringify([
        presentation.mode,
        presentation.overflow,
        presentation.people.map((point) => point.id),
        presentation.friendsProminent,
        bloomGeometry(presentation).satelliteOffsets,
        bloomGeometry(presentation).friendBadge,
        presentation.owned.map((point) => point.id),
        presentationArtworkPoints(presentation).map((point) => [
          point.id,
          models.get(point.id)?.revision,
          contextsById.get(point.id.slice(7))?.title,
        ]),
        presentation.mode === "swarm" ? cluster.members : null,
        colors.ink,
        colors.white,
        colors.line,
        colors.green,
        categories,
        availability,
        reducedMotion,
        !!onPick,
        dimmed,
      ]);
      const constellationMarker = markerCache.use(
        clusterKey,
        visualRevision,
        () => {
          const rendered = webConstellation(presentation, {
            member: memberArtwork,
            open: (section) => {
              clusterOpenSection.current = section;
              try {
                markerCache.activate(clusterKey);
              } finally {
                clusterOpenSection.current = undefined;
              }
            },
            ink: colors.ink,
            surface: colors.white,
            line: colors.line,
            ownership: mapIdentityColors.ownership,
            reducedMotion,
            categoryColor: (point) =>
              categories[point.category ?? "Other"].color,
          });
          if (dimmed) rendered.node.style.opacity = "0.65";
          L.DomEvent.disableClickPropagation(rendered.node);
          L.DomEvent.disableScrollPropagation(rendered.node);
          if (onPick) {
            rendered.node.style.pointerEvents = "none";
            rendered.node.inert = true;
          }
          const instance = L.marker([cluster.latitude, cluster.longitude], {
            icon: L.divIcon({
              html: rendered.node,
              className: "beacon-marker",
              iconSize: [rendered.size, rendered.size],
              iconAnchor: [rendered.size / 2, rendered.size / 2],
            }),
            keyboard: false,
          }).addTo(group);
          const constellationElement = instance.getElement();
          if (constellationElement)
            constellationElement.style.pointerEvents = "none";
          return instance;
        },
        open,
      ) as Leaflet.Marker;
      const previous = constellationMarker.getLatLng();
      if (
        previous.lat !== cluster.latitude ||
        previous.lng !== cluster.longitude
      )
        constellationMarker.setLatLng([cluster.latitude, cluster.longitude]);
    }
    physicalPlaces.forEach((p) => {
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
          `Map: ${a.title}${ownsMapBeacon(identityData, a, identityViewer) ? ", Your Beacon" : ""}${markerIdentity(identityData, a, identityViewer) ? `, ${markerIdentity(identityData, a, identityViewer)!.label}` : ""}`,
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
          markerIdentity(identityData, a, identityViewer),
          ownsMapBeacon(identityData, a, identityViewer),
          false,
          true,
          `beacon:${a.id}`,
        );
    });
    const labelIds = visibleFriendLabels(
      freshLocations
        .filter(
          (l) =>
            renderedSingletonIds.has(`person:${l.owner_id}`) &&
            l.latitude != null &&
            l.longitude != null,
        )
        .map((l) => ({
          id: l.owner_id,
          latitude: l.latitude!,
          longitude: l.longitude!,
        })),
      m.getZoom(),
    );
    if (showAvatars)
      freshLocations
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
              labelIds.has(p.id) ? friendLocationLabel(p.name, ageLabel) : "",
              availabilityState.replace("-", " "),
              false,
              "",
              null,
              false,
              false,
              false,
              `person:${p.id}`,
            );
          }
        });
    if (selected && isValidCoordinate(selected))
      markerCache.use(
        "selected",
        JSON.stringify([
          selected,
          selectionIsTemporary,
          colors.green,
          colors.white,
          colors.lime,
        ]),
        () =>
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
          }).addTo(group),
      );
    markerCache.end();
    decorationCache.end();
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
    markerCache,
    decorationCache,
    presentationCache,
    artworkCache,
    identityData,
    identityViewer,
    ready,
    layoutVersion,
    viewVersion,
    contextPoints,
    contextPaths,
    onContextPoint,
    onPick,
    controlCommand,
    colors,
    resolvedAppearance,
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
    friendsProminent,
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
    if (command.kind === "focus" && command.coordinates?.[0]) {
      const point = command.coordinates[0];
      const center = adjustedMapCenter(point.latitude, point.longitude, 16);
      if (center) currentMap.setView(center, 16, { animate: false });
    } else if (command.kind === "restore" && command.camera)
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
    adjustedMapCenter,
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
      {tileError && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry basemap"
          onPress={() => setTileRetry((value) => value + 1)}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            minHeight: 44,
            padding: 10,
            borderRadius: 12,
            backgroundColor: colors.bg,
          }}
        >
          <Text style={{ color: colors.ink }}>
            Map tiles unavailable · Retry
          </Text>
        </Pressable>
      )}
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
