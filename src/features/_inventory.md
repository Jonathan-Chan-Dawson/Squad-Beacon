Feature map

- auth/: Auth.tsx — authentication and account entry UI.
- beacons/: activity browsing, compact homepage and feed cards, response/tools, timing, checklist/note module helpers, controls, and permissions.
- help/: help and tutorial screen.
- onboarding/: account-scoped first-entry presentation, copy, local vignettes, contextual tips and development-only demo scenarios; see onboarding/_inventory.md.
- library/: LibraryScreen and shared library grouping/folder helpers.
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

- activity/: unified personal Your Activity workspace; see activity/_inventory.md.
- sharing/: common share sheet/host response management, protected share and member-claim screens, public native invitation receiver, verified transport and Beacon share helper. Used by Beacons, planning decisions, selected Plans and own Status Notes behind backend capabilities and configured origin. Focused guest web rendering lives under server/guest/.
