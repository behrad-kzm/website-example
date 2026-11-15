# colonAIz

A dark, keyboard-first interface language for the colonAIz website. Every value here was extracted from the production CSS of [raycast.com](https://www.raycast.com/) on 30 October 2026: colours, spacing, radii, type sizes, shadows and blur radii are exact. Line heights and letter-spacing are the most common pairings found for each size. The control layer follows Apple's [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) material. The mark is the hexagon planet: `assets/Logos/logo.svg` (detailed, 512px, with a soft glow) and `assets/Logos/favicon.svg` (simplified for 16–64px: larger cells, wider gaps). Set it beside the wordmark in `sans` 600.

## Principles

1. **Near-black, not black.** The page is `grey-900` (#07080a). Surfaces step up through `bg-100` → `bg-400` and `grey-800` → `grey-500`, never by adding colour.
2. **Two layers: content and glass.** Content (cards, text, media) sits on the page and is opaque. Navigation and controls (navbar, buttons, fields, the command palette) float above it in Liquid Glass. Glass never goes on content, and glass never stacks on glass.
3. **Light comes from the top edge.** Opaque surfaces get a 1px white-at-10% inner top line (`shadow-highlight`). Glass gets a specular rim, bright at the top left (`glass-specular`) and faint at the bottom right (`glass-rim`).
4. **One loud element.** The prominent glass button (`glass-fill-prominent`) or the red brand mark (`brand-red`) leads each screen. Everything else is grey type on grey surfaces.
5. **The keyboard is the hero.** Show shortcuts as `Keycap`s next to the actions they trigger. The `CommandPalette` is the signature visual.
6. **Colour means something.** `green`, `yellow`, `blue`, `red` and `purple` mark state or feature (installed, Pro, beta, error, AI). They appear as text on their 15% `-subtle` fill, never as large backgrounds.

## Content fundamentals

- **Voice:** short, confident, second person. Headlines are a single sentence ending in a full stop: "Your shortcut to everything." "Take the short way." "Don't repeat yourself."
- **Sentence case** everywhere except product feature names, which are title case ("Clipboard History", "Window Management", "AI Commands").
- **Name the feature, then the benefit.** Card copy runs one sentence: "Snap windows to halves, thirds and corners with a shortcut."
- **Buttons are verbs with an object:** "Download for Mac", "Install Extension", "Copy command".
- **Eyebrows and list headers** use the `label` style (12/500, +0.3px tracking) in `fg-300`.
- Emphasis inside a headline may switch one phrase to `serif-accent` (Instrument Serif italic). Use it once per page at most.

## Visual foundations

### Colour

| Role | Token | Notes |
| --- | --- | --- |
| Page | `bg` / `grey-900` | #07080a |
| Card | `grey-700` → `grey-800` at 137° | the standard card gradient |
| Raised | `bg-200`, `grey-600` | inputs, menus |
| Hairline | `border` | #242728, 1px |
| Text | `fg`, `fg-200`, `fg-300` | 18.6:1, 11.8:1, 4.6:1 on `bg` |
| Disabled text | `fg-400`, `grey-300` | below 4.5:1: decorative or disabled only |
| Primary action | `button-bg` + `button-fg` | hover `white` |
| Brand | `brand-red` #ff6363 | logo, hero glows |

Marketing backdrops use two gradients from the source: the wallpaper `linear-gradient(135deg, #422629, #111217)` behind window mocks, and radial `brand-red` glows at about 20% alpha behind the hero.

### Type

Inter is the only UI face, with stylistic sets `ss02` and `ss08` on and ligatures off. Weight 500 is the default for UI text (it appears four times as often as 400 in the source); headings use 600. JetBrains Mono sets code; Geist Mono sets large numerals; Instrument Serif italic is the rare accent. Small text carries +0.1 to +0.3px tracking.

The scale: 72 / 64 / 48 / 36 / 32 / 24 / 20 / 18 / 16 / 15 / 14 / 13 / 12 / 11. `body-sm` (14/500) is the workhorse.

### Space and layout

An 8px base with half steps (`space-0-5` 4px, `space-1-5` 12px, `space-2-5` 20px), running up to `space-13` (224px). Sections breathe: `space-12` (168px) padding-block on desktop, `space-10` on tablet, `space-8` on mobile. Content sits in `container` (1204px); prose in `container-xs` (746px). Grid gaps are `space-4` (32px), tightening to `space-3` (24px).

### Shape

Controls are capsules (`radius-full`): buttons, fields, badges, the navbar. Panels use generous rounded corners: `radius-window` (26px) for floating glass panels, `radius-3xl` (24px) for cards.

Corners are **concentric**: an element nested inside another takes the outer radius minus the inset between them. A 26px panel with an 8px inset holds 18px rows; a 60px capsule with an 8px inset holds 44px capsules. Write it as `calc(var(--radius-window) - var(--space-1))` instead of picking a new radius.

Smaller fixed radii remain for small content pieces: `radius-sm` (6px) keycaps and app icons, `radius-md` (8px), `radius-lg` (12px) icon tiles, `radius-xl` (16px) stages.

### Liquid Glass

Apply the material with `.cz-glass` and load `components/glass.js` at the end of the page.

| Layer | What does it | Tokens |
| --- | --- | --- |
| Backdrop | blur, saturation and brightness of whatever is behind | `glass-blur`, `glass-saturate`, `glass-brightness` |
| Refraction | the backdrop bends along the rounded edge (`data-refract`, Chromium only) | `glass-refraction`, `glass-bezel` |
| Fill | a thin white tint | `glass-fill`, `-hover`, `-clear`, `-tint`, `-prominent` |
| Sheen | a soft top light, plus a highlight that follows the pointer | `glass-sheen` |
| Rim | a 1px specular edge, bright top left, faint bottom right | `glass-specular`, `glass-rim` |
| Lift | shadow under the floating surface | `shadow-glass`, `shadow-glass-pressed` |

**Variants:** regular (default) for most controls; `--clear` over photos and video, with `glass-dim` behind any text on it; `--prominent` for the primary action; `--tint` for one emphasised control.

**Behaviour:** interactive glass (`--interactive`) brightens on hover and, when pressed, shrinks to `glass-press-scale` on a spring and settles closer to the page. The nav lens slides and stretches between links instead of jumping.

**Accessibility:** with *Reduce Transparency* on, glass becomes opaque `glass-solid` with no blur. With *Increase Contrast* on, it becomes opaque with a `fg-200` outline (`shadow-glass-contrast`). With *Reduce Motion* on, press and lens movement stop. Text on glass must keep 4.5:1 over the busiest backdrop it can float over. Check it over the hero beams, not over plain black.

### Opaque depth

Floating windows that are not glass use `shadow-window`. Featured cards use `shadow-card-glow`. Older blur tokens (`blur-sm` to `blur-xl`) remain for tooltips and overlays on media.

### Motion

Glass moves like a liquid: presses and the nav lens use a spring that overshoots slightly (`cubic-bezier(.34, 1.56, .64, 1)`, about .45s). Colour and fill changes stay quick and linear (`.2s`–`.3s`). Hover changes colour, fill or the pointer highlight, never size. Respect `prefers-reduced-motion`.

## Iconography

Icons are 20px line or filled glyphs in `fg-200`, turning `fg` on hover. App and extension icons are full-colour squares with `radius-xs` corners at 20px. Feature-card icons sit in a 44px `bg-200` tile with `radius-lg` and a top highlight. No emoji in UI.

## Components

`Button`, `Keycap`, `Badge`, `Card`, `Input`, `Navbar`, `CommandPalette`. Each is plain CSS in `components/bundle.css` with a `cz-` class prefix. Load `tokens.css`, then `components/bundle.css`, then `components/glass.js` at the end of `<body>`, and use the markup shown in each preview. Glass components need a backdrop with colour or texture to show the material; `.cz-stage` provides one for previews.
