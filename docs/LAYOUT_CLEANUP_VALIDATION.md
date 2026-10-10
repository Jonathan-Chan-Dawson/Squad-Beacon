# Layout cleanup — October 10, 2026

This pass addresses the additional spacing and menu-placement request. It does not claim completion of the wider Prompt 7 feature changes.

Shared sheets now use equal horizontal margins to stay centered at a maximum width of 640 points. The sheet library overrides absolute left/right positioning; flex centering also misplaced capped sheets. A single scroll container measures the title and body together, and an inner header row preserves native sticky-header alignment. Actions have bottom clearance and long button/chip labels can shrink within their padding.

Screen titles align with the existing 16-point content gutter, and non-tab scroll screens include the bottom safe area. Map search, picking and place-preview panels use consistent gutters and centered widths. Place previews scroll within the available Map height. Search and long-press menus use the measured Map bounds rather than the full window, and Locate/Options sit below the header.

Validation:

- Full typecheck and lint passed after the final shared-sheet corrections.
- All 263 unit/database tests passed. Database tests used disposable local databases; no migration was applied or deployed.
- Fresh web export passed with 39 routes.
- All 11 final browser tests passed: four new layout checks, three Live Updates flows, and four Profile/Settings flows. Checks cover 320×568, 390×844 and 1280×900 layouts, reduced motion, centered/capped menus, reachable Quiet hours Save, small-phone Map previews, edge menus, posting/confirmation/reporting without GPS, and palettes in Light/Dark.
- Six existing general UI browser checks also passed after updating stale Current/button selectors to the existing Now/tab interface and current feed content. The Live Updates badge assertion was scoped to the Map because the list row shares its accessible summary.

The authorized Android emulator was used to inspect Map controls and shared-sheet layout. A native sticky-header issue found during inspection was corrected and, after Reload, the Create menu's title/Close row and all three fully visible actions were confirmed visually and in the UI hierarchy. The emulator disconnected during the Quiet hours follow-up, so its native Save-button check remains pending. iOS/physical-device acceptance is unavailable; browser checks do not prove native keyboard behavior, haptics or performance.

The user's app.config.ts edits and Metro server on 8081 were preserved. This pass makes no data-model, backend, permissions or navigation changes. Carousel removal, weather, basemap authentication, quick-status redesign and the other wider Prompt 7 requests remain separate unfinished work.
