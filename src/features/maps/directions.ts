/** Builds a standard map destination URL for a physical coordinate. */
export function physicalDirectionsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${latitude},${longitude}`,
  )}`;
}
