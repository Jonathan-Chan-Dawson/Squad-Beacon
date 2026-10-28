// In-memory only: retain supported incoming destinations across auth callbacks.
let pending: string | null = null;
const supported =
  /^\/(?:invite|activity\/[^/]+(?:\/chat)?|person\/[^/]+|squad\/[^/]+|squad-chat\/[^/]+|messages\/[^/]+|space\/[^/]+|organization\/[^/]+|council\/[^/]+|plan\/[^/]+|activities|profile|map|squads)\/?$/;

export function rememberEntryIntent(
  path: string,
  params: Record<string, string | string[] | undefined>,
) {
  if (!supported.test(path) || /[\\?#]/.test(path)) return;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Expo includes dynamic route parameters in this object as well.
    if (value != null)
      for (const part of Array.isArray(value) ? value : [value])
        search.append(key, part);
  }
  pending = path + (search.size ? `?${search}` : "");
}
export function consumeEntryIntent() {
  const destination = pending ?? "/";
  pending = null;
  return destination;
}
export function clearEntryIntent() {
  pending = null;
}
