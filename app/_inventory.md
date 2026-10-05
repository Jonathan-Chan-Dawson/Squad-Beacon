Expo Router map

- space/[id].tsx: independent Space overview, people and privacy-preserving Squad links.

- _layout.tsx, +html.tsx, +not-found.tsx: root app shell, web HTML wrapper, and fallback route.
- (tabs)/: persistent Map, Beacons, Squads, and Profile tabs; screen implementations live in src/features.
- activity/[id].tsx, create.tsx: beacon detail and creation workflows.
- councils.tsx and council/[id].tsx: Pings & Councils routes backed by src/features/planning.
- squad-chat/[id].tsx and squad/[id].tsx: Squad conversation with a tappable info header, canonical inline Ping deep-focus, a composer action sheet, and the full Overview/Members/Activity/Settings profile.
- plans.tsx and plan/[id].tsx: plan list/detail routes backed by src/features/plans.
- library.tsx: shared library route backed by src/features/library.
- settings.tsx: actual account settings route, including profile visibility controls.
- auth/callback.tsx, find-friends.tsx, invite.tsx, location.tsx, messages/[id].tsx, person/[id].tsx: account, people, location, and messaging routes.
- help.tsx, legal.tsx, moderation.tsx, widgets.tsx: help, policy, moderation, and widget routes.
- modal.tsx: modal route.

Keep route paths stable; move reusable screens and feature logic into src/features rather than growing route files.
