import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
const nativeStorageOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web")
      return typeof sessionStorage === "undefined"
        ? null
        : sessionStorage.getItem(key);
    const count = Number((await SecureStore.getItemAsync(key + ".count")) ?? 0);
    if (!count) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + i),
      ),
    );
    return chunks.some((c) => c === null) ? null : chunks.join("");
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined")
        sessionStorage.setItem(key, value);
      return;
    }
    const previousCount = Number(
      (await SecureStore.getItemAsync(key + ".count")) ?? 0,
    );
    const count = Math.ceil(value.length / 1800);
    await SecureStore.deleteItemAsync(key + ".count");
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        key + "." + i,
        value.slice(i * 1800, (i + 1) * 1800),
        nativeStorageOptions,
      );
    for (let i = count; i < previousCount; i++)
      await SecureStore.deleteItemAsync(key + "." + i);
    await SecureStore.setItemAsync(
      key + ".count",
      String(count),
      nativeStorageOptions,
    );
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
      return;
    }
    const count = Number((await SecureStore.getItemAsync(key + ".count")) ?? 0);
    await SecureStore.deleteItemAsync(key + ".count");
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(key + "." + i);
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;
const pendingRequests = new Map<string, { fingerprint: string; id: string }>();
export function clearPendingRequests() {
  pendingRequests.clear();
}
export async function rpc(
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (!supabase) throw new Error("Connect Supabase to use a real account.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to continue.");
  const key = session.user.id + ":" + action;
  // Keep only the latest operation of each kind in memory. Coordinates are never retried.
  const retryable = ![
    "update_location",
    "start_location",
    "stop_location",
  ].includes(action);
  const fingerprint = JSON.stringify(payload);
  const previous = retryable ? pendingRequests.get(key) : undefined;
  const requestId =
    previous?.fingerprint === fingerprint ? previous.id : randomUUID();
  if (retryable) pendingRequests.set(key, { fingerprint, id: requestId });
  const { data, error, status } = await supabase.rpc("beacon_action", {
    action,
    payload,
    request_id: requestId,
  });
  if (status !== 0) pendingRequests.delete(key);
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}
