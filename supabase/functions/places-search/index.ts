import { admin, headers, user } from "../_shared/server.ts";

// Explicit text searches only; never send the account's GPS or social data.
Deno.serve(async (request) => {
  let cors: Record<string, string>;
  try {
    cors = headers(request);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });
  let status = 400;
  try {
    const account = await user(request);
    const raw = await request.text();
    if (raw.length > 1024) throw new Error("Search is too long.");
    const { query, provider = "google" } = JSON.parse(raw);
    if (provider !== "google" && provider !== "osm")
      throw new Error("Invalid search provider.");
    if (
      typeof query !== "string" ||
      query.trim().length < 3 ||
      query.trim().length > 160
    )
      throw new Error("Enter a place or city between 3 and 160 characters.");
    const budget = await admin().rpc("reserve_places_search", {
      account_id: account.id,
    });
    if (budget.error) {
      status = 429;
      throw new Error("Place search limit reached. Please try again later.");
    }
    if (provider === "osm") {
      const endpoint = new URL(
        "/api/",
        Deno.env.get("PHOTON_API_URL") || "https://photon.komoot.io",
      );
      if (endpoint.protocol !== "https:")
        throw new Error("Place search is unavailable.");
      endpoint.searchParams.set("q", query.trim());
      endpoint.searchParams.set("limit", "6");
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        status = 503;
        throw new Error("Place search is unavailable.");
      }
      const result = await response.json();
      const places = (Array.isArray(result.features) ? result.features : [])
        .slice(0, 6)
        .flatMap(
          (feature: {
            properties?: Record<string, unknown>;
            geometry?: { coordinates?: number[] };
          }) => {
            const props = feature.properties ?? {};
            const [longitude, latitude] = feature.geometry?.coordinates ?? [];
            if (
              typeof props.name !== "string" ||
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              Math.abs(latitude) > 90 ||
              Math.abs(longitude) > 180
            )
              return [];
            return [
              {
                id: `osm:${props.osm_type}:${props.osm_id}`,
                name: { text: props.name },
                address: [props.city, props.state, props.country]
                  .filter((item) => typeof item === "string")
                  .join(", "),
                location: { latitude, longitude },
                primaryType: [
                  "city",
                  "town",
                  "village",
                  "state",
                  "county",
                ].includes(String(props.type))
                  ? "locality"
                  : "place",
                attributions: [
                  {
                    provider: "? OpenStreetMap contributors",
                    providerUri: "https://www.openstreetmap.org/copyright",
                  },
                ],
              },
            ];
          },
        );
      return new Response(JSON.stringify({ places }), {
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    }
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      status = 503;
      throw new Error("Worldwide search has not been configured yet.");
    }
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.attributions,places.googleMapsUri,places.primaryType",
        },
        body: JSON.stringify({ textQuery: query.trim(), pageSize: 6 }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      status = 503;
      throw new Error(
        "Google Places search is unavailable. Please try again later.",
      );
    }
    const result = await response.json();
    const places = (Array.isArray(result.places) ? result.places : [])
      .slice(0, 6)
      .map((place: Record<string, unknown>) => ({
        id: place.id,
        name: place.displayName,
        address: place.formattedAddress,
        location: place.location,
        viewport: place.viewport,
        attributions: place.attributions ?? [],
        googleMapsUri: place.googleMapsUri,
        primaryType: place.primaryType,
      }));
    return new Response(JSON.stringify({ places }), {
      headers: { ...cors, "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Place search failed.";
    const expected = new Set([
      "Worldwide search has not been configured yet.",
      "Search is too long.",
      "Enter a place or city between 3 and 160 characters.",
      "Place search limit reached. Please try again later.",
      "Google Places search is unavailable. Please try again later.",
    ]);
    const safe =
      message === "Unauthorized"
        ? "Sign in to search worldwide places."
        : error instanceof SyntaxError
          ? "Enter a valid search."
          : expected.has(message)
            ? message
            : "Place search is unavailable. Please try again later.";
    return new Response(JSON.stringify({ error: safe }), {
      status: message === "Unauthorized" ? 401 : status,
      headers: { ...cors, "Cache-Control": "no-store" },
    });
  }
});
