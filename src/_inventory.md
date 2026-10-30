src source guide

- shared/: cross-feature contracts and infrastructure: types, state/store, demo data, Supabase client, UI primitives, theme/preferences, domain helpers, catalogs, templates, and useNow.
- features/: user-facing feature implementations; see features/_inventory.md. Feature screens/components live with their feature rather than in a global screens/components bucket.
- platform/: platform service adapters for contacts, device identity, and notifications. Native/web sibling filenames are kept together for Expo resolution.

There are no feature implementation files at the src/ root. Add new product code to its owning feature, shared infrastructure to shared/, and platform adapters to platform/.

- theme/palettes.ts and theme/data.ts: seven paired light/dark families, Essential default, stable family names and legacy aliases, neutral surface depth, primary actions, complementary secondary highlights, strong control outlines, and independent category/availability colors.
