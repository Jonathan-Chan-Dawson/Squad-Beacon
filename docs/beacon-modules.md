# Beacon modules

The module cleanup brief is implemented by extending the existing Beacon tools,
not by creating parallel checklist, journal, chat, or timer systems.

## Product boundaries

- Overview, People, RSVP, Save, directions, contextual comments, and small
  reactions are normal Beacon features. Comments and reactions are not tabs.
- Chat starts on. Other tools start off for new Beacons unless a template enables
  them. Existing Beacon settings and authorized history are preserved.
- Templates configure useful tools; advanced Social, Tools, and Media options
  remain optional. Disabled tools do not leave empty detail tabs/cards.
- One checklist can have sections and assignees. Participant editing is the
  default; managers may restrict it. Assignment never grants Beacon access.
- Beacon Note uses the existing note model. New personal entries are private;
  existing shared entries keep their visibility. Sharing is explicit.
- Profile Lists and Journals are private collections. Folder placement is only
  organization, never an access grant. Saved checklist copies must not be silently
  overwritten by subsequent edits to the shared source.
- Timer uses the existing deadline-based engine for Standard and Pomodoro modes.
- Music is an external song/playlist link, not an in-app music player.
- Teams / Scoreboard is one tool. Managers configure teams and adjust scores;
  approved participants may manage their own membership. No tournaments.
- Beacon Memories are activity-linked media, not a standalone engagement feed.
- Vote / Draw stays in the planning flow, outside confirmed Beacon modules.
- There is no Status Poll implementation to remove. No Games UI is introduced.

## Existing constraints

Plans, Favorites, My Templates, and other utility shortcuts remain on Past only.
Current and Upcoming stay focused on people and actionable Beacons. Profile
privacy defaults to the existing authenticated public visibility; custom full
profile access is managed in Settings. Organization audience selection remains
unavailable until real organization membership exists.

Local migrations and automated checks do not deploy schema to the remote project
or replace native-device testing.

## Media boundary

Media uses private Storage objects and short-lived signed URLs. Photos are
re-encoded before sharing; original videos may retain location metadata and the
composer warns about that. A failed save must retain its upload ID for retry,
not delete an upload whose database save may already have committed.

Object cleanup must use the [Storage API](https://supabase.com/docs/guides/storage/schema/design),
not SQL deletion of Storage metadata. Removing metadata alone does not remove
the underlying file. Creator deletion and cleanup failures need a retry path.
Current failed Storage deletion cleanup can be retried only while Beacon Memories
remains mounted; there is not yet a durable cleanup queue across app restarts.
