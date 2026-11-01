# Beacon and Map UI hotfixes - 2026-10-31

## Completed checkpoints

1. **Community and Plan context:** compact contextual background, reduced internal padding, clickable 44px rows and readable Joined status. Removed redundant checkmarks, chevrons and the extra divider. Existing membership and Plan handlers remain in use.
2. **Tools:** removed the floating notification badge. Grid icon, Tools label and actual authorized module count sit inline. The control is slightly wider with extra space before the count; height, radius, theme colors and existing menu remain consistent.
3. **Social actions:** compact Map cards omit direct Chat and host-message/Memories fallbacks. React and Comments remain left-aligned with empty-state labels, counts and the existing picker. Details' existing Chat view is now exposed as an authorized Chat tab; narrow tab bars retain readable labels by omitting decorative icons when necessary. Native selection retains its existing Chat route.
4. **Primary action:** preserved one canonical prominent RSVP/Open/Manage action and removed the redundant arrow from hosted discovery cards.
5. **Motion:** Map and Browse Filters and other explicitly centered sheets use a 180ms fade, with a 120ms dismissal fade. Centered dialogs use the same timing. Reduced motion switches immediately. Ordinary bottom sheets keep their existing spring behavior and gesture settings. Filter options, Reset/Show, footer, dismissal and focus restoration remain intact.
6. **Scrollbars:** unnecessary Map preview and Browse list indicators are hidden. Long centered sheets, dialogs and anchored menus use thin theme-colored web scrollbars; their scrolling, focus and content bounds remain intact.

## Verification

- Typecheck, lint, production web export and 57 focused unit tests passed.
- 34 unique browser cases passed across focused runs: 23 Beacon/card cases, four actual-rendered Filters motion cases and seven centered-dialog cases. The motion checks verify a fade without a large visible slide, including reduced motion, Reset/Show and Escape.
- Card evidence covers 320/375/390/430px phones and 1024px desktop in light/dark: no Map Chat shortcut, inline Tools/count, reaction add/remove and overflow, public restrictions, saved state, module navigation and Chat through Details with Map return/camera retention.
- Final isolated export: `.expo/beacon-map-hotfix-spacing`. The closing narrow-card confirmation uses this export.
- Native/simulator/physical-device gestures, system text scaling and hosted-account acceptance remain unverified. No backend, dependency, migration, replacement card system or clustering implementation was introduced. Concurrent Map/native changes were preserved.

## Representative screenshots

- [Map card, 320px light](screenshots/beacon-map-hotfix-2026-10-31/light-320-map.png)
- [Map card, 320px dark](screenshots/beacon-map-hotfix-2026-10-31/dark-320-map.png)
- [Filters, dark with motion](screenshots/beacon-map-hotfix-2026-10-31/filters-320-dark-motion.png)
- [Filters, reduced motion](screenshots/beacon-map-hotfix-2026-10-31/filters-430-light-reduced.png)
