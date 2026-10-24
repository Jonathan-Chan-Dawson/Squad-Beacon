/** Publication requires a usable HTTPS meeting address; unfinished templates remain exempt. */
export function validCreationMeetingLink(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
