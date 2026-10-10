import type { MapBounds } from "@/src/shared/exploration";
import type { PulseDraft, PulsePlace, PulseSummary } from "./types";
import type { PulseReport } from "./reports";
import { aggregatePulse } from "./aggregatePulse";
import { confirmPulseReport, pulseTTL } from "./expiry";
import { pulseInBounds } from "./bounds";
import { validatePulseDraft } from "./validation";
export const DEMO_PULSE_PLACES: PulsePlace[] = [
  ["demo-cafe", "Riverbend Cafe", 41.884, -87.632, "cafe"],
  ["demo-courts", "Willow Courts", 41.889, -87.626, "court"],
  ["demo-parking", "Market Parking", 41.88, -87.639, "parking"],
  ["demo-trail", "Cedar Trail", 41.895, -87.634, "trail"],
  ["demo-gym", "Beacon Gym", 41.878, -87.628, "gym"],
  ["demo-library", "Harbor Library", 41.887, -87.642, "library"],
  ["demo-restaurant", "Juniper Kitchen", 41.876, -87.637, "restaurant"],
  ["demo-park", "Meadow Park", 41.896, -87.62, "park"],
  ["demo-study", "North Study Hall", 41.89, -87.638, "study"],
  ["demo-field", "Oak Field", 41.882, -87.618, "field"],
].map(
  ([placeKey, name, lat, lng, category]) =>
    ({ placeKey, name, lat, lng, category }) as PulsePlace,
);

/** Fictional local data. This class has no network or device-location dependency. */
export class PulseDemoStore {
  private reports: PulseReport[] = [];
  private own = new Map<string, string>();
  private posts: number[] = [];
  private confirmed = new Map<string, number>();
  private hiddenNotes = new Set<string>();
  private sequence = 0;
  private initialized = false;
  constructor(now?: number) {
    if (now !== undefined) this.seed(now);
  }
  private seed(now: number) {
    if (this.initialized) return;
    this.initialized = true;
    const answers = [
      { crowd: 2, wait: 2 },
      { availability: "courts_occupied", condition: "field_wet" },
      { parking: 1 },
      { condition: "trail_muddy" },
      { crowd: 3, availability: "equipment_available" },
      { crowd: 0, availability: "seats_available" },
      { crowd: 1, wait: 1 },
      { crowd: 2 },
      { crowd: 2, availability: "seats_available" },
      { availability: "courts_open" },
    ] as PulseDraft["answers"][];
    DEMO_PULSE_PLACES.forEach((place, i) => {
      Object.entries(answers[i]).forEach(([kind, value]) => {
        const typedKind = kind as PulseReport["kind"];
        const age = [4, 9, 18, 110, 2, 24, 16, 32, 12, 6][i];
        const createdAt = now - age * 60000;
        const row: PulseReport = {
          id: `seed-${i}-${kind}`,
          placeKey: place.placeKey,
          lat: place.lat,
          lng: place.lng,
          category: place.category,
          kind: typedKind,
          value: value!,
          createdAt,
          expiresAt: createdAt + pulseTTL(typedKind, value!),
          confirmCount: 0,
        };
        this.reports.push(row);
        if (i === 0 || i === 4)
          this.reports.push({
            ...row,
            id: row.id + "-second",
            createdAt: createdAt - 60000,
            expiresAt: row.expiresAt - 60000,
          });
      });
    });
  }
  summaries(bounds: MapBounds, now: number): PulseSummary[] {
    this.seed(now);
    return [...new Set(this.reports.map((report) => report.placeKey))]
      .map((key) =>
        aggregatePulse(
          this.reports
            .filter((report) => report.placeKey === key)
            .map((report) =>
              this.hiddenNotes.has(key + ":" + (report.note ?? ""))
                ? { ...report, note: undefined }
                : report,
            ),
          now,
        ),
      )
      .filter(
        (summary) =>
          summary.recentCount > 0 &&
          pulseInBounds(summary.lat, summary.lng, bounds),
      );
  }
  post(input: PulseDraft, now: number) {
    this.seed(now);
    const draft = validatePulseDraft(input);
    const existing = this.reports.find(
      (row) => row.placeKey === draft.place.placeKey && row.expiresAt > now,
    );
    if (
      existing &&
      (existing.category !== draft.place.category ||
        Math.abs(existing.lat - draft.place.lat) > 0.00001 ||
        Math.abs(existing.lng - draft.place.lng) > 0.00001)
    )
      throw new Error("pulse_place_changed");
    this.posts = this.posts.filter((time) => time > now - 3600000);
    if (this.posts.length >= 6) throw new Error("pulse_rate_limited");
    this.posts.push(now);
    Object.entries(draft.answers).forEach(([kind, value], index) => {
      const typedKind = kind as PulseReport["kind"],
        ownerKey = draft.place.placeKey + ":" + kind;
      const oldId = this.own.get(ownerKey);
      this.reports = this.reports.filter((row) => row.id !== oldId);
      const id = `own-${now}-${++this.sequence}`;
      this.own.set(ownerKey, id);
      this.reports.push({
        id,
        placeKey: draft.place.placeKey,
        lat: draft.place.lat,
        lng: draft.place.lng,
        category: draft.place.category,
        kind: typedKind,
        value: value!,
        ...(index === 0 && draft.note ? { note: draft.note } : {}),
        createdAt: now,
        expiresAt: now + pulseTTL(typedKind, value!),
        confirmCount: 0,
      });
    });
  }
  confirm(placeKey: string, now: number) {
    this.seed(now);
    if ((this.confirmed.get(placeKey) ?? 0) > now)
      throw new Error("pulse_confirm_cooldown");
    if (
      !this.reports.some(
        (row) => row.placeKey === placeKey && row.expiresAt > now,
      )
    )
      throw new Error("pulse_no_active_updates");
    this.confirmed.set(placeKey, now + 600000);
    this.reports = this.reports.map((row) =>
      row.placeKey === placeKey ? confirmPulseReport(row, now) : row,
    );
  }
  reportNote(placeKey: string, note: string) {
    this.hiddenNotes.add(placeKey + ":" + note);
  }
}
