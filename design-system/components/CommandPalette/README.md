# CommandPalette

The command palette is the signature surface: a floating Liquid Glass panel with a search row, grouped results and an action bar.

- Markup: `<div class="cz-palette cz-glass" data-refract>`. Regular glass, `shadow-glass`, `radius-window` (26px), max width 650px.
- Rows are concentric with the panel: radius `radius-window` minus the `space-1` list inset (18px). The selected row is a lighter glass layer with a lit top edge.
- The search row and action bar are part of the same glass panel, separated by white-at-8% hairlines. No glass on glass.
- Section headers use the `label` style in `fg-300`. Rows are 44px: title in `fg`, source in `fg-300`, type or shortcut on the right.
- Action bar: the primary action with `↵`, other actions behind `⌘ K`.
- Row icons are 22px app icons with `radius-sm`. The colour swatches in the preview stand in for real icons.
- In marketing art, float it over a colourful backdrop (`.cz-stage` or the hero beams) so the glass has something to refract.
