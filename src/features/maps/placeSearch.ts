export type WorldwidePlace = {
  id: string;
  label: string;
  address: string;
  coordinate: { latitude: number; longitude: number };
  attributions: { name: string; uri?: string }[];
  googleMapsUri?: string;
  primaryType?: string;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
const httpsUrl = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export function validatePlaceQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < 3 || trimmed.length > 160)
    throw new Error("Enter a place or city between 3 and 160 characters.");
  return trimmed;
}

export function parseWorldwidePlaces(value: unknown): WorldwidePlace[] {
  const root = record(value);
  if (!Array.isArray(root.places)) return [];
  return root.places.slice(0, 6).flatMap((item) => {
    const place = record(item),
      name = record(place.name),
      location = record(place.location);
    const latitude = location.latitude,
      longitude = location.longitude;
    if (
      typeof place.id !== "string" ||
      typeof name.text !== "string" ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return [];
    const attributions = Array.isArray(place.attributions)
      ? place.attributions.flatMap((item) => {
          const attribution = record(item);
          return typeof attribution.provider === "string"
            ? [
                {
                  name: attribution.provider,
                  uri: httpsUrl(attribution.providerUri),
                },
              ]
            : [];
        })
      : [];
    return [
      {
        id: place.id,
        label: name.text,
        address: typeof place.address === "string" ? place.address : "",
        coordinate: { latitude, longitude },
        attributions,
        googleMapsUri: httpsUrl(place.googleMapsUri),
        primaryType:
          typeof place.primaryType === "string" ? place.primaryType : undefined,
      },
    ];
  });
}
