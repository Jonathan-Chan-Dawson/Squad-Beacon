Your Activity workspace

- YourActivityWorkspace.tsx: shared personal Beacons/Plans/Calendar header, lazy retained panels and account/epoch reset. Beacons Home remains separate.
- ActivityFrame.tsx: embedded scrolling content frame with explicit saved-Plan reveal for existing Plan/Calendar implementations; standalone fallback retains Screen.
- useDraftProtection.tsx: local unsaved-edit Back/reload protection using shared confirmation dialogs.

Route compatibility and Phase 4C handoff: docs/YOUR_ACTIVITY_UX_VALIDATION.md.

- ActivityActionBar.tsx: standard app-sized icon/label buttons that wrap naturally; no global button changes.
