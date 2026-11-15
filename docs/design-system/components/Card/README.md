# Card

Cards hold one feature or one piece of content. They belong to the content layer, so they are never Liquid Glass.

- Background: `linear-gradient(137deg, grey-700 4.87%, grey-800 75.88%)` with `shadow-highlight` and a 1px `border` ring.
- Corners are concentric: the card uses `radius-3xl` (24px) with `space-3` (24px) padding, and the 44px icon tile inside uses `radius-lg` (12px) so its corner reads as part of the same curve family. Keep that pairing when changing either.
- `--glow` adds `shadow-card-glow`, a faint periwinkle halo. One featured card per grid.
- Title uses `title` (20/500, `fg`); body uses 15/24 in `fg-300`.
- Glass controls may float over a card (a play button on media); the card itself stays opaque.
