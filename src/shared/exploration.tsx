import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Category } from "@/src/shared/types";

export type Coordinate = { latitude: number; longitude: number };
export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};
export type ExplorationArea =
  | { kind: "near-me"; label: string; coordinate?: Coordinate; zoom?: number }
  | {
      kind: "place";
      label: string;
      coordinate: Coordinate;
      zoom: number;
      source: "saved" | "demo" | "google";
      attributions?: { name: string; uri?: string }[];
    }
  | {
      kind: "viewport";
      label: string;
      coordinate: Coordinate;
      zoom: number;
      bounds: MapBounds;
    };
export type ExplorationFilters = {
  /** Everyone/Friends or an existing list, squad, or organization audience ID. */
  audience: "Everyone" | "Friends" | "Public" | (string & {});
  category: "All categories" | Category;
  time: "All" | "Now" | "Upcoming";
  planId: string | null;
  /** New discovery filters stay optional so older map/filter constructors remain valid. */
  when?: "Any" | "Today" | "Tonight" | "Tomorrow" | "Weekend";
  join?:
    | "Any"
    | "Open"
    | "Needs People"
    | "I'm In"
    | "Request Approval"
    | "Invited"
    | "Spots Available";
  format?: "Any" | "Physical" | "Virtual";
  starredOnly?: boolean;
};
export type MapViewport = {
  center: Coordinate;
  zoom: number;
  bounds: MapBounds;
};
export type ExplorationTarget = {
  center: Coordinate;
  zoom: number;
  revision: number;
};

export function explorationAreaTarget(
  area: ExplorationArea | null,
): ExplorationTarget | null {
  if (!area) return null;
  const center =
    area.kind === "viewport" ? boundsCenter(area.bounds) : area.coordinate;
  if (!center) return null;
  const zoom = area.kind === "near-me" ? (area.zoom ?? 13) : area.zoom;
  const key = JSON.stringify(area);
  let revision = 2166136261;
  for (let index = 0; index < key.length; index++) {
    revision = Math.imul(revision ^ key.charCodeAt(index), 16777619);
  }
  return { center, zoom, revision: revision >>> 0 };
}

export function isValidCoordinate(point: Coordinate): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

export function boundsCenter(bounds: MapBounds): Coordinate {
  const span = bounds.east - bounds.west;
  const width = Math.abs(span) >= 360 ? 360 : (span + 360) % 360;
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: ((bounds.west + width / 2 + 540) % 360) - 180,
  };
}

export function coordinateInBounds(
  coordinate: Coordinate,
  bounds: MapBounds,
): boolean {
  const latitudeInside =
    coordinate.latitude <= bounds.north && coordinate.latitude >= bounds.south;
  const longitudeInside =
    bounds.west <= bounds.east
      ? coordinate.longitude >= bounds.west &&
        coordinate.longitude <= bounds.east
      : coordinate.longitude >= bounds.west ||
        coordinate.longitude <= bounds.east;
  return latitudeInside && longitudeInside;
}

export function matchesExplorationArea(
  area: ExplorationArea | null,
  coordinate: Coordinate | null | undefined,
): boolean {
  if (!area || area.kind === "near-me" || !coordinate) return true;
  if (!isValidCoordinate(coordinate)) return false;
  if (area.kind === "viewport")
    return coordinateInBounds(coordinate, area.bounds);
  const latitudeDelta = 180 / 2 ** Math.max(1, Math.min(22, area.zoom));
  const longitudeDelta = Math.min(
    179.9,
    latitudeDelta /
      Math.max(0.15, Math.cos((area.coordinate.latitude * Math.PI) / 180)),
  );
  if (longitudeDelta >= 180)
    return (
      coordinate.latitude <=
        Math.min(90, area.coordinate.latitude + latitudeDelta) &&
      coordinate.latitude >=
        Math.max(-90, area.coordinate.latitude - latitudeDelta)
    );
  return coordinateInBounds(coordinate, {
    north: Math.min(90, area.coordinate.latitude + latitudeDelta),
    south: Math.max(-90, area.coordinate.latitude - latitudeDelta),
    east: ((area.coordinate.longitude + longitudeDelta + 540) % 360) - 180,
    west: ((area.coordinate.longitude - longitudeDelta + 540) % 360) - 180,
  });
}

export function viewportDiffersFromTarget(
  viewport: MapViewport,
  target: ExplorationTarget,
  toleranceDegrees = 0.015,
): boolean {
  return (
    Math.abs(viewport.center.latitude - target.center.latitude) >
      toleranceDegrees ||
    Math.abs(
      ((viewport.center.longitude - target.center.longitude + 540) % 360) - 180,
    ) > toleranceDegrees ||
    Math.abs(viewport.zoom - target.zoom) > 0.75
  );
}

export type ExplorationContextValue = {
  query: string;
  setQuery: (query: string) => void;
  area: ExplorationArea | null;
  areaRevision: number;
  setArea: (area: ExplorationArea | null) => void;
  filters: ExplorationFilters;
  setFilters: (filters: ExplorationFilters) => void;
};
const defaultFilters: ExplorationFilters = {
  audience: "Everyone",
  category: "All categories",
  time: "All",
  planId: null,
};
const ExplorationContext = createContext<ExplorationContextValue | null>(null);

export function ExplorationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [area, setAreaValue] = useState<ExplorationArea | null>(null);
  const [areaRevision, setAreaRevision] = useState(0);
  const setArea = useCallback((next: ExplorationArea | null) => {
    setAreaValue(next);
    setAreaRevision((revision) => revision + 1);
  }, []);
  const [filters, setFilters] = useState(defaultFilters);
  const value = useMemo(
    () => ({
      query,
      setQuery,
      area,
      areaRevision,
      setArea,
      filters,
      setFilters,
    }),
    [query, area, areaRevision, setArea, filters],
  );
  return (
    <ExplorationContext.Provider value={value}>
      {children}
    </ExplorationContext.Provider>
  );
}

export function useExploration(): ExplorationContextValue {
  const value = useContext(ExplorationContext);
  if (!value)
    throw new Error("useExploration must be used inside ExplorationProvider");
  return value;
}
