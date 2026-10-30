# Input

Text fields are Liquid Glass capsules, like the search fields in Apple's own apps.

- Markup: `<input class="cz-input cz-glass">` inside `.cz-field` with a label and an optional hint.
- 44px tall, `radius-full`, regular glass (`glass-fill`, `glass-blur`) with `shadow-glass`.
- Placeholder in `fg-300`. The label and hint are inset by `space-2` so they line up with the text inside the capsule.
- Focus adds `shadow-focus` around the glass.
- Error: a 1.5px `red` ring, and the hint turns `red` and says how to fix the value.
- Inside a glass panel (the command palette) a field is a plain row, not another glass capsule.
