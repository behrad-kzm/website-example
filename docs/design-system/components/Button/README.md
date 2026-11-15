# Button

Buttons are Liquid Glass capsules that trigger an action. The prominent white capsule is the single loudest control on a screen.

Compose a button from `.cz-btn` plus a glass material:

| Role | Classes | Material |
| --- | --- | --- |
| Primary | `cz-btn cz-btn--primary cz-glass cz-glass--prominent cz-glass--interactive` | `glass-fill-prominent`, `button-fg` text, hover to solid `white` |
| Secondary | `cz-btn cz-glass cz-glass--interactive` | regular glass, `glass-fill` → `glass-fill-hover` |
| Tinted | add `cz-glass--tint` | `glass-fill-tint` (brand red at 25%). One per view at most |
| Over media | add `cz-glass--clear` | `glass-fill-clear`, `glass-blur-clear` |
| Tertiary | `cz-btn cz-btn--plain` | no glass; `button-hover-bg` on hover |

- Always a capsule (`radius-full`). 44px tall, the minimum touch target; 36px with `--sm`; square with `--icon`.
- Press response: scales to `glass-press-scale` (0.96) on a spring and settles closer to the page (`shadow-glass-pressed`).
- The highlight follows the pointer when `glass.js` is loaded.
- Inside another glass surface (the navbar), a glass button drops its own blur and lift and shares the container's.
- Focus shows `shadow-focus`. Disabled drops to 40% opacity.

The consumer provides the label and the click handler.
