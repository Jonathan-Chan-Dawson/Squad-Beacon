/** All user-facing Live Update copy. Internal feature names never appear in labels. */
export const pulseCopy = {
  liveUpdate: "Live Update",
  areaUpdate: "Area Update",
  title: "What's it like here?",
  add: "Add Live Update",
  post: "Post",
  posting: "Posting",
  posted: "Update posted",
  postFailure: "Couldn't post. Tap to retry",
  rateLimited: "You've posted a lot, try again soon",
  retry: "Retry",
  close: "Close place preview",
  noData: "No recent updates",
  unavailable: "Live Updates are unavailable right now",
  invalidPlace: "Choose a valid place on the map",
  invalidArea: "Choose a valid area on the map",
  invalidAnswer: "Choose an available option for this place",
  noteTooLong: "Keep your update to 80 characters or fewer",
  invalidReceipt: "Live Updates are unavailable right now",
  shortUpdate: "Add a short update…",
  noteLabel: "Short place update",
  noteHint: "Describe the place, without personal information.",
  noteMenu: "Update note options",
  reportNote: "Report",
  reportSuccess: "Note hidden and reported",
  reportFailure: "Couldn't report this note. Try again",
  stillTrue: "Still true",
  confirming: "Confirming",
  confirmed: "Thanks, confirmed",
  confirmSuccess: "Live Update confirmed",
  confirmFailure: "Couldn't confirm. Try again",
  update: "Update",
  createBeacon: "Create Beacon here",
  happeningHere: "Happening here",
  communityReported: "Community reported",
  reportedPrefix: "Reported ",
  likelyPrefix: "Likely ",
  closureWeak: "Users report this may be closed",
  directions: "Directions",
  liveUpdates: "Live Updates",
  legend: "Live Update key",
  hintPin: "Tap a pin to RSVP",
  hintLongPress: "Long-press the map to add an update",
  hintList: "Pull up for the list",
  hintDismiss: "Dismiss map hint",
  categories: { restaurant: "Restaurant", cafe: "Cafe", bar: "Bar", gym: "Gym", court: "Court", field: "Field", recreation: "Recreation", parking: "Parking", trail: "Trail", park: "Park", library: "Library", study: "Study space", unknown: "Place", area: "Area Update" },
  crowd: ["Quiet", "Moderate", "Busy", "Packed"],
  wait: ["No wait", "5–10 min", "10–20 min", "20+ min"],
  parking: ["Available", "Limited", "Full"],
  groups: { crowd: "Crowd", wait: "Wait", parking: "Parking", availability: "Availability", condition: "Conditions" },
  conditions: {
    seats_available: "Seats available",
    courts_open: "Courts open",
    courts_occupied: "Courts occupied",
    people_waiting: "People waiting",
    equipment_available: "Equipment available",
    trail_muddy: "Muddy trail",
    field_wet: "Wet field",
    blocked_closed: "Closed / blocked",
  },
} as const;

export const pulseRecentUpdates = (count: number) => `${count} recent update${count === 1 ? "" : "s"}`;
export const pulseUpdatedAgo = (updatedAt: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60000));
  return minutes === 0 ? "Updated just now" : `Updated ${minutes} min ago`;
};
export const pulseNoteCounter = (count: number) => `${count}/80`;

export function pulseKindLabel(kind: string) {
  return pulseCopy.groups[kind as keyof typeof pulseCopy.groups] ?? pulseCopy.groups.condition;
}

export function pulseOptionLabel(kind: string, value: number | string) {
  if (typeof value === "number") {
    const levels = kind === "crowd" ? pulseCopy.crowd : kind === "wait" ? pulseCopy.wait : kind === "parking" ? pulseCopy.parking : undefined;
    return levels?.[value] ?? pulseCopy.noData;
  }
  return pulseCopy.conditions[value as keyof typeof pulseCopy.conditions] ?? pulseCopy.noData;
}

export function pulseLevelText(kind: string, value: number | string, weak: boolean) {
  const label = pulseOptionLabel(kind, value);
  const text = kind === "wait" && value !== 0 ? label + " wait" : kind === "parking" ? label + " parking" : label;
  return weak ? (kind === "wait" ? pulseCopy.likelyPrefix : pulseCopy.reportedPrefix) + text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function pulseConditionText(key: string, strength: "reported" | "likely") {
  if (key === "blocked_closed" && strength === "reported") return pulseCopy.closureWeak;
  return pulseLevelText("condition", key, strength === "reported");
}

export function pulseMetaText(count: number, updatedAt: number, now: number) {
  return count > 0 ? pulseRecentUpdates(count) + " · " + pulseUpdatedAgo(updatedAt, now) : pulseCopy.noData;
}

export const pulseCategoryLabel = (category: string) => pulseCopy.categories[category as keyof typeof pulseCopy.categories] ?? pulseCopy.categories.unknown;
