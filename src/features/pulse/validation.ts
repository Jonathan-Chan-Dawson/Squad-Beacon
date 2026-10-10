import { isPlaceCategory } from "@/src/features/maps/placeCategories";
import { validPulseAnswer } from "./pulseProfiles";
import { PULSE_KINDS, type PulseDraft, type PulseSummary } from "./types";
import { pulseCopy } from "./copy/pulse";
const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
export function pulseAreaKey(lat: number, lng: number) {
  let south = -90,
    north = 90,
    west = -180,
    east = 180,
    hash = "",
    bits = 0,
    value = 0;
  for (let bit = 0; hash.length < 7; bit++) {
    const longitude = bit % 2 === 0,
      mid = longitude ? (west + east) / 2 : (south + north) / 2;
    const upper = (longitude ? lng : lat) >= mid;
    value = (value << 1) + Number(upper);
    if (longitude) {
      if (upper) west = mid;
      else east = mid;
    } else {
      if (upper) south = mid;
      else north = mid;
    }
    if (++bits === 5) {
      hash += alphabet[value];
      bits = 0;
      value = 0;
    }
  }
  return "area:" + hash;
}
export function pulseAreaCenter(key: string) {
  const hash = key.startsWith("area:") ? key.slice(5) : "";
  if (hash.length !== 7 || [...hash].some((char) => !alphabet.includes(char)))
    throw new Error(pulseCopy.invalidArea);
  let south = -90,
    north = 90,
    west = -180,
    east = 180,
    index = 0;
  for (const char of hash)
    for (let bit = 4; bit >= 0; bit--, index++) {
      const upper = (alphabet.indexOf(char) & (1 << bit)) !== 0;
      if (index % 2 === 0) {
        const mid = (west + east) / 2;
        if (upper) west = mid;
        else east = mid;
      } else {
        const mid = (south + north) / 2;
        if (upper) south = mid;
        else north = mid;
      }
    }
  return { lat: (south + north) / 2, lng: (west + east) / 2 };
}
export function validatePulseDraft(draft: PulseDraft): PulseDraft {
  const { place } = draft;
  if (
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng) ||
    Math.abs(place.lat) > 90 ||
    Math.abs(place.lng) > 180 ||
    !place.placeKey.trim() ||
    place.placeKey.length > 200 ||
    !isPlaceCategory(place.category)
  )
    throw new Error(pulseCopy.invalidPlace);
  if (
    (place.category === "area" ||
      place.isArea ||
      place.placeKey.startsWith("area:")) &&
    (place.category !== "area" ||
      place.placeKey !== pulseAreaKey(place.lat, place.lng))
  )
    throw new Error(pulseCopy.invalidArea);
  const answers = Object.entries(draft.answers);
  if (
    !answers.length ||
    answers.some(
      ([kind, value]) =>
        !(PULSE_KINDS as readonly string[]).includes(kind) ||
        !validPulseAnswer(
          place.category,
          kind as (typeof PULSE_KINDS)[number],
          value,
        ),
    )
  )
    throw new Error(pulseCopy.invalidAnswer);
  const note = draft.note?.trim();
  if (note && note.length > 80) throw new Error(pulseCopy.noteTooLong);
  return {
    place: {
      ...place,
      ...(place.category === "area" ? pulseAreaCenter(place.placeKey) : {}),
    },
    answers: { ...draft.answers },
    ...(note ? { note } : {}),
  };
}
/** Whitelist projection; even a malformed server response cannot leak arbitrary columns to UI. */
export function parsePulseSummaries(value: unknown): PulseSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.placeKey !== "string" ||
      row.placeKey.length > 200 ||
      !isPlaceCategory(row.category) ||
      typeof row.lat !== "number" ||
      typeof row.lng !== "number" ||
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lng) ||
      Math.abs(row.lat) > 90 ||
      Math.abs(row.lng) > 180 ||
      ![
        "recentCount",
        "confirmCount",
        "updatedAt",
        "freshness",
        "importance",
      ].every(
        (key) => typeof row[key] === "number" && Number.isFinite(row[key]),
      )
    )
      return [];
    const summary: PulseSummary = {
      placeKey: row.placeKey,
      category: row.category,
      lat: row.lat,
      lng: row.lng,
      conditions: [],
      recentCount: Math.max(0, Math.trunc(row.recentCount as number)),
      confirmCount: Math.max(0, Math.trunc(row.confirmCount as number)),
      updatedAt: row.updatedAt as number,
      freshness: Math.max(0, Math.min(1, row.freshness as number)),
      importance: Math.max(0, Math.min(1, row.importance as number)),
      confidence: {},
    };
    for (const kind of ["crowd", "wait", "parking"] as const) {
      const number = row[kind];
      if (
        typeof number === "number" &&
        validPulseAnswer(row.category, kind, number)
      )
        Object.assign(summary, { [kind]: number });
    }
    if (Array.isArray(row.conditions))
      for (const item of row.conditions) {
        if (!item || typeof item !== "object") continue;
        const condition = item as Record<string, unknown>;
        if (
          (condition.strength === "reported" ||
            condition.strength === "likely") &&
          (validPulseAnswer(row.category, "availability", condition.key) ||
            validPulseAnswer(row.category, "condition", condition.key))
        )
          summary.conditions.push({
            key: condition.key as PulseSummary["conditions"][number]["key"],
            strength: condition.strength,
          });
      }
    if (row.confidence && typeof row.confidence === "object")
      for (const kind of PULSE_KINDS) {
        const count = (row.confidence as Record<string, unknown>)[kind];
        if (typeof count === "number" && Number.isFinite(count))
          summary.confidence![kind] = Math.max(0, Math.trunc(count));
      }
    if (typeof row.noteSample === "string" && row.noteSample.trim())
      summary.noteSample = row.noteSample.trim().slice(0, 80);
    if (typeof row.generatedAt === "number" && Number.isFinite(row.generatedAt))
      summary.generatedAt = row.generatedAt;
    if (
      typeof row.noteValidUntil === "number" &&
      Number.isFinite(row.noteValidUntil)
    )
      summary.noteValidUntil = row.noteValidUntil;
    if (row.signals && typeof row.signals === "object") {
      summary.signals = {};
      for (const kind of PULSE_KINDS) {
        const signal = (row.signals as Record<string, unknown>)[kind];
        if (!signal || typeof signal !== "object") continue;
        const fields = signal as Record<string, unknown>;
        if (
          [
            "totalWeight",
            "freshness",
            "validUntil",
            "count",
            "updatedAt",
          ].every(
            (key) =>
              typeof fields[key] === "number" && Number.isFinite(fields[key]),
          ) &&
          Number(fields.totalWeight) >= 0 &&
          Number(fields.count) >= 0 &&
          Number(fields.freshness) >= 0 &&
          Number(fields.freshness) <= 1
        )
          summary.signals[kind] = {
            totalWeight: Number(fields.totalWeight),
            freshness: Number(fields.freshness),
            validUntil: Number(fields.validUntil),
            count: Math.trunc(Number(fields.count)),
            updatedAt: Number(fields.updatedAt),
          };
      }
    }
    return [summary];
  });
}

export function requirePulseReceipt(
  value: unknown,
  expected: Pick<PulseDraft["place"], "placeKey" | "lat" | "lng" | "category">,
) {
  const parsed = parsePulseSummaries([value])[0];
  if (
    !parsed ||
    parsed.placeKey !== expected.placeKey ||
    parsed.category !== expected.category ||
    Math.abs(parsed.lat - expected.lat) > 0.00001 ||
    Math.abs(parsed.lng - expected.lng) > 0.00001 ||
    parsed.recentCount < 1
  )
    throw new Error(pulseCopy.invalidReceipt);
  return parsed;
}
