# Status card redesign — Part 2

The Beacons homepage uses the compact avatar/note layout, a single optional featured activity row, separate Change navigation, and a shared availability/Sonar footer. Profile and friend-facing presentations keep their existing hierarchy.

The existing editor now provides Note / Activity / Both segments and a separate shared-content preview. Reopening its note, picker, or settings retains the same source's unfinished draft. Saving and clearing release that draft only after success; expired/replaced sources cannot redirect a save into another Status. Attachment selection and editor navigation do not publish.

Hide Note, Pause Status Sharing, and Current Beacon sharing remain independent. Activity mode retains editable text without revealing it when an attachment becomes unavailable or is removed. Existing activity authorization and canonical destinations remain in use. No API, schema, storage, routes, or publication contract changed.

## Verification

- Type checking and lint for all three changed source components pass.
- Full-project lint has one existing unused-variable warning in `ActivityDetailScreen.tsx` (`hasToolHistory`).
- The 30 focused Status, attachment, privacy, Current Beacon, reaction, and atomic/database regression tests pass.
- The 10 focused browser scenarios pass, covering entry points, explicit saving, draft retention and failures, keyboard segment selection, all four attachment types, independent privacy, scheduling, unavailable attachments, friend reactions/responses, Message navigation, Profile compatibility, and featured/Current Beacon merging. The friend scenario was rerun after adding its Message assertion; no message is sent.
- Two additional browser scenarios pass for first-use availability confirmation/preference continuity/clearing and explicit Sonar recipient confirmation.
- Web production export and Android Hermes bundle export pass.
- Homepage and editor screenshots cover 320, 375, 430, and 1024px. Browser assertions check horizontal overflow and 44px homepage action targets. Additional screenshots cover larger text, paused sharing, and unavailable attachments.

Browser artifacts are generated under `.expo/status-card-pt2/`. The tests wait for sheet transitions before visual capture and privacy interaction. Native bundle validation is complete; physical-device runtime, native screen reader, keyboard/IME, and location/Sonar delivery checks remain separate manual checks. Nothing was deployed.
