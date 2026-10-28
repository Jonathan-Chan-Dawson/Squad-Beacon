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

export function authCallbackUrl(recovery = false) {
  const base =
    typeof window !== "undefined" &&
    window.location?.protocol.startsWith("http")
      ? `${window.location.origin}/auth/callback`
      : "squadbeacon://auth/callback";
  return base + (recovery ? "?type=recovery" : "");
}
