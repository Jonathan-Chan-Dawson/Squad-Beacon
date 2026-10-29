Profile feature

- screens/ProfileScreen.tsx: identity, profile survey, aspirations, Friends & Lists entry, Beacon Memories, library links, and Widget Studio entry point.
- settings/SettingsScreen.tsx: direct /settings route implementation; owns seven theme palettes and System/Light/Dark appearance, avatar visibility, temporary location links, push and quiet hours, Beacon audience defaults, account actions, and support links.
- ProfileAvatar.tsx, AvatarToggle.tsx, avatar.ts, avatarArt.ts: avatar display, selection, and presentation.
- ProfileSurvey.tsx and aspirations.ts: profile survey and optional aspiration helpers.
- Profile personalization opens voluntarily from the compact Profile identity accessory or existing editor. Closing does not save or change survey status; successful saves merge with the latest owner snapshot.
- privacy.ts and screens/ProfilePrivacySettings.tsx: viewer-specific full-profile privacy gates and profile visibility controls at /settings/privacy.

- settings/ThemePicker.tsx: compact full-color-role previews; Essential Dark/Light shortcuts share one warm-neutral family; Sunflower adds soft gold alongside the five original color-family IDs.

- sonarSelection.ts and components/ProfileSonarCard.tsx: individual-recipient review, expiry-preserving Save people, explicit extension, and the shared filtered people picker. app/location.tsx (including legacy Map links) opens this canonical control; device/session logic stays here.

- ProfileSonarCard stages Choose People then Review Sharing before the existing permission/start sequence. ProfileScreen consumes section=aspirations and positions the About content.
