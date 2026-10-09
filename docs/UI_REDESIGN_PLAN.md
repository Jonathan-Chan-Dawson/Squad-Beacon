# Mobile UI redesign

## Repository inspected

- Theme: `src/shared/themes.ts` (five light/dark palettes), `src/shared/preferences.tsx` (saved appearance, Midnight/Dark default), and themed styles in `src/shared/ui.tsx`.
- Shared UI: `src/shared/ui.tsx` (Screen, Sheet, Button, IconButton, Chips, Avatar, Empty, fields and actions), `src/shared/MotionPressable.tsx`, `src/features/profile/ProfileAvatar.tsx`, `src/features/people/MiniAvatar.tsx`, and `src/features/beacons/ActivityBadge.tsx`.
- Navigation: Expo Router in `app/_layout.tsx`; custom four-tab bar and center Create action in `app/(tabs)/_layout.tsx`. Preserve route names and behavior.
- Tab screens: `src/features/maps/screens/MapScreen.tsx`, `src/features/beacons/screens/ActivitiesScreen.tsx`, `src/features/people/screens/SquadsScreen.tsx`, `src/features/profile/screens/ProfileScreen.tsx`, re-exported by their existing tab routes.
- Validation: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:exploration`, and existing Playwright web-preview tests.

## Implementation

1. Establish `src/theme` as the semantic token source, deriving colors from existing persisted palettes. Include typography, spacing, radii, motion, shadows, availability and category identity, with readable light/dark variants.
2. Build shared primitives and use compatibility wrappers for existing consumers. Add safe-area-aware collapsing Screen, GlassBar, Chip, animated SegmentedControl, Card, buttons, Avatar/AvatarStack, CategoryBadge, ProgressBar, Gorhom Sheet, EmptyState, Skeleton, session-scoped DemoChip and Toast. Install only missing dependencies required by these primitives with Expo SDK 57 compatibility.
3. Refactor Beacons as the proof screen, with real state and existing accessibility labels. Centralize category appearance across existing badge consumers. Correct shared phone gutters and tab geometry (49 + inset, 58 Create raised 14) without altering navigation.
4. Preserve audience/access metadata explanations, location/Sonar controls and communication limitations. Do not touch models, queries, RLS, permissions, or test identifiers. UI copy must never imply that community links grant access.
5. Run typecheck, lint and existing tests; fix regressions. Export and exercise the web preview at 390×844, 375×667, 360×780 and 430×932. Record that browser sizing cannot verify native safe areas, gestures, haptics, Dynamic Type or physical device rendering.

## Acceptance

The complete shared component set exists, Beacons uses it as proof, new primitives read theme tokens, and checks pass. Existing production data and permission behavior remain unchanged. Native device acceptance is explicitly reported separately from preview checks.
