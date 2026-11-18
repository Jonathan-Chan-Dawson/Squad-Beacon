// Private entry routes remain in memory. Only a public Beacon continuation can
// survive a reload/email callback, without storing tokens or personal data.
let pending: string | null = null;
let storage: { read(): string | null; write(value: string): void } | undefined;
export function setEntryIntentStorage(next: typeof storage) {
  storage = next;
}
function persist(destination: string | null) {
  try {
    storage?.write(
      destination && /^\/discover\/[0-9a-f-]{36}$/i.test(destination)
        ? JSON.stringify({ destination, expires: Date.now() + 86400000 })
        : "",
    );
  } catch {
    /* In-memory handoff still works. */
  }
}
const supported =
  /^\/(?:invite|guest-claim|share|discover\/[^/]+|create|activity\/[^/]+(?:\/chat)?|person\/[^/]+|squad\/[^/]+|squad-chat\/[^/]+|messages\/[^/]+|space\/[^/]+|organization\/[^/]+|council\/[^/]+|plan\/[^/]+|activities|profile(?:\/edit)?|map|squads|your-activity|plans|calendar|friends|responses|settings(?:\/premium)?|library|find-friends|location|widgets|beacon-templates|plan-editor|squad-boosts)\/?$/;

export function rememberEntryIntent(
  path: string,
  params: Record<string, string | string[] | undefined>,
) {
  if (path === "/") {
    pending = "/";
    persist(null);
    return;
  }
  if (
    path === "/browse-beacons" &&
    typeof params.publicBeacon === "string" &&
    /^[0-9a-f-]{36}$/i.test(params.publicBeacon)
  ) {
    pending = `/discover/${params.publicBeacon}`;
    persist(pending);
    return;
  }
  if (!supported.test(path) || /[\\?#]/.test(path)) return;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Expo includes dynamic route parameters in this object as well.
    if (value != null)
      for (const part of Array.isArray(value) ? value : [value])
        search.append(key, part);
  }
  pending = path + (search.size ? `?${search}` : "");
  // Dynamic router params are redundant for the public exact-ID route.
  persist(path.startsWith("/discover/") ? path.replace(/\/$/, "") : null);
}
export function consumeEntryIntent() {
  let saved: string | null = null;
  try {
    const parsed = JSON.parse(storage?.read() || "null");
    if (
      parsed &&
      parsed.expires > Date.now() &&
      /^\/discover\/[0-9a-f-]{36}$/i.test(parsed.destination)
    )
      saved = parsed.destination;
  } catch {
    /* Invalid or unavailable storage is ignored. */
  }
  const destination = pending ?? saved ?? "/";
  pending = null;
  persist(null);
  return destination;
}
export function clearEntryIntent() {
  pending = null;
  persist(null);
}
