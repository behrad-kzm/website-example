# Keycap

Keycaps show a keyboard shortcut; they are small clear-glass chips beside the action they trigger.

- Each key is its own `<kbd class="cz-kbd">` inside `.cz-keys` (4px gap). Use the macOS glyphs ⌘ ⌥ ⌃ ⇧ ↵ and lowercase words like `esc`.
- 20px tall, `radius-sm`, white at 7% with a lit top edge, a dark bottom edge and a half-pixel rim. They carry no backdrop blur, because they sit on content or inside glass already.
- `--lg` (36px, `radius-md`) is for hero illustrations of a shortcut, never inline in text.
- Keycaps are labels, not buttons: no hover or press state.
