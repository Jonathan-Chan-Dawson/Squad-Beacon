/** Shared scan order: together now, free starred/close friends, free, then starred. */
export function friendPriority({
  together,
  free,
  starred,
  close,
}: {
  together: boolean;
  free: boolean;
  starred: boolean;
  close: boolean;
}) {
  if (together) return 0;
  if (free && starred) return 1;
  if (free && close) return 2;
  if (free) return 3;
  if (starred) return 4;
  if (close) return 5;
  return 6;
}
