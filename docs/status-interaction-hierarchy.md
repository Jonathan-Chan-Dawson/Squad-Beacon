# Status action hierarchy

The note and person should draw attention first. Controls appear in the context where they are needed, with one main action per task.

## Compact Status

- On the Beacons homepage, place the avatar left of the editable note, with audience and expiration beneath. Keep the existing Profile note-bubble presentation.
- Show one optional featured activity row with a separate Change action. With no attachment, use a compact + Attach activity action. Availability and Sonar share the bottom row; scheduling and settings stay at the top.
- Keep friend rows to one Status target and a separate planning-selection target. Responses and reactions belong in the expanded viewer.

## Composer

- Initial view: written note, optional attachment, one Save action.
- Reuse the existing sheet with phone bottom-sheet sizing and a centered presentation from 768px. Keep Save Status in its existing footer.
- Show Note / Activity / Both segments only when an attachment or an existing non-Note configuration makes them relevant. These labels retain the existing presentation values.
- Keep retained text editable in Activity mode and exclude it from the shared-content preview. Unavailable or removed attachments never reveal it implicitly.
- Reopening the note, picker, or settings resumes the same source's draft. Save failures retain it; an expired or replaced Status cannot redirect its save into a different source.
- Put audience, duration, availability, privacy switches, and advanced fields behind one summary/settings row.
- Use a quiet Change link and a small Remove icon for attachments.
- While choosing an activity, show only the search, filters, eligible results, and Back action. Selection returns to the draft; it never publishes.

## Expanded viewer

- Compact identity and availability come first, then the written note bubble and one featured activity with canonical response controls.
- Activity Only and genuinely blank notes have no empty speech bubble.
- React and Message share one quiet icon-led row below the featured activity. React shows the selected emoji and opens the existing picker on explicit tap. At most one independently enabled Current Beacon row follows.
- Merge matching visible featured/current Beacon IDs. Current-only content gets modest extra emphasis, never a feed card.
- Do not add timelines, Also happening lists, or new browsing destinations. Browsing stays in the existing Profile Beacons tab.
- Keep the existing reaction action small and separate.
- Put secondary planning and contextual shortcuts under More.
- Show secondary response choices only where the canonical activity controller requires them. Keep organizer management in the full activity experience.

## Independent privacy and continuity

- Hide Note hides the text and its featured attachment. It does not disable Current Beacon sharing.
- Pause Status Sharing hides everything from other people while retaining the owner's configuration.
- Blank notes are valid; never insert persistence or display placeholders.
- First-time configurations and independently created schedules default Current Beacon sharing off. Explicit-source renewals, edits, and quick availability changes retain preferences, including paused sharing.
- Choose the Current Beacon for the owner before checking viewer access; never substitute a different Beacon for an unauthorized viewer.

## Lists and Profile

- A planning row opens its full destination; one separate Respond/Vote shortcut opens a small response picker.
- Align Profile actions across the available width, with consistent spacing and wrapping.
- Collapse long bios and interests behind explicit expansion controls.

## Visual rules

- Reserve filled mint for the main action or an established selected state.
- Use quiet text, icons, and restrained surfaces for secondary actions.
- Keep touch targets at least 44px, even when the visible icon is small.
- Avoid duplicate note text, duplicate navigation buttons, glowing borders, and continuous decorative motion.
- Keep softly shaded note bubbles with downward tails on Profile, in the editor, and in the shared viewer. The homepage uses plain note text beside the avatar. Use category-tinted artwork and quiet featured labels; keep decoration away from response targets.
- Organize featured cards with type and deadline/state in one header, artwork beside the title and time, then canonical controls. Ping responses use equal-width rounded rectangles with defined borders, inline icons, and a mint selected state.
