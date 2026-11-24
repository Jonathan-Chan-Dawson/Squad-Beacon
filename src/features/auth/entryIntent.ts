// Private entry routes remain in memory. Persist only sanitized public Beacon or Create paths.
let pending: string | null = null;
let storage: { read(): string | null; write(value: string): void } | undefined;
export function setEntryIntentStorage(next: typeof storage) {
  storage = next;
}
function isReloadSafe(destination: unknown): destination is string {
  return (
    typeof destination === "string" &&
    (destination === "/create" ||
      /^\/discover\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
        destination,
      ))
  );
}
function persist(destination: string | null) {
  try {
    storage?.write(
      isReloadSafe(destination)
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
  persist(path.replace(/\/$/, ""));
}
export function consumeEntryIntent() {
  let saved: string | null = null;
  try {
    const parsed = JSON.parse(storage?.read() || "null");
    if (
      parsed &&
      isReloadSafe(parsed.destination) &&
      Number.isFinite(parsed.expires)
    )
      saved =
        parsed.expires > Date.now()
          ? parsed.destination
          : "/activities?entryExpired=1";
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
