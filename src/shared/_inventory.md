Cross-feature shared code

- types.ts, store.tsx, demo.ts, supabase.ts: shared data contracts, app state/actions, demo fixture/actions, and backend client.
- domain.ts, browsing.ts: common validation, visibility, and feed derivation helpers.
- ui.tsx, MotionPressable.tsx, themes.ts, preferences.tsx, useNow.ts: design primitives, reduced-motion-aware press feedback, palettes, persisted preferences, and clock hook.
- templates.ts, interestCatalog.ts: searchable built-in activity recipes and interest catalog.

Feature-specific business rules belong under src/features/; keep only true cross-feature contracts here.
