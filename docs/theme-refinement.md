# Theme refinement

Seven stable families provide paired light/dark palettes: Essential, Midnight, Ocean, Mint, Sunset, Berry and Sunflower.

## Color direction

- Essential is warm neutral with restrained gold accents. Sunflower uses cream/butter surfaces and stronger sunflower gold. Sunset retains its distinct coral/terracotta hue.
- Every family separates page, card, raised and selected surfaces. Soft selected chips use readable accent text; primary actions use the solid accent with the corresponding foreground. Structural labels remain neutral.
- Primary button icons inherit the button foreground. Destructive dialog actions retain their danger styling. Category and availability meanings, map-provider imagery, avatars and relationship indicators remain independent of the selected family.

## Compatibility

Theme IDs, legacy aliases and palette exports stay compatible. Essential/Dark remains the default. Explicit Light/Dark/System preferences and original implicit legacy appearances survive. Selecting a family retains appearance; Essential shortcuts select their displayed appearance. System follows live device changes.

Settings previews include a small descriptor for each family and Sunflower is discoverable through settings search. No backend change or preference migration is required.

## Validation

Theme tests cover all fourteen variants, primary/supporting text, selected and raised surfaces, button foregrounds, semantic category/availability roles, stable IDs, saved preferences and System appearance. Browser checks capture the main screens and centered choices across phone widths in both appearances. Screenshots are generated under .expo/sunflower-themes/.

Validation for this pass: typecheck and full lint passed; 38 focused theme/map-presentation tests and 24 browser checks passed. Web export succeeded. All seven families were captured on the main screens in both appearances across 320/390/430px widths, with additional Essential/Sunflower/Sunset comparisons at 390px and Sunflower at 430px.

No Android device was connected. Native-device appearance, accessibility scaling and system bars require device verification; browser/export results do not establish native acceptance.
