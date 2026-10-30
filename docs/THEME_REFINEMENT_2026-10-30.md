# Theme and Beacons refinement — 2026-10-30

The Beacons profile/status row is unboxed. Its 76px avatar balances the name, availability and editable note beside it; Current Activity has its own surface. The divider above Your Activity / My Activity remains. Compact Sonar retains a full touch target and an accessible name. The availability control is simplified on compact rows so the profile name fits at 320px.

## Color direction

Each theme uses quiet page/card surfaces, a clearer raised layer, a primary action color and a complementary highlight. Essential now has warm neutral light surfaces and slate dark surfaces, with blue actions and a warm secondary highlight. This gives the default themes color without washing every surface in one hue.

| Family | Primary action | Complementary highlight |
| --- | --- | --- |
| Essential | Blue | Warm clay / apricot |
| Midnight | Indigo | Sea glass |
| Ocean | Coastal blue | Copper |
| Mint | Forest / sage | Plum |
| Sunset | Coral | Teal |
| Berry | Plum | Honey |
| Sunflower | Gold | Blue |

Primary and secondary colors carry different roles. Status Notes use the secondary container, selected controls use the primary container, and ordinary cards retain neutral surfaces. Inputs have stronger outlines and a themed focus state. The theme chooser previews the actual surface, selected and complementary colors. Category and availability meanings remain independent of the chosen family.

This applies the separation of surfaces, primary and secondary roles described in [Material color roles](https://m3.material.io/styles/color/the-color-system). Foreground choices are checked against [WCAG text contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum); control outlines are checked against [WCAG non-text contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast). The app retains its existing components and typography.

## Compatibility and validation

Family IDs, saved appearances, System appearance, legacy color aliases and native/web component paths remain compatible. No dependency, database or authorization changes were made. Concurrent Friends-page work was preserved.

The unit contrast suite checks body/supporting text, primary/secondary combinations, category/availability colors, selected/raised surfaces and input outlines across all 14 palettes. The browser suite checks settings, Map, Beacons, Create, Squads, Friends, Profile, representative dialogs, appearance persistence and focused inputs. The Beacons checks cover 320/390/430/1024px, both appearances, larger text, editing, availability, Sonar and activity selection.

Passed: `npm run typecheck`, `npm run lint`, **27 affected unit tests**, **25 browser checks**, and a web export to `.expo/theme-finish-preview`. The browser checks cover all seven families in both appearances, input focus/blur, saved choices and live System appearance. There were no browser page errors in the theme matrix.

Evidence logs: `.expo/theme-finish-checks.json`, `.expo/theme-finish-unit.log`, `.expo/theme-finish-browser.log` and `.expo/theme-finish-build.log`. Reproduce the browser coverage with `themeRefinement.spec.ts` and `identityStatus.spec.ts`; the unit selection is `themes`, `themeTokens`, `livingActivity`, `statusAttachments` and `sonarSelection`.

These are local web/demo checks; native OS rendering, physical-device accessibility and hosted service acceptance remain separate.

## Screenshots

| Family | Light | Dark |
| --- | --- | --- |
| Essential | [Light](screenshots/themes-2026-10-30/after/Essential-light-beacons-320.png) | [Dark](screenshots/themes-2026-10-30/after/Essential-dark-beacons-320.png) |
| Midnight | [Light](screenshots/themes-2026-10-30/after/Midnight-light-beacons-390.png) | [Dark](screenshots/themes-2026-10-30/after/Midnight-dark-beacons-390.png) |
| Ocean | [Light](screenshots/themes-2026-10-30/after/Ocean-light-beacons-430.png) | [Dark](screenshots/themes-2026-10-30/after/Ocean-dark-beacons-430.png) |
| Mint | [Light](screenshots/themes-2026-10-30/after/Mint-light-beacons-320.png) | [Dark](screenshots/themes-2026-10-30/after/Mint-dark-beacons-320.png) |
| Sunset | [Light](screenshots/themes-2026-10-30/after/Sunset-light-beacons-390.png) | [Dark](screenshots/themes-2026-10-30/after/Sunset-dark-beacons-390.png) |
| Berry | [Light](screenshots/themes-2026-10-30/after/Berry-light-beacons-430.png) | [Dark](screenshots/themes-2026-10-30/after/Berry-dark-beacons-430.png) |
| Sunflower | [Light](screenshots/themes-2026-10-30/after/Sunflower-light-beacons-320.png) | [Dark](screenshots/themes-2026-10-30/after/Sunflower-dark-beacons-320.png) |

Essential comparison at 390px: [old light](screenshots/themes-2026-10-30/before/compare-Essential-light-390.png) / [new light](screenshots/themes-2026-10-30/after/compare-Essential-light-390.png), [old dark](screenshots/themes-2026-10-30/before/compare-Essential-dark-390.png) / [new dark](screenshots/themes-2026-10-30/after/compare-Essential-dark-390.png). Before images come from the preserved pre-palette export.

The [theme chooser](screenshots/themes-2026-10-30/after/Essential-dark-settings-320.png) shows the surface and complementary colors. The [finished Beacons layout with an active Activity Note](screenshots/themes-2026-10-30/after/beacons-current-note.png) shows the separate profile row, balanced avatar, activity card and retained divider.
