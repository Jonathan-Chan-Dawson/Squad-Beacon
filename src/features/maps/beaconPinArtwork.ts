import type { Category } from "@/src/shared/types";

export const beaconPinSymbols = {
  fitness: "M3 13h4l3-7 4 12 3-5h4",
  study: "M12 6c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v13",
  gaming:
    "M7 7h10c2 0 3 2 4 5l1 4c.5 3-2 4-4 2l-3-3H9l-3 3c-2 2-4.5 1-4-2l1-4c1-3 2-5 4-5Zm0 3v4m-2-2h4m7-1h.1m2 2h.1",
  creative:
    "m4 16-1 5 5-1L20 8l-4-4L4 16Zm9-9 4 4M15 5l2-2a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2",
  social:
    "M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-5l-4 4v-4a4 4 0 0 1-3-4v-3Zm4 2h.1m4 0h.1m4 0h.1",
  other: "m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z",
  music:
    "M9 18V5l11-2v13M9 18c0 1.7-1.6 3-3.5 3S2 20 2 18.5 3.6 16 5.5 16 9 16.5 9 18Zm11-2c0 1.7-1.6 3-3.5 3S13 18 13 16.5s1.6-2.5 3.5-2.5 3.5.5 3.5 2Z",
  outdoors: "m2 19 7-12 4 6 3-5 6 11H2Zm5-9 2 2 2-2",
  food: "M4 3v6a3 3 0 0 0 6 0V3M7 3v18m13 0V3c-3 1-5 5-5 9h5",
  trophy:
    "M7 4h10v6a5 5 0 0 1-10 0V4Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 3v5m-4 0h8",
} as const;

export type BeaconPinSymbol = keyof typeof beaconPinSymbols;
export const maxBeaconPinImageLength = 16_000;
const jpegPrefix = "data:image/jpeg;base64,";

export function beaconPinSymbol(value: unknown): BeaconPinSymbol | null {
  return typeof value === "string" && Object.hasOwn(beaconPinSymbols, value)
    ? (value as BeaconPinSymbol)
    : null;
}

export function beaconPinImage(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= maxBeaconPinImageLength &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : null;
}

export function beaconPinPath(category: Category, value?: string | null) {
  return beaconPinSymbols[
    beaconPinSymbol(value) ?? (category.toLowerCase() as BeaconPinSymbol)
  ];
}

export function makeBeaconPinImage(base64: string) {
  return beaconPinImage(jpegPrefix + base64);
}
