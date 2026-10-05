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
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      status = 503;
      throw new Error("Worldwide search has not been configured yet.");
    }
    const raw = await request.text();
    if (raw.length > 1024) throw new Error("Search is too long.");
    const { query } = JSON.parse(raw);
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
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.attributions,places.googleMapsUri",
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
