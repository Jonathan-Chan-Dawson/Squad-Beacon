/** Client feedback only; server validation remains authoritative. */
export function basicProfilePayload(
  name: string,
  username: string,
  birth: string,
  timezone: string,
  today = new Date(),
) {
  const cleanName = name.trim();
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanName || cleanName.length > 80)
    throw new Error("Enter your name, up to 80 characters.");
  if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername))
    throw new Error(
      "Use 3–24 letters, numbers, or underscores for your username.",
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth))
    throw new Error("Enter your birth date as YYYY-MM-DD.");
  const date = new Date(`${birth}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== birth
  )
    throw new Error("Enter a valid calendar date as YYYY-MM-DD.");
  const anniversary = Number(birth.slice(5, 7)) * 100 + Number(birth.slice(8));
  const current = (today.getMonth() + 1) * 100 + today.getDate();
  const age =
    today.getFullYear() -
    Number(birth.slice(0, 4)) -
    (current < anniversary ? 1 : 0);
  if (age < 16 || age > 120)
    throw new Error(
      "Squad Beacon is for ages 16 and older. Check your birth date.",
    );
  return {
    name: cleanName,
    username: cleanUsername,
    birth_date: birth,
    timezone,
  };
}

export function profileEntryError(failure: unknown) {
  const message =
    failure instanceof Error
      ? failure.message
      : "Could not save your profile. Try again.";
  return /profiles_username_key|duplicate key.*username/i.test(message)
    ? "That username is already in use. Choose another one."
    : message;
}

export function authOrigin(configured = process.env.EXPO_PUBLIC_AUTH_ORIGIN) {
  const failure = () =>
    new Error(
      "Account emails are not configured. Set EXPO_PUBLIC_AUTH_ORIGIN to your public HTTPS website and rebuild the app.",
    );
  if (!configured?.trim()) throw failure();
  let url: URL;
  try {
    url = new URL(configured.trim().replace(/\/+$/, ""));
  } catch {
    throw failure();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw failure();
  return url.origin;
}

export function authCallbackUrl(
  recovery = false,
  configured = process.env.EXPO_PUBLIC_AUTH_ORIGIN,
) {
  return `${authOrigin(configured)}/auth/confirm${recovery ? "?type=recovery" : ""}`;
}

export function accountEmail(value: string) {
  const address = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    throw new Error("Enter a valid email address.");
  return address;
}

export function usableAuthLink(params: {
  code?: unknown;
  token_hash?: unknown;
  type?: unknown;
  error_description?: unknown;
}) {
  if (params.error_description) return false;
  if (params.code != null)
    return (
      typeof params.code === "string" &&
      !!params.code.trim() &&
      params.token_hash == null
    );
  return (
    typeof params.token_hash === "string" &&
    !!params.token_hash.trim() &&
    ["email", "signup", "recovery"].includes(String(params.type)) &&
    typeof params.type === "string"
  );
}
