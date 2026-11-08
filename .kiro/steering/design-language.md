# Design language
Mood: moonlit graveyard, readable first, spooky second.
Tokens (CSS variables): ink #0B0B14 (background), fog #1B1B2E (surfaces), bone #E8E2D0 (text),
ember #FF7A1A (accent/warnings), ghost #7FE3D0 (recurring charges), blood #C0392B (debt/overspend).
Verify text contrast meets WCAG AA; adjust tokens if not.
Data-to-visual rules: tombstone size = amount, ghost = recurring charge, fog density = budget used,
lit window = day under budget. Do not add decorations that carry no meaning.
Motion: subtle; respect prefers-reduced-motion. No audio by default.
Accessibility: every visual has a text equivalent; full keyboard use; Lights-On mode shows the same data plainly.
