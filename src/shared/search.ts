/** Consistent forgiving matching without exposing fields the viewer cannot see. */
export function matchesSearch(
  query: string,
  ...visibleFields: (string | null | undefined)[]
) {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const haystack = normalize(visibleFields.filter(Boolean).join(" "));
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
