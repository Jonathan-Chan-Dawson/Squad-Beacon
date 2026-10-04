Feature map

- auth/: Auth.tsx — authentication and account entry UI.
- beacons/: activity feed, cards, response/tools, timing, checklist/note module helpers, controls, permissions, and the Activities screen. PeriodTabs is local to this feature.
- help/: help and tutorial screen.
- library/: LibraryScreen, helpers, and Past-only LibraryToolkit.
- maps/: map screen, panel/tooltip, and BeaconMap platform variants. BeaconMap.tsx, BeaconMap.native.tsx, and BeaconMap.web.tsx are a single sibling set.
- messages/: shared chat thread component used by activity and person routes.
- people/: squads/friends directory, directory controls, invite QR, mini avatars, and its screen.
- planning/: planning domain/types plus Pings & Decisions list, detail, and actionable inbox.
- plans/: plan schedule domain and plan list/detail screens.
- discovery/: sanitized public beacon card contract and discovery filtering/ranking helpers. Never substitute full Activity rows for the public projection.
- organizations/: separate organization/member model and role affordance helpers; not an alias for Squads.
- profile/: profile screen, profile/avatar editors, survey, aspirations, and avatar assets/helpers.
- widgets/: widget studio, widget runtime, shared widget types/preferences, data derivation, sync, and native integrations.

Keep Expo route entry files in app/ thin. Feature code should be imported directly from its canonical feature path; avoid duplicate forwarding modules.
