# Prompt 5 validation

Implementation is complete; final native verification is in progress. The scope and current backend constraints are recorded in [PROFILE_SETTINGS_REDESIGN_PLAN.md](PROFILE_SETTINGS_REDESIGN_PLAN.md). Implementation and review use Sol 6.1 with high reasoning.

## Integrated evidence

- Typecheck passed. Focused lint passed for Profile, editor, Settings, defaults, store and shared Sheet changes.
- All 243 unit/database tests passed, including five profile-editor merge/owner cases and four audience-default eligibility cases. Ten palette/appearance combinations passed semantic contrast checks.
- The web export built 39 routes, including the full-screen profile editor (entry-64de013e93dc693c791050ebc2d37f1a.js).
- At 390-point width, browser checks passed identity/avatar sizing, profile-only visibility changes, explicit recipient selection and Sonar confirmation, the demo's refusal to share location, reachable Save, dirty-dismiss confirmation, discarded drafts and persisted edits.
- Settings search passed direct privacy/location discovery. The palette test found a missing web pressed-state attribute; selectable buttons were corrected to expose aria-pressed. Its rerun remains pending the final export.
- The rebuilt Android APK includes expo-image and installed successfully. Development-client startup stalled before the interface loaded and displayed an ANR. Native layout, keyboard, time-picker and Sonar start/stop acceptance is pending; build installation is not evidence of those behaviors.

The additive unblock migration was exercised only in an isolated local test database. It remains unapplied to the connected backend.

## Checks to complete

October 10 follow-up: full typecheck/lint, all 263 unit/database tests and the 39-route web export passed. All four Profile/Settings browser tests passed, including the previously pending Light/Dark palette rerun. The shared sheet layout was corrected and Quiet hours Save passed viewport checks at 320, 390 and 1280 pixels. See [LAYOUT_CLEANUP_VALIDATION.md](LAYOUT_CLEANUP_VALIDATION.md) for layout scope and device limits. The historical evidence above is retained; these results supersede its pending browser palette verification.

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
