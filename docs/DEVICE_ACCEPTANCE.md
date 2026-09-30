# Connected pilot acceptance

Run these with two real accounts on two physical phones after applying migrations and configuring providers.

- Verify email on the same device and a second device; test password recovery, expired links, sign-out and session restoration.
- Onboard a 16–17-year-old test account and an adult account. Reject an under-16 birth date on the server. Never expose birth dates in profile responses.
- Invite by username and QR, accept friendship, create a private list and a shared squad. Verify that membership alone does not share private beacons or live location.
- Create a Squad activity with a pin; another person marks Interested, requests Going, receives approval, comments and receives a generic push.
- Before approval, attempt the meeting-details REST endpoint directly. It must return no row.
- Complete the activity, save a memory, and reuse a personal template. Verify templates and favorites are visible only to their owner.
- Share location with an explicitly selected friend for 15 minutes. Verify the background indicator/service notification. Deny permission, kill the app, turn off GPS, and test battery restrictions. A point older than five minutes must disappear.
- Stop sharing; query the REST endpoint from the other account. Block a user and remove a squad member while the other device is open; subsequent server reads must fail immediately and cached UI must clear on refresh.
- Upload a profile photo. Confirm only authorized users can download its bytes and that no public/signed URL is emitted.
- Test denied/disabled push permission, quiet hours, changed activity time, cancelled activity, Expo invalid token receipts and transient delivery failures.
- Delete an account with avatar, templates, messages, activities and owned squads. Verify Storage cleanup, Auth deletion and data cascades. Verify that retained safety reports are moderator-only and expire on schedule.
- Review VoiceOver/TalkBack labels, larger text, keyboard handling, map panels, Now feed, empty states and low-bandwidth behavior.
- Confirm cron schedules, Resend delivery, map-key restrictions, spend alerts, backup configuration, support contact and an assigned moderation operator.
- Complete current Apple/Google disclosures and applicable closed-testing requirements. Premium and public discovery remain out of this pilot.

- Verify free availability expires and is never inferred from an empty calendar. Favorite friends and squads without changing sharing audiences.
- Chat is unreadable before joining, while approval is pending, and after withdrawing. Confirm accepted-friend messaging stops after blocking or removing friendship.
- Scroll the main screens and confirm Inbox stays visible; verify map pins open inline and Chat expands without leaving the map.
