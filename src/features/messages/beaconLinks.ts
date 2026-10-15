/** Only known app routes become internal previews; arbitrary external URLs stay text. */
export function beaconLinkId(body: string, webOrigin?: string) {
  const candidates =
    body.match(/(?:squadbeacon:\/\/|https?:\/\/|\/activity\/)[^\s<>]+/g) ?? [];
  for (const candidate of candidates) {
    const clean = candidate.replace(/[),.!?]+$/, "");
    let path: string;
    if (clean.startsWith("/activity/")) path = clean;
    else if (clean.startsWith("squadbeacon://"))
      path = "/" + clean.slice("squadbeacon://".length).replace(/^\/+/, "");
    else {
      try {
        const url = new URL(clean);
        if (!webOrigin || url.origin !== webOrigin) continue;
        path = url.pathname;
      } catch {
        continue;
      }
    }
    const match = /^\/activity\/([a-zA-Z0-9_-]+)(?:[?#].*)?$/.exec(path);
    if (match) return match[1];
  }
}
