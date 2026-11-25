import { performance } from "node:perf_hooks";
import type { ClusterPoint } from "../src/features/maps/cluster";
import {
  MapPresentationCache,
  nativeMapMode,
} from "../src/features/maps/nativeMapPresentation";

const center = { latitude: 41.885, longitude: -87.642 };

function fixture(count: number, spread: number): ClusterPoint[] {
  return Array.from({ length: count + Math.ceil(count / 5) }, (_, index) => {
    const kind = index < count ? "beacon" : "person";
    return {
      id: `${kind}:${index}`,
      kind,
      latitude: center.latitude + (index % 100) * spread,
      longitude: center.longitude + (Math.floor(index / 100) % 100) * spread,
      ...(kind === "beacon" ? { category: "Social" } : {}),
    };
  });
}

for (const count of [100, 500, 2_000, 10_000]) {
  for (const distribution of ["dense", "wide"] as const) {
    const points = fixture(count, distribution === "dense" ? 0.00002 : 0.025);
    const cache = new MapPresentationCache();
    const priorities = { "beacon:0": { tier: -3 } };
    const owned = new Set<string>();
    const samples: number[] = [];
    let peakFeatures = 0;
    for (let step = 0; step < 36; step++) {
      const zoom = [8, 11, 14, 17][step % 4];
      const viewport = {
        centerLatitude: center.latitude + step * 0.0001,
        centerLongitude: center.longitude + step * 0.0001,
        zoom,
        width: 390,
        height: 740,
      };
      const start = performance.now();
      const result = cache.select(
        points,
        viewport,
        nativeMapMode(zoom),
        priorities,
        owned,
      );
      const elapsed = performance.now() - start;
      if (step >= 4) samples.push(elapsed);
      peakFeatures = Math.max(
        peakFeatures,
        result.reduce((total, item) => total + item.featureCost, 0),
      );
    }
    samples.sort((left, right) => left - right);
    console.log(
      JSON.stringify({
        count,
        distribution,
        p95Ms: Number(samples[Math.ceil(samples.length * 0.95) - 1].toFixed(1)),
        peakFeatures,
      }),
    );
  }
}
