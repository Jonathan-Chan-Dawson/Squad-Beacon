Cross-feature shared code

- types.ts, store.tsx, demo.ts, supabase.ts: shared data contracts, app state/actions, demo fixture/actions, and backend client.
- domain.ts, browsing.ts: common validation, visibility, and feed derivation helpers.
- ui.tsx, MotionPressable.tsx, themes.ts, preferences.tsx, useNow.ts: design primitives, reduced-motion-aware press feedback, paired light/dark palettes, device/light/dark appearance preferences, persisted display settings, and clock hook.
- templates.ts, interestCatalog.ts: searchable built-in activity recipes and interest catalog.
- search.ts: accent-insensitive all-word matching over explicitly supplied visible fields.
- exploration.tsx: account-scoped Map/Upcoming search, audience/category/time plus optional date/join/place filters, selected-area state, and coordinate/bounds helpers; never requests GPS automatically.

Feature-specific business rules belong under src/features/; keep only true cross-feature contracts here.

- Theme compatibility retains existing family IDs and legacy color aliases. Essential Dark initializes new preferences; saved families and explicit appearances are retained, including legacy implicit light/dark choices.

- mobilePresentation.ts, SystemBars.tsx: shared native page/sheet presentation and focus-scoped immersive status-bar requests; status icon style follows the active appearance.

- AppNavigation.tsx / AppNavigation.native.tsx and SystemBars.tsx / SystemBars.native.tsx: preserve web presentation while native opts into themed push/modal transitions and focused system-bar requests.

- SocialChoiceRow.tsx: shared accessible selection/browse rows and category rail for people, creation audiences and community association.
