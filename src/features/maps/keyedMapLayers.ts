type LayerTarget<T> = { removeLayer: (layer: T) => unknown };

/** Keeps Leaflet objects, DOM and handlers alive while their visual revision is unchanged. */
export class KeyedMapLayers<T> {
  private entries = new Map<
    string,
    { revision: string; value: T; action?: () => void }
  >();
  private seen = new Set<string>();
  private target?: LayerTarget<T>;
  readonly stats = { created: 0, reused: 0, removed: 0 };

  begin(target: LayerTarget<T>) {
    this.target = target;
    this.seen.clear();
  }
  use(key: string, revision: string, create: () => T, action?: () => void): T {
    this.seen.add(key);
    const old = this.entries.get(key);
    if (old?.revision === revision) {
      old.action = action;
      this.stats.reused++;
      return old.value;
    }
    if (old) {
      this.target?.removeLayer(old.value);
      this.stats.removed++;
    }
    const value = create();
    this.entries.set(key, { revision, value, action });
    this.stats.created++;
    return value;
  }
  activate(key: string) {
    this.entries.get(key)?.action?.();
  }
  end() {
    for (const [key, entry] of this.entries)
      if (!this.seen.has(key)) {
        this.target?.removeLayer(entry.value);
        this.entries.delete(key);
        this.stats.removed++;
      }
  }
  clear() {
    this.seen.clear();
    this.end();
    this.target = undefined;
  }
}
