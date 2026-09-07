import { createClient } from "@supabase/supabase-js";
export const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export function headers(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("WEB_ORIGINS") ?? "")
    .split(",")
    .filter(Boolean);
  if (origin && !allowed.includes(origin))
    throw new Error("Origin not allowed");
  return {
    "Content-Type": "application/json",
    ...(origin
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
export async function user(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}
