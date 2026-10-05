Cross-feature shared code

- types.ts, store.tsx, demo.ts, supabase.ts: shared data contracts, app state/actions, demo fixture/actions, and backend client.
- domain.ts, browsing.ts: common validation, visibility, and feed derivation helpers.
- ui.tsx, MotionPressable.tsx, themes.ts, preferences.tsx, useNow.ts: design primitives, reduced-motion-aware press feedback, paired light/dark palettes, device/light/dark appearance preferences, persisted display settings, and clock hook.
- templates.ts, interestCatalog.ts: searchable built-in activity recipes and interest catalog.
- search.ts: accent-insensitive all-word matching over explicitly supplied visible fields.
- exploration.tsx: account-scoped Map/Upcoming search, audience/category/time plus optional date/join/place filters, selected-area state, and coordinate/bounds helpers; never requests GPS automatically.

Feature-specific business rules belong under src/features/; keep only true cross-feature contracts here.
