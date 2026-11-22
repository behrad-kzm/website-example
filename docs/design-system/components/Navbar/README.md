# Navbar

The navbar is one floating Liquid Glass capsule; the brand, links and the download button all live inside it.

- Markup: `<nav class="cz-nav cz-glass" data-refract>`, links inside `<div class="cz-nav__links" data-cz-lens>`.
- 60px tall, `radius-full`, max width `container`, pinned `space-2` from the top of the viewport. Regular glass with `shadow-glass`.
- With `glass.js` loaded:
  - `data-refract` bends the page behind the capsule's edges (Chromium; other browsers keep the blur and saturation).
  - `data-cz-lens` adds a glass lens that slides and stretches on a spring to the hovered or focused link, and rests on the `aria-current="page"` link.
- Links: 44px capsules, 14/500 `fg-200`, `fg` on hover. The download button is a prominent glass capsule; inside the nav it shares the nav's glass rather than stacking a second blur.
- Corners are concentric: a 60px capsule with 8px inset holds 44px capsules.
- The mark is `assets/Logos/mark.svg` at 40 x 21px, left of the wordmark.
