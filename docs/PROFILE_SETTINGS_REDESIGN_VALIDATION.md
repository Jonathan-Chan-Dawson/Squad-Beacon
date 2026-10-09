# Prompt 5 validation

Implementation and final verification are in progress. The scope and current backend constraints are recorded in [PROFILE_SETTINGS_REDESIGN_PLAN.md](PROFILE_SETTINGS_REDESIGN_PLAN.md). Remaining implementation and review use Sol 6.1 with high reasoning.

## Checks to complete

- At 390-point width, Profile uses 16-point gutters/body text, a 96-point avatar, readable identity information, and separate 44-point actions.
- Edit profile opens full-screen; its safe-area Save stays reachable, and dismissing dirty edits requires confirmation. Saving preserves unrelated current profile fields.
- Visibility controls persist the canonical profile-only grants and do not modify Beacon visibility or location recipients.
- Opening Sonar does not request location, create a session, or select recipients automatically. Starting requires current accepted friends, a valid duration, and an explicit action; stopping clears device updates and the server session.
- Private memories use current access checks and expiring signed URLs. iOS widgets are unavailable on Android/Expo Go.
- Settings search surfaces appearance/privacy/location controls directly. All five palettes work in Light and Dark and honor reduced motion.
- Native notification permission and device registration states are distinct and truthful; time pickers honor the server's current whole-hour quiet-hour precision.
- List/Squad/Organization defaults are viewer-scoped device preferences and are rejected when their targets become ineligible.

## Native limits

The authorized Pixel 8a API 35 emulator is available for native layout, sheet, keyboard, and time-picker checks. This Windows workspace cannot run an iOS simulator. Physical haptics, push delivery, sustained release frame rate, thermal behavior, GPS accuracy, and manufacturer-specific permissions require physical-device testing.

Earlier Prompt 4 native checks continue; an intermittent persistent Map sheet disappearance remains under investigation. Profile and Settings acceptance will not be inferred solely from browser previews.
