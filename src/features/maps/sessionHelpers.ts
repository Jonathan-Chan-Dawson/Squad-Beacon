import type { LocationSession } from "@/src/shared/types";

export const SONAR_LOCATION_FRESHNESS_MS = 5 * 60 * 1000;

/** Return the owner's actual unexpired Sonar session, even when its last point is stale. */
export function activeSonarSession(
  locations: readonly LocationSession[],
  ownerId: string | null | undefined,
  now = Date.now(),
) {
  if (!ownerId) return undefined;
  return locations.find((session) => {
    if (session.owner_id !== ownerId) return false;
    const expiresAt = Date.parse(session.expires_at);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export function sonarLocationIsFresh(session: LocationSession, now = Date.now()) {
  if (
    !session.updated_at ||
    session.latitude == null ||
    session.longitude == null ||
    !Number.isFinite(session.latitude) ||
    !Number.isFinite(session.longitude) ||
    Math.abs(session.latitude) > 90 ||
    Math.abs(session.longitude) > 180
  ) return false;
  const updatedAt = Date.parse(session.updated_at);
  return Number.isFinite(updatedAt) && updatedAt <= now + 30_000 && now - updatedAt < SONAR_LOCATION_FRESHNESS_MS;
}

export function sonarMinutesRemaining(expiresAt: string, now = Date.now()) {
  const milliseconds = Date.parse(expiresAt) - now;
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? Math.ceil(milliseconds / 60_000)
    : 0;
}

export type LocationShareDuration = "15 minutes" | "1 hour" | "Until activity ends";
export const MAX_LOCATION_SHARE_MS = 4 * 60 * 60 * 1000;

/** Add duration to an active expiry, capped at four hours from now as enforced by the server. */
export function locationShareExpiry(
  duration: LocationShareDuration,
  now: number,
  activeExpiresAt?: string,
  activityEndsAt?: string,
) {
  const parsedActiveExpiry = activeExpiresAt ? Date.parse(activeExpiresAt) : Number.NaN;
  const base = Number.isFinite(parsedActiveExpiry) && parsedActiveExpiry > now
    ? parsedActiveExpiry
    : now;
  const maximumExpiry = now + MAX_LOCATION_SHARE_MS;
  if (base >= maximumExpiry) return undefined;
  let requestedExpiry: number;
  if (duration === "Until activity ends") {
    const activityEnd = activityEndsAt ? Date.parse(activityEndsAt) : Number.NaN;
    if (!Number.isFinite(activityEnd) || activityEnd <= base) return undefined;
    requestedExpiry = activityEnd;
  } else {
    requestedExpiry = base + (duration === "15 minutes" ? 15 : 60) * 60 * 1000;
  }
  const expiry = Math.min(requestedExpiry, maximumExpiry);
  return expiry > base ? expiry : undefined;
}

const recentQueriesByViewer = new Map<string, string[]>();

/** Keep only searches the viewer actually submitted, in memory for this app session. */
export function rememberMapSearchQuery(query: string, viewerId: string | null | undefined) {
  if (!viewerId) return [];
  const value = query.trim().replace(/\s+/g, " ");
  const recentQueries = recentQueriesByViewer.get(viewerId) ?? [];
  if (value.length < 2) return recentQueries.slice();
  const normalized = value.toLocaleLowerCase();
  const next = [
    value,
    ...recentQueries.filter((item) => item.toLocaleLowerCase() !== normalized),
  ].slice(0, 6);
  recentQueriesByViewer.set(viewerId, next);
  return next.slice();
}

export function getRecentMapSearchQueries(viewerId: string | null | undefined) {
  return viewerId ? (recentQueriesByViewer.get(viewerId) ?? []).slice() : [];
}
