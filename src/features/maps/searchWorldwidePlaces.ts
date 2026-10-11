import { supabase } from "@/src/shared/supabase";
import { parseWorldwidePlaces, validatePlaceQuery } from "./placeSearch";

export async function searchWorldwidePlaces(query: string, provider: "google" | "osm" = "google") {
  const text = validatePlaceQuery(query);
  if (!supabase)
    throw new Error("Connect a real account to search worldwide places.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to search worldwide places.");
  const { data, error } = await supabase.functions.invoke("places-search", {
    body: { query: text, provider },
  });
  if (error) {
    throw new Error(
      "Worldwide place search is unavailable. Try again later.",
    );
  }
  return parseWorldwidePlaces(data);
}
