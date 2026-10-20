# Theme refinement

The existing family names remain **Midnight, Ocean, Mint, Sunset, and Berry**. Essential adds one neutral family; its Dark/Light previews select an appearance within that family.

## Preferences

- New or invalid preferences initialize Essential Dark. A valid explicitly saved appearance is retained.
- Existing family IDs remain unchanged. Legacy stored Midnight without an appearance remains dark; other legacy families remain light. Saved Light, Dark, and System preferences are preserved.
- Selecting a color family retains appearance. Essential preview shortcuts select their displayed appearance. System follows live device changes.

## Colors and compatibility

- All twelve variants use the supplied background, surface, primary, and text foundations. Essential also preserves the exact neutral raised, border, supporting-text, and button foreground colors.
- Secondary text, outlines, containers, and raised surfaces are derived consistently for colorful families. Semantic roles include background, surface, surfaceRaised, surfaceSelected, textPrimary, textSecondary, primary, onPrimary, primaryContainer, outline, success, warning, and danger.
- Existing color names and exports remain compatible. Shared controls and overlays receive the refined palettes through the current theme engine.
- Category foregrounds and availability meanings stay independent of family. Map/profile availability badges and Beacon admission badges use those roles. Owned stars, rose relationship hearts, avatars, QR contrast, and map providers retain their intentional colors.
- Appearance has compact two-column previews of the background, surface, text, and primary CTA, with separate System/Light/Dark controls. Other screens retain their layouts and dimensions.

## Validation

- 74 focused unit checks passed. Validation covers defaults, every saved family/appearance, exact Essential colors, legacy aliases, button and surface contrast, and independent category/status colors.
- 27 focused browser checks passed. Coverage checks all families in both appearances across Map, Beacons, Create, Squads, Friends, Profile, and Appearance, with 320/375/430px widths. It also verifies preview persistence and live System appearance.

- Type checking and changed-source lint passed. Web and Android/Hermes exports succeeded. Native device runtime validation was not performed.
