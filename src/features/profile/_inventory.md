Profile feature

- screens/ProfileScreen.tsx: identity, profile survey, aspirations, Friends & Lists entry, Beacon Memories, library links, and Widget Studio entry point.
- settings/SettingsScreen.tsx: direct /settings route implementation; owns six theme palettes and System/Light/Dark appearance, avatar visibility, temporary location links, push and quiet hours, Beacon audience defaults, account actions, and support links.
- ProfileAvatar.tsx, AvatarToggle.tsx, avatar.ts, avatarArt.ts: avatar display, selection, and presentation.
- ProfileSurvey.tsx and aspirations.ts: profile survey and optional aspiration helpers.
- privacy.ts and screens/ProfilePrivacySettings.tsx: viewer-specific full-profile privacy gates and profile visibility controls at /settings/privacy.

- settings/ThemePicker.tsx: compact full-color-role previews; Essential Dark/Light convenience choices share one family, while the five original family names remain unchanged.

- sonarSelection.ts and components/ProfileSonarCard.tsx: individual-recipient review, expiry-preserving Save people, explicit extension, and the shared filtered people picker. app/location.tsx (including legacy Map links) opens this canonical control; device/session logic stays here.
