import { beaconPinImage, beaconPinPath } from "../beaconPinArtwork";
import { mapBeaconTitle } from "@/src/features/discovery/discoveryCardPresentation";
import { planPathArrowheads } from "../contextFilters";
import type { Category } from "@/src/shared/types";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { bloomGeometry } from "../clusterBloom";
import { KeyedMapLayers } from "../keyedMapLayers";
import { ClusterArtworkCache, type ClusterMemberArtwork } from "../clusterArtwork";
import { nextAvailabilityExpiry } from "@/src/features/beacons/availability";
import { useAvailabilityNow } from "@/src/features/beacons/availabilityClock";
import {
  prepareMapIdentity,
  mapBeaconMarkerStates,
  markerStateLabel,
  beaconPinEmphasis,
  beaconMarkerBadges,
  beaconBadgeArtwork,
  BEACON_BADGE_SIZE,
  BEACON_BADGE_GAP,
  beaconMarkerColor,
  constellationRelationships,
  personMarkerBadges,
  EMPTY_MARKER_STATE,
  distantBeaconPinEmphasis,
  BEACON_PIN_LIGHT_INSET,
  BEACON_PIN_TIP,
  BEACON_SELECTED_SCALE,
  BEACON_PULSE_SCALE,
  beaconPulseStyle,
  type BeaconMarkerState,
  ownsMapBeacon,
  mapIdentityColors,
  friendLocationLabel,
  visibleMapLabels,
  BEACON_NAME_MAX_WIDTH,
} from "../markerIdentity";
import { useBeacon } from "@/src/shared/store";
import {
  nativeMapMode,
  MapPresentationCache,
  presentationArtworkPoints,
  type NativeMapMode,
} from "../nativeMapPresentation";
import { appendBeaconUpperBeam, appendMapProjector, beaconProjectionDimensions } from "../projector";
import { webConstellation } from "../webConstellation";
import { beaconMapLook } from "@/src/features/beacons/rewardLooks";
import type { ClusterPoint } from "../cluster";
import { useDesignTheme } from "@/src/theme";
import { miniAvatarSvg, avatarSeed } from "@/src/features/profile/avatarArt";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIsFocused } from "expo-router";
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
import { locationIsFresh } from "@/src/shared/domain";
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

function addBeaconGlyph(node: HTMLElement, category: Category, size: number, icon?: string | null) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "display:block;flex:none;";
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", beaconPinPath(category, icon));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.9");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  node.append(svg);
  const uri = beaconPinImage(icon);
  if (!uri) return;
  const image = document.createElement("img");
  image.alt = "";
  image.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${size + 5}px;height:${size + 5}px;object-fit:cover;border-radius:7px;`;
  image.onerror = () => image.remove();
  image.src = uri;
  node.append(image);
}

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

function mapTimeChip(activity: MapProps["activities"][number], now: number) {
  const startsAt = Date.parse(activity.starts_at);
  const endsAt = Date.parse(activity.ends_at);
  if (isBeaconLive(activity, now))
    return `${Math.max(1, Math.ceil((endsAt - now) / 60_000))}m left`;
  return Number.isFinite(startsAt)
    ? new Date(startsAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

export default function BeaconMap(props: MapProps) {
  const focusedRoute = useIsFocused();
  const { colors, resolvedAppearance } = useTheme();
  const { categories } = useDesignTheme();
  const { data: identityData, userId: identityViewer } = useBeacon();
  const mapNow = useNow();
  const availabilityNow = useAvailabilityNow(nextAvailabilityExpiry(identityData.viewer_id === identityViewer ? identityData.presence : undefined, mapNow), focusedRoute);
  const now = Math.max(mapNow, availabilityNow);
  const identityLookup = useMemo(
    () => prepareMapIdentity(identityData, identityViewer),
    [identityData, identityViewer],
  );
  const markerStates = useMemo(
    () => mapBeaconMarkerStates(identityData, props.activities, props.contextPoints, identityLookup, now),
    [props.activities, props.contextPoints, identityData, identityLookup, now],
  );
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
    appliedTargetRevision = useRef<number | null>(null),
    programmaticMove = useRef(false),
    gestureActive = useRef(false),
    removeGestureListeners = useRef<(() => void) | null>(null),
    appliedControlRevision = useRef<number | null>(null);
  useEffect(() => {
    // Placement is explicit Map intent; a later initial fit must not move its pin.
    if (props.onPick) fitted.current = true;
  }, [props.onPick]);
  const pendingCameraCommand = useRef<{
    revision: number;
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const settleCameraCommand = useCallback(() => {
    const pending = pendingCameraCommand.current,
      m = map.current;
    if (
      !pending ||
      !m ||
      gestureActive.current ||
      appliedControlRevision.current !== pending.revision
    )
      return;
    const center = m.getCenter();
    if (
      Math.abs(center.lat - pending.lat) < 0.0001 &&
      Math.abs(((center.lng - pending.lng + 540) % 360) - 180) < 0.0001 &&
      Math.abs(m.getZoom() - pending.zoom) < 0.05
    ) {
      pendingCameraCommand.current = null;
      latest.current.onCameraCommandSettled?.(pending.revision, Date.now());
    }
  }, []);
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
  const onPick = props.onPick != null;
  useEffect(() => {
    const pause = () => element.current?.classList.toggle("beacon-map-paused", !focusedRoute || document.hidden);
    pause();
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [focusedRoute, ready]);
  useEffect(() => {
    if (reducedMotion) map.current?.stop();
  }, [ready, reducedMotion]);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    let active = true;
    let cameraFrame: number | undefined;
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
        m.getContainer().classList.add("beacon-map-moving");
        pendingCameraCommand.current = null;
        gestureActive.current = true;
        latest.current.onGestureChange?.(true);
      };
      const markKeyboardGesture = (event: KeyboardEvent) => {
        if (
          emptyMapTarget(event.target) &&
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "+",
            "-",
            "=",
          ].includes(event.key)
        )
          markGesture();
      };
      const markZoomGesture = () => {
        if (!programmaticMove.current) {
          m.getContainer().classList.add("beacon-map-moving");
          pendingCameraCommand.current = null;
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
          fitted.current = true;
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
      container.addEventListener("keydown", markKeyboardGesture);
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
        container.removeEventListener("keydown", markKeyboardGesture);
        container.removeEventListener("touchstart", markPinchGesture);
        container.removeEventListener("touchstart", startHold);
        container.removeEventListener("touchmove", moveHold);
        container.removeEventListener("touchend", endHold);
        container.removeEventListener("touchcancel", endHold);
        container.removeEventListener("click", suppressHoldClick, true);
      };
      const commitCamera = () => {
        cameraFrame = undefined;
        updateAnchor();
        settleCameraCommand();
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
        m.getContainer().classList.remove("beacon-map-moving");
        gestureActive.current = false;
        latest.current.onGestureChange?.(false);
        programmaticMove.current = false;
        setViewVersion((version) => version + 1);
      };
      m.on("moveend zoomend resize", () => {
        if (cameraFrame == null) cameraFrame = requestAnimationFrame(commitCamera);
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
          fitted.current = true;
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
      if (cameraFrame != null) cancelAnimationFrame(cameraFrame);
      resize.disconnect();
      removeGestureListeners.current?.();
      removeGestureListeners.current = null;
      markerCache.clear();
      decorationCache.clear();
      // Leaflet 1.9 leaves a zoom-end timeout pending after remove(). Prevent
      // that callback from touching a disposed pane during an account change.
      const disposed = map.current as (Leaflet.Map & { _animatingZoom?: boolean }) | null;
      disposed?.stop();
      if (disposed) disposed._animatingZoom = false;
      map.current?.remove();
      map.current = null;
    };
  }, [markerCache, decorationCache, settleCameraCommand]);
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
    activities,
    availabilityActivities = activities,
    places,
    locations,
    profiles,
    selected,
    selectionIsTemporary = false,
    selectedActivityId = null,
    selectedPersonId = null,
    focusBackground,
    focused,
    fullScreen,
    hideControls = false,
    controlsTop = 12,
    viewportInsets,
    clusterPriorities = {},
    friendsProminent = false,
    explorationTarget,
    onOptions,
    onRecenter,
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
    planPathArrowheads(contextPaths).forEach(({ coordinates, category }, index) => {
      const color = category ? categories[category].color : colors.green;
      decorationCache.use(
        `plan-direction:${index}`,
        JSON.stringify([coordinates, color]),
        () => {
          const arrow = L.polyline(
            coordinates.map(({ latitude, longitude }) => [latitude, longitude]),
            { color, weight: 2.5, lineCap: "round", interactive: false },
          ).addTo(decorations);
          arrow.getElement()?.setAttribute("data-testid", "map-plan-direction");
          return arrow;
        },
      );
    });
    const activitiesById = new Map(activities.map((item) => [item.id, item]));
    const profilesById = new Map(profiles.map((item) => [item.id, item]));
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
              activitiesById.has(place.activity_id),
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
      identity: BeaconMarkerState | null = null,
      owned = false,
      detached = false,
      fullMarker = false,
      cacheKey?: string,
      customIcon?: string | null,
      stopNumber?: number,
      beaconName?: string,
      cosmetic?: ReturnType<typeof beaconMapLook>,
      availabilityDetail?: ClusterMemberArtwork["availabilityDetail"],
      personBadges?: ClusterMemberArtwork["personBadges"],
    ): HTMLButtonElement | Leaflet.Marker => {
      if (!friend) tone = beaconMarkerColor(identity);
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
          customIcon,
          stopNumber,
          beaconName,
          cosmetic,
          availabilityDetail,
          personBadges,
          colors.white,
          colors.ink,
          colors.line,
          colors.success,
          identityViewer,
          reducedMotion,
          resolvedAppearance,
          !!onPick,
          presentationMode.current,
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
              undefined,
              customIcon,
              stopNumber,
              beaconName,
              cosmetic,
              availabilityDetail,
              personBadges,
            ) as Leaflet.Marker,
          click,
        ) as Leaflet.Marker;
        const previous = entry.getLatLng();
        if (previous.lat !== lat || previous.lng !== lng)
          entry.setLatLng([lat, lng]);
        return entry;
      }
      const street = presentationMode.current === "stack";
      const compactProjection = presentationMode.current === "swarm";
      const compact = detached && !fullMarker;
      const node = document.createElement("button");
      const dot =
        !friend && !detached && !stopNumber && !selectedPin &&
        (presentationMode.current === "atmosphere" || presentationMode.current === "micro");
      const visualSize = compact
        ? 32
        : dot
          ? 10
          : !street && !stopNumber && !friend
            ? 30
            : friend ? street ? 32 : 24 : markerVisualSize("beacon");
      const iconWidth = compact ? 32 : 64;
      const pinInset = !friend && !dot && !detached ? BEACON_PIN_LIGHT_INSET : 0;
      const tipSize = BEACON_PIN_TIP;
      const tipTop = pinInset + markerVisualSize("beacon") - tipSize.overlap;
      const tipBottom = tipTop + tipSize.height;
      const projected = (street || compactProjection) && !dot && !compact && !dimmed && !onPick && !friend;
      const projection = projected
        ? beaconProjectionDimensions(street ? "close" : presentationMode.current === "swarm" ? "medium" : "far")
        : undefined;
      const iconHeight = compact ? 32 : friend ? 52 : (timeChip || beaconName ? 68 : 48) + pinInset + (projection ? 15 : 0);
      node.type = "button";
      node.setAttribute("aria-label", label);
      node.title = label;
      node.dataset.availability = availabilityLabel;
      node.style.cssText = `position:relative;border:0;border-radius:0;background:transparent;color:${colors.ink};padding:${pinInset}px 0 0;box-sizing:border-box;width:${iconWidth}px;height:${iconHeight}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font:600 16px system-ui;cursor:pointer;opacity:${dimmed ? 0.28 : 1};filter:${dimmed ? "saturate(.25)" : "none"};transform:scale(${selectedPin && !compact ? BEACON_SELECTED_SCALE : 1});transform-origin:50% ${friend || dot || compact ? "50%" : `${tipBottom}px`};transition:${reducedMotion ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease"};`;
      if (selectedPin && !friend && !detached) node.setAttribute("aria-current", "true");
      if (selectedPin && !detached) {
        const ring = document.createElement("span");
        ring.dataset.testid = "map-marker-selection-ring";
        ring.setAttribute("aria-hidden", "true");
        ring.style.cssText = `position:absolute;left:50%;top:${friend ? visualSize / 2 : tipBottom}px;transform:translate(-50%,-50%);width:${friend ? visualSize + 9 : 30}px;height:${friend ? visualSize + 9 : 30}px;border:2px dotted ${mapIdentityColors.selection};border-radius:50%;pointer-events:none;`;
        node.append(ring);
      }
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
        if (!dimmed && street && availabilityDetail?.progress != null) {
          const arc = document.createElement("span");
          arc.dataset.testid = "avatar-availability-arc";
          arc.style.cssText = `position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(from 120deg,${availabilityDetail.arcColor} 0deg ${availabilityDetail.progress * 120}deg,transparent ${availabilityDetail.progress * 120}deg);mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2.5px));pointer-events:none;`;
          frame.append(arc);
        }
        if (!dimmed && availabilityLabel !== "unknown") {
          const status = document.createElement("span");
          status.dataset.testid = `avatar-status-${availabilityLabel.replace(" ", "-")}`;
          const busy = availabilityLabel === "unavailable";
          status.textContent = busy ? "−" : "✓";
          status.style.cssText = `position:absolute;bottom:-3px;right:-3px;width:12px;height:12px;border:1px solid ${colors.white};border-radius:50%;background:${busy ? "#F0B574" : "#79DDB0"};color:#243129;display:grid;place-items:center;font:700 8px system-ui;box-sizing:border-box;`;
          frame.append(status);
        }
        if (!dimmed && street && !compact) personBadges?.forEach((name, index) => {
          const badge = personMarkerBadges[name];
          const node = document.createElement("span");
          node.setAttribute("aria-hidden", "true");
          node.textContent = badge.glyph;
          node.style.cssText = `position:absolute;top:-3px;${index === 0 ? "left" : "right"}:-3px;width:12px;height:12px;border:1px solid ${colors.white};border-radius:50%;background:${badge.color};color:#26243A;display:grid;place-items:center;font:700 8px system-ui;pointer-events:none;`;
          frame.append(node);
        });
        node.append(frame);
        const age = document.createElement("span");
        age.textContent = ageLabel;
        age.style.cssText = `position:relative;margin-top:2px;padding:0 5px;border:1px solid ${colors.line};border-radius:8px;background:${colors.white};color:${colors.ink};font:700 9px system-ui;white-space:nowrap;max-width:94px;overflow:hidden;text-overflow:ellipsis;`;
        if (ageLabel) node.append(age);
      } else {
        const lighting = !dot && !dimmed && !onPick
          ? beaconPinEmphasis(identity, selectedPin && !compact, tone, compact)
          : null;
        const upperLight = street ? lighting : distantBeaconPinEmphasis(
          lighting,
          presentationMode.current === "swarm" ? "medium" :
            presentationMode.current === "atmosphere" ? "far" : "micro",
        );
        const face = document.createElement("span");
        face.dataset.clusterFace = "true";
        face.style.cssText =
          "position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
        if (street && nowBeacon && !detached && !dimmed && !onPick) {
          const pulse = beaconPulseStyle(identity, selectedPin, tone);
          const halo = document.createElement("span");
          halo.className = "map-now-halo";
          halo.setAttribute("aria-hidden", "true");
          halo.style.cssText = `position:absolute;left:50%;top:50%;width:${visualSize}px;height:${visualSize}px;margin:${-visualSize / 2}px 0 0 ${-visualSize / 2}px;box-sizing:border-box;pointer-events:none;border-radius:50%;border:1.5px solid ${pulse.color};background:${pulse.color}25;--beacon-pulse-opacity:${pulse.opacity};--beacon-pulse-duration:${pulse.duration}ms;--beacon-pulse-scale:${BEACON_PULSE_SCALE};`;
          face.append(halo);
        }
        if (!detached && upperLight?.beamHeight)
          appendBeaconUpperBeam(node, upperLight, pinInset);
        if (projection)
          appendMapProjector(node, tone,
            pinInset + visualSize - 5,
            projection.height,
            projection.width,
            projection.opacity,
            "beacon");
        if (street && !dot && !compact) {
          const tip = document.createElement("span");
          tip.dataset.testid = "beacon-pin-tip";
          tip.setAttribute("aria-hidden", "true");
          tip.style.cssText = `position:absolute;left:50%;top:${tipTop}px;width:0;height:0;margin-left:-${tipSize.halfWidth}px;border:${tipSize.halfWidth}px solid transparent;border-top:${tipSize.height}px solid ${projected ? "transparent" : tone};border-bottom:0;pointer-events:none;`;
          node.append(tip);
        }
        const badge = document.createElement("span");
        if (!dot) addBeaconGlyph(badge, text as Category, compact ? 17 : 22, compact ? undefined : customIcon);
        badge.style.cssText = `position:relative;box-sizing:border-box;flex-shrink:0;width:${visualSize}px;height:${visualSize}px;border:${dot ? 1 : compact ? 2 : 3}px solid ${dot ? colors.white : tone};border-radius:${visualSize / 2}px;background:${dot ? tone : colors.surface};display:flex;align-items:center;justify-content:center;box-shadow:${dot ? "none" : `0 0 10px ${tone}85,0 3px 10px #172c2940`};font-size:${compact ? 20 : 22}px;`;
        if (upperLight) {
          const { level, color, glowOpacity } = upperLight;
          const inner = Math.round(glowOpacity * (street && !compact ? 255 : 120)).toString(16).padStart(2, "0");
          const outer = Math.round(glowOpacity * (street && !compact ? 132 : 35)).toString(16).padStart(2, "0");
          const prominent = !compact && (level === 1 || level === 2);
          const haloRadius = compact || !street ? 8 : level === 1 ? 36 : level === 2 ? 19 : level === 3 ? 13 : 10;
          const shadow = prominent ? "0 4px 12px #11182777" : `0 3px ${compact ? 5 : 9}px #11182744`;
          const glow = `0 0 ${compact ? 3 : level === 1 ? 13 : prominent ? 8 : 6}px ${color}${inner},0 0 ${haloRadius}px ${color}${outer},${shadow}`;
          badge.style.boxShadow = glow;
          badge.dataset.testid = "beacon-marker-glow";
          badge.dataset.lightingLevel = String(level);
        }
        face.append(badge);
        if (stopNumber) {
          const order = document.createElement("span");
          order.dataset.testid = "map-plan-stop-badge";
          order.setAttribute("aria-hidden", "true");
          order.textContent = String(stopNumber);
          order.style.cssText = `position:absolute;left:-4px;top:-4px;min-width:16px;height:16px;box-sizing:border-box;padding:0 3px;border:1px solid ${tone};border-radius:8px;background:${colors.surface};color:${colors.textPrimary};display:grid;place-items:center;font:700 9px system-ui;pointer-events:none;`;
          face.append(order);
        }
        if (!dimmed && !dot && (street || presentationMode.current === "swarm")) {
          const badges = beaconMarkerBadges(identity ?? EMPTY_MARKER_STATE, street && !compact ? 3 : 1);
          if (badges.length) {
            const row = document.createElement("span");
            row.dataset.testid = "beacon-marker-badges";
            row.setAttribute("aria-hidden", "true");
            row.style.cssText = `position:absolute;bottom:-4px;left:0;right:0;display:flex;justify-content:center;gap:${BEACON_BADGE_GAP}px;pointer-events:none;`;
            for (const kind of badges) {
              const { color, testId, path, filled } = beaconBadgeArtwork[kind];
              const ownedBadge = kind === "ownership";
              const item = document.createElement("span");
              item.dataset.testid = testId;
              item.style.cssText = `box-sizing:border-box;flex:none;width:${BEACON_BADGE_SIZE}px;height:${BEACON_BADGE_SIZE}px;border-radius:50%;border:1px solid ${ownedBadge ? color : colors.surface};background:${ownedBadge ? "#30251E" : color};color:${ownedBadge ? color : "#252031"};display:grid;place-items:center;${ownedBadge ? `box-shadow:0 0 4px ${color}` : ""}`;
              item.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="${filled ? "none" : "currentColor"}" stroke-width="2.5" stroke-linecap="round"><path d="${path}"/></svg>`;
              row.append(item);
            }
            face.append(row);
          }
        }
        node.append(face);
        if (beaconName || timeChip) {
          const chip = document.createElement("span");
          chip.textContent = beaconName || timeChip;
          if (beaconName) {
            chip.dataset.testid = "beacon-map-name";
            chip.setAttribute("aria-hidden", "true");
          }
          chip.style.cssText = `position:relative;margin-top:${projection?.height ?? BEACON_PIN_TIP.height}px;padding:1px 7px;border:1px solid ${beaconName ? colors.line : tone};border-radius:8px;background:${beaconName ? colors.surface : colors.white};color:${colors.ink};font:700 10px system-ui;white-space:nowrap;box-sizing:border-box;max-width:${BEACON_NAME_MAX_WIDTH}px;overflow:hidden;text-overflow:ellipsis;`;
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
            : [iconWidth / 2, dot ? 5 : tipBottom],
        }),
        zIndexOffset: selectedPin ? 1000 : dimmed ? -100 : 0,
        title: label,
        keyboard: !stopNumber,
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
        const activity = activitiesById.get(place.activity_id);
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
            const profile = profilesById.get(location.owner_id);
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
    const markerLabels = visibleMapLabels(
      clusterPoints,
      new Set(presentations.flatMap(({ group }) =>
        group.members.length === 1
          ? [group.members[0].id] : [])),
      m.getZoom(),
      (id) => id === `beacon:${selectedActivityId}` || id === `person:${selectedPersonId}` ? 0 : markerStates.get(id.slice(7))?.owned ? 1 : id.startsWith("person:") || markerStates.get(id.slice(7))?.friendHosted ? 2 : 3,
    );
    for (const id of markerLabels) renderedSingletonIds.add(id);
    const pulseBudget = Math.max(
      0,
      150 -
        presentations.reduce((n, item) => n + item.featureCost, 0) -
        contextPaths.length -
        contextPoints.length -
        Number(!!selected),
    );
    const contextActivityIds = new Set(contextPoints.flatMap((point) => point.activityId ? [point.activityId] : []));
    const planStopIds = new Set(contextPoints.flatMap((point) => point.stopNumber && point.activityId ? [point.activityId] : []));
    const liveSingletonIds = new Set((presentationMode.current === "stack" ? [...markerStates] : [])
      .filter(([id, state]) => state.live &&
        (renderedSingletonIds.has(`beacon:${id}`) || planStopIds.has(id)) &&
        (!selectedActivityId || selectedActivityId === id || planStopIds.has(id)) &&
        (!contextActivityIds.size || contextActivityIds.has(id)))
      .sort(([left, a], [right, b]) =>
        Number(right === selectedActivityId) - Number(left === selectedActivityId) ||
        Number(b.participatingLive) - Number(a.participatingLive))
      .slice(0, Math.min(3, pulseBudget))
      .map(([id]) => id));
    if (!onPick && size.x && presentationMode.current !== "micro" && focusBackground?.length && presentations.length < 70) {
      for (const point of focusBackground.slice(0, Math.max(0, pulseBudget - liveSingletonIds.size))) {
        decorationCache.use(point.id, JSON.stringify(point), () => L.circleMarker([point.latitude, point.longitude], { radius: point.kind === "person" ? 4 : 5, stroke: false, fillColor: "#A4A0B4", fillOpacity: 0.28, interactive: false }).addTo(decorations));
      }
    }
    for (const point of contextPoints) {
      const activate = () => {
        const current = latest.current.contextPoints?.find((row) => row.id === point.id);
        if (!latest.current.onPick && current) latest.current.onContextPoint?.(current);
      };
      if (point.stopNumber) {
        const category = point.category ?? "Other";
        const state = point.activityId ? markerStates.get(point.activityId) ?? null : null;
        marker(
          point.latitude, point.longitude, category,
          `Plan stop ${point.stopNumber}: ${point.title}`, activate,
          false, 0, categories[category].color, selectedActivityId === point.activityId,
          false, "", "unknown", !!point.activityId && liveSingletonIds.has(point.activityId), "", state, !!state?.owned, false, true,
          `context:${point.id}`, point.mapIcon, point.stopNumber,
        );
        continue;
      }
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
            if (point.publicBeaconId) addBeaconGlyph(node, point.category ?? "Other", 23, point.mapIcon);
            else node.textContent = "?";
            node.setAttribute(
              "aria-label",
              `${point.publicBeaconId ? "Public Beacon" : "Suggestion"}: ${point.title}`,
            );
            node.style.cssText = `max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:44px;padding:5px 8px;border:1px dashed ${colors.green};border-radius:12px;background:${colors.white};color:${colors.green};font:11px system-ui;cursor:pointer;`;
            if (point.publicBeaconId)
              node.style.cssText = `width:46px;height:46px;border:2px solid ${mapIdentityColors.other};border-radius:13px;background:${colors.surface};display:grid;place-items:center;color:${colors.ink};position:relative;cursor:pointer;box-shadow:0 3px 8px #172c2920;`;
            L.DomEvent.disableClickPropagation(node);
            node.onclick = () => markerCache.activate(contextKey);
            return L.marker([point.latitude, point.longitude], {
              // The inner button owns keyboard focus and its accessible name.
              keyboard: false,
              zIndexOffset: -100,
              icon: L.divIcon({
                html: node,
                className: "beacon-marker",
                iconSize: [
                  point.publicBeaconId ? 46 : 88,
                  46,
                ],
                iconAnchor: [
                  point.publicBeaconId ? 23 : 44,
                  23,
                ],
              }),
            }).addTo(group);
          },
          activate,
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
      identityLookup,
      availabilityNow,
    );
    const contextsById = new Map(
      contextPoints
        .filter((point) => point.publicBeaconId)
        .map((point) => [point.publicBeaconId, point]),
    );
    const memberArtwork = (member: ClusterPoint) => {
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
        member.category ?? "Other",
        profile
          ? `Map friend: ${profile.name}, ${state}, location ${age}`
          : `Map: ${model.label ?? context?.title ?? "Beacon"}`,
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
          ? model.relationshipColor ?? mapIdentityColors.personOther
          : categories[member.category ?? "Other"].color,
        selectedActivityId === id,
        false,
        "",
        state,
        false,
        "",
        activity ? model.markerState : null,
        !!activity && ownsMapBeacon(identityData, activity, identityViewer),
        true,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        beaconMapLook(identityData.equipped_looks?.[id]),
        model.availabilityDetail,
      ) as HTMLButtonElement;
    };
    for (const presentation of presentations.filter(
      (item) => item.group.members.length !== 1 || !renderedSingletonIds.has(item.group.members[0].id),
    )) {
      const cluster = presentation.group;
      const open = () => {
        if (onPick) return;
        latest.current.onCluster?.(
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
        presentation.scale,
        presentation.overflow,
        presentation.people.map((point) => [
          point.id,
          models.get(point.id)?.revision,
        ]),
        presentation.friendsProminent,
        bloomGeometry(presentation).satelliteOffsets,
        bloomGeometry(presentation).countBadge,
        bloomGeometry(presentation).dots,
        bloomGeometry(presentation).signal,
        constellationRelationships(presentation.beacons, (point) => markerStates.get(point.id.slice(7)), bloomGeometry(presentation).dots.length),
        bloomGeometry(presentation).shadowSize,
        bloomGeometry(presentation).projector,
        presentation.owned.map((point) => point.id),
        presentationArtworkPoints(presentation).map((point) => [
          point.id,
          models.get(point.id)?.revision,
          identityData.equipped_looks?.[point.id.slice(7)],
          contextsById.get(point.id.slice(7))?.title,
        ]),
        presentation.mode === "swarm" ? cluster.members : null,
        colors.ink,
        colors.white,
        colors.line,
        colors.green,
        categories,
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
            friendColor: (point) => {
              const model = models.get(point.id);
              return model?.relationshipColor ?? mapIdentityColors.personOther;
            },
            friendAvatar: (point) => {
              const profile = models.get(point.id)?.profile;
              if (!profile) return undefined;
              const seed = profile.avatar_seed ?? avatarSeed(profile.id);
              return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(miniAvatarSvg(seed));
            },
            categoryColor: (category) => categories[category].color,
            beaconState: (point) => !dimmed && !onPick ? markerStates.get(point.id.slice(7)) : undefined,
          });
          rendered.node.setAttribute(
            "aria-label",
            `${rendered.node.getAttribute("aria-label")}. ${cluster.members
              .map((m) => models.get(m.id)?.label ?? "")
              .filter(Boolean)
              .join("; ")}`,
          );
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
      const a = activitiesById.get(p.activity_id);
      const state = a ? (markerStates.get(a.id) ?? null) : null;
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
          a.category,
          `Map: ${a.title}${markerStateLabel(state!) ? `, ${markerStateLabel(state!)}` : ""}`,
          () => latest.current.onActivity(a.id),
          false,
          0,
          categories[a.category].color,
          selectedActivityId === a.id,
          (!!selectedActivityId && selectedActivityId !== a.id) ||
            (contextPoints.some((point) => point.activityId) &&
              !contextPoints.some((point) => point.activityId === a.id)),
          "",
          "unknown",
          liveSingletonIds.has(a.id),
          contextPoints.find((point) => point.activityId === a.id)?.suggestion
            ? "Suggestion"
            : contextPoints.some((point) => point.activityId === a.id)
              ? "In focus"
              : m.getZoom() >= 15
                ? mapTimeChip(a, now)
                : "",
          state,
          ownsMapBeacon(identityData, a, identityViewer),
          false,
          true,
          `beacon:${a.id}`,
          m.getZoom() >= 14 || selectedActivityId === a.id ? a.map_icon : undefined,
          undefined,
          !onPick && !contextPoints.some((point) => point.activityId === a.id) &&
            markerLabels.has(`beacon:${a.id}`)
            ? mapBeaconTitle(a.title, !!a.plan_id, a.plan_step_index).title.trim()
            : undefined,
          beaconMapLook(identityData.equipped_looks?.[a.id]),
        );
    });
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
          const p = profilesById.get(l.owner_id);
          if (p && l.latitude != null && l.longitude != null) {
            const personModel = models.get(`person:${p.id}`);
            const availabilityState = personModel?.availability ?? "unknown";
            const personSelected = selectedPersonId === p.id;
            const ageLabel = formatLocationAge(l.updated_at, now) ?? "now";
            marker(
              l.latitude,
              l.longitude,
              p.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join(""),
              `Map friend: ${p.name}, ${personModel?.availabilityDetail?.label ?? availabilityState.replace("-", " ")}, location ${ageLabel}`,
              () => latest.current.onPerson(p.id),
              true,
              p.avatar_seed ?? avatarSeed(p.id),
              personModel?.relationshipColor ?? mapIdentityColors.personOther,
              personSelected,
              false,
              personSelected ? `${p.name}${personModel?.availabilityDetail ? ` · ${personModel.availabilityDetail.label}` : ""}` : markerLabels.has(`person:${p.id}`) ? friendLocationLabel(p.name, ageLabel) : "",
              availabilityState.replace("-", " "),
              false,
              "",
              null,
              false,
              false,
              false,
              `person:${p.id}`,
              undefined, undefined, undefined, undefined, personModel?.availabilityDetail, personModel?.personBadges,
            );
          }
        });
    if (selected && isValidCoordinate(selected))
      markerCache.use(
        "selected",
        JSON.stringify([
          selected,
          selectionIsTemporary,
          !!onPick,
          colors.green,
          colors.white,
          colors.lime,
        ]),
        () =>
          L.marker([selected.latitude, selected.longitude], {
            interactive: !!onPick || !selectionIsTemporary,
            keyboard: !!onPick || !selectionIsTemporary,
            draggable: !!onPick,
            icon: L.divIcon({
              html: selectionIsTemporary
                ? `<span data-testid="map-temporary-pin" data-latitude="${selected.latitude}" data-longitude="${selected.longitude}" role="img" aria-label="Selected map location" style="display:block;width:26px;height:32px;filter:drop-shadow(0 2px 4px #0005)"><svg width="26" height="32" viewBox="0 0 24 28" fill="${colors.white}" stroke="${colors.green}" stroke-width="2"><path d="M21 10c0 7-9 15-9 15S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3" fill="${colors.green}" stroke="none"/></svg></span>`
                : `<span style="position:relative;width:34px;height:34px;border:2px solid ${colors.green};border-radius:50%;background:${colors.lime};display:flex;align-items:center;justify-content:center;color:${colors.green};font-size:22px;font-weight:700;box-shadow:0 3px 10px #172c2940"><span style="position:absolute;top:24px;z-index:-1;width:12px;height:12px;background:${colors.green};transform:rotate(45deg);border-radius:2px"></span>+</span>`,
              className: "beacon-marker",
              iconSize: selectionIsTemporary ? [26, 32] : [44, 50],
              iconAnchor: selectionIsTemporary ? [13, 32] : [22, 50],
            }),
          })
            .on("dragend", (event) => {
              const point = event.target.getLatLng();
              latest.current.onPick?.(point.lat, point.lng);
            })
            .addTo(group),
      );
    markerCache.end();
    decorationCache.end();
    if (
      !fitted.current &&
      !onPick &&
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
    identityLookup,
    markerStates,
    ready,
    layoutVersion,
    viewVersion,
    contextPoints,
    contextPaths,
    onPick,
    controlCommand,
    colors,
    resolvedAppearance,
    categories,
    availabilityNow,
    activities,
    availabilityActivities,
    places,
    locations,
    profiles,
    selected,
    selectionIsTemporary,
    selectedActivityId,
    selectedPersonId,
    focusBackground,
    showAvatars,
    now,
    reducedMotion,
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
      (onPick && command?.kind !== "focus") ||
      !command ||
      !currentMap ||
      !hasUsableMapViewport(currentMap)
    )
      return;
    if (appliedControlRevision.current === command.revision) return;
    appliedControlRevision.current = command.revision;
    fitted.current = true;

    // A context fit must cancel an in-flight overview/exploration animation.
    pendingCameraCommand.current = null;
    currentMap.stop();
    programmaticMove.current = true;
    if (command.kind === "focus" && command.coordinates?.[0]) {
      const point = command.coordinates[0];
      const zoom = Math.max(0, Math.min(MAP_MAX_ZOOM, command.zoom ?? 16));
      const center = adjustedMapCenter(point.latitude, point.longitude, zoom);
      if (center) {
        if (command.notifySettled)
          pendingCameraCommand.current = {
            revision: command.revision,
            lat: center.lat,
            lng: center.lng,
            zoom,
          };
        currentMap.setView(center, zoom, {
          animate: command.animate === true && !reducedMotion,
          duration: (command.durationMs ?? 450) / 1000,
        });
        settleCameraCommand();
      }
    } else if (command.kind === "restore" && command.camera) {
      currentMap.setView(
        [command.camera.center.latitude, command.camera.center.longitude],
        command.camera.zoom,
        {
          animate: command.animate === true && !reducedMotion,
          duration: (command.durationMs ?? 450) / 1000,
        },
      );
    } else if (command.kind === "zoom-in") currentMap.zoomIn();
    else if (command.kind === "zoom-out") currentMap.zoomOut();
    else if (command.coordinates?.length)
      currentMap.fitBounds(
        command.coordinates.map(
          (point) => [point.latitude, point.longitude] as Leaflet.LatLngTuple,
        ),
        {
          paddingTopLeft: [mapInsets.left + 24, mapInsets.top + 24],
          paddingBottomRight: [mapInsets.right + 24, mapInsets.bottom + 24],
          maxZoom: 16,
          // Apply explicit relationship fits atomically during initial map layout.
          animate: false,
        },
      );
    else fit();
  }, [
    controlCommand,
    fit,
    adjustedMapCenter,
    settleCameraCommand,
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
