# Card context, social controls and chat headers — 2026-10-31

## Changes

- Map and Browse linked-context backgrounds explicitly fill the available card width, have a 44px minimum height, retain internal padding, and grow with wrapped content. Empty Browse enrichment no longer creates a blank panel. Plan navigation and community membership actions are unchanged.
- React and Comments use the same labeled, left-aligned presentation on Map, Beacons and Your Activity, with a small gap between controls. The updated request supersedes the earlier Your Activity default that omitted its social row. Chat remains a separate coordination action; existing permissions still determine visibility.
- Private Lists now shares the Chats tab row instead of occupying a separate toolbar row. Community creation stays in the same utility position. A quiet Conversations heading and New chat text/icon action sit below the chat divider and reuse the existing creation menu.
- Friends’ Private Lists control also sits beside its horizontally scrolling category tabs. An active private-list filter can still be cleared from the existing filter row, without an extra toolbar row.

## Validation

- Typecheck, lint, web export and 26 focused unit tests passed.
- All 47 unique focused browser cases passed across the closing runs: 23 card/Map, 14 messaging, two linked-context and eight navigation/filter cases.
- Browser coverage includes 320–430px phones, 1024/1440px desktop, light/dark, card/background bounds, spacing, header alignment, list and creation menus, search/filter retention, private-list editing, chat drafts/history, reaction overflow, modules, public privacy and Map returns/camera retention.
- Two existing messaging assertions were brought up to date: Private Lists uses “Filter people” labels, and participant Ping links resolve to Responses. Product destinations were preserved.
- Verification used isolated local production exports (`.expo/card-context-social-preview` and `.expo/card-context-social-final`). Hosted accounts and native/device acceptance remain unverified.

## Screenshots

- [Chats, dark 320px](screenshots/card-context-social-2026-10-31/dark-320-chats.png)
- [Friends, light 320px](screenshots/card-context-social-2026-10-31/light-320-friends.png)
- [Your Activity card, light 320px](screenshots/card-context-social-2026-10-31/light-320-activity.png)
- [Map context and social row, light 320px](screenshots/card-context-social-2026-10-31/light-320-map.png)

No backend changes, dependencies, new routes or replacement card/navigation systems were added.
