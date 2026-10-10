import type { MapBounds } from "@/src/shared/exploration";
import type { PulseSummary } from "./types";
import { pulseBoundsKey, validPulseBounds } from "./bounds";
import { pulseCopy } from "./copy/pulse";
export type PulseFetcher = (
  bounds: MapBounds,
  zoom: number,
  signal: AbortSignal,
) => Promise<PulseSummary[]>;
export interface PulseQueryState {
  summaries: PulseSummary[];
  loading: boolean;
  error: string | null;
}
/** Per-viewer controller: cache, debounce and stale/aborted response isolation. */
export class PulseQueryController {
  private snapshot: PulseQueryState = {
    summaries: [],
    loading: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private cache = new Map<string, { at: number; summaries: PulseSummary[] }>();
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private revision = 0;
  private view: { bounds: MapBounds; zoom: number } | null = null;
  constructor(
    private fetcher: PulseFetcher,
    private clock = Date.now,
    private debounce = 350,
  ) {}
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  };
  getSnapshot = () => this.snapshot;
  replace(summaries: PulseSummary[]) {
    this.publish({ summaries, loading: false, error: null });
  }
  private publish(snapshot: PulseQueryState) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  setView(
    enabled: boolean,
    bounds: MapBounds | null,
    zoom: number,
    force = false,
  ) {
    this.cancel();
    if (!enabled || !validPulseBounds(bounds) || !Number.isFinite(zoom)) {
      this.view = null;
      this.publish({ summaries: [], loading: false, error: null });
      return;
    }
    this.view = { bounds: { ...bounds }, zoom };
    const key = pulseBoundsKey(bounds, zoom),
      cached = this.cache.get(key);
    if (!force && cached && this.clock() - cached.at < 60000) {
      this.publish({
        summaries: cached.summaries,
        loading: false,
        error: null,
      });
      return;
    }
    const revision = this.revision;
    this.publish({
      summaries: this.snapshot.summaries,
      loading: true,
      error: null,
    });
    this.timer = setTimeout(async () => {
      this.abort = new AbortController();
      try {
        const summaries = await this.fetcher(bounds, zoom, this.abort.signal);
        if (revision !== this.revision) return;
        this.cache.set(key, { at: this.clock(), summaries });
        if (this.cache.size > 24)
          this.cache.delete(this.cache.keys().next().value!);
        this.publish({ summaries, loading: false, error: null });
      } catch (error) {
        if (revision !== this.revision) return;
        this.publish({
          summaries: this.snapshot.summaries,
          loading: false,
          error: error instanceof Error ? error.message : pulseCopy.unavailable,
        });
      }
    }, this.debounce);
  }
  refresh() {
    this.cache.clear();
    if (this.view) this.setView(true, this.view.bounds, this.view.zoom, true);
  }
  clearCache() {
    this.cache.clear();
  }
  cancel() {
    this.revision++;
    if (this.timer) clearTimeout(this.timer);
    this.abort?.abort();
  }
  dispose() {
    this.cancel();
    this.view = null;
    this.cache.clear();
  }
}
