# Website

What the website is for. Stated by the founder on 15 November 2026.

## Goal

- The goal of the website is to lead clients to buy our products and to gain their trust.
- We must look legitimate and professional.

## Motion

Stated by the founder on 16 November 2026, for the "What we do" section.

- Animation must feel smooth and impressive, but it must never distract from reading. The visitor should understand each point with no effort.
- Prefer one point on screen at a time over several boxes side by side: the headline stays in place and the points change as the visitor scrolls.
- The section opens with only the description; the points follow one at a time.
- The visitor controls the pace: the points follow the scroll position, and a progress bar shows how much scrolling is left before the text changes and before the section ends. An earlier rule (one scroll gesture always jumps to the next point) was dropped by the founder on 16 November 2026 in favour of the progress bar.
- The visual language is space: stars should look natural, alive, and flaming, the way NASA shows them.

## Hero satellite

Asked for by the founder on 18 November 2026.

- A small satellite, built entirely in code, orbits above the ring of digits and stays exactly above the ring's moving glow, as if it is scanning that data.
- Now and then it fires a beam down at the ring, to make the scanning obvious.
- It is small: about a quarter of the ring's width.
- The beam must look harsh, like a laser scanner: flat triangular sheets of light with hard bright edges and a bright line where they meet the surface, not a soft glowing cone. The founder's reference was a film still of a spherical drone scanning the ground this way.
- The first version (a box with two solar wings and a dish) was rejected by the founder as boring. The look to aim for is a sci-fi station: the reference given was the Sketchfab model "Sci-Fi Spaceship Helios (from Syd Mead)" by markkingsnorth, a silver sphere with windows cut through its shell onto lit decks, a large lens at one end and antenna hoops and masts at the other. That model is not downloadable or licensed, so the craft is our own design in that spirit, not a copy.
- The spherical station built from that reference was still rejected as boring (18 November 2026). The founder wants the craft to be "super cool, fascinating and extraordinary, like alien tech": it should look like something not made by people. The current craft is two floating black crystals with an energy ball between them and gyroscope rings that lock flat when it scans.
- The alien craft was rejected too ("not what I wanted", 18 November 2026). The reference the founder then chose is Romain Ferre's ArtStation render of a white spherical pod: a hard-surface, NASA-white sphere built of layered armour plates with panel gaps, an amber window, twin engine blocks at the back, thruster pods on struts at the sides, vents and small markings. The founder wants "so many details and FHD graphics": dense, crisp, realistic detail, not a stylised glowing shape. The current pod is our own design in that style, with our own markings.
- The pod's colour is a slightly grey white, not bright white, and it carries a shadow: the light on it comes from the ring below, so its underside is the lit side and its top is in shade. The founder also asked for it to be smaller than the first detailed version.
- The glow in the ring under the craft belongs to the scan: it lights only while the craft is scanning, and is dark the rest of the time.
- It must load as fast as possible: generated in code, with no model or texture files to download.
- It should orbit slowly (the first speed was too fast).

## Layout rule: insets

Stated by the founder on 18 November 2026, as a rule for every page of the website, following Apple's Human Interface Guidelines on layout.

- Inside any box (a card, a pane, a panel), the content starts as far from the top edge as it is from the leading edge. Text is never pushed down to the bottom of a box with a larger gap above it.
- Boxes that sit side by side align their content to the same lines.
- Use the design system's spacing steps for these insets, the same value on every box of the same kind, not one-off numbers.
- The rule is checked by a test (tests/layout.spec.js), so a new box that breaks it fails the test run.
- A box whose content is deliberately centred (a logo placeholder, a button) is outside the rule.

## Where the planet shows

Stated by the founder on 18 November 2026.

- The giant planet in the background belongs to the top of the page only: the hero and "What we do". From the Products section all the way down it must not be seen; it comes back only when the visitor scrolls up above Products.

## Star Track takes over the page

Described by the founder on 18 November 2026. (On 15 November he had noted that Star Track should take focus and the other products fade, with the animation to be discussed later; this is that animation.)

- Scrolling down from the Products section, the section sticks in the window.
- The Star Track box grows until it fills the whole section.
- At the same time the name "Star Track" turns into a headline, moves up, and stays at the top as the title for the rest of the website, down to the bottom of the page.
- The blurred glass and the hexagon background stay for the rest of the website too: every section after Products sits on Star Track's glass.
- At the same time the other product, Flight Check, moves to the right and fades out.
- Before the animation starts there is a progress bar around the Star Track box, like the one in "What we do": it fills as the visitor scrolls and takes half as much scrolling as one point of "What we do" (one window). The animation starts when the bar is full. (Asked for on 18 November 2026; before that, the animation started on the first few pixels of scroll.)
- The animation always runs to its end and follows the direction of the scroll: scrolling down opens Star Track fully to the whole screen, scrolling up collapses it fully back to the normal state. It must never stop halfway. (The first version moved with the scroll position and could be left half open; the founder corrected that the same day.)
- While it opens, the section below scrolls up by itself until it sits under the Star Track title, so the visitor is not left looking at an empty pane.
- The scrolling through it must be smooth. The founder reported it was not (18 November 2026); a recording of the scroll position frame by frame showed the page being pushed about 100px past its landing point by leftover trackpad momentum and then creeping back for two to three seconds. The rule now, checked by tests/scroll-smoothness.spec.js: while the page scrolls itself it does not step backwards, and once it lands it stays exactly there.
- Scrolling the other way while it is playing must also be smooth: the animation turns around from wherever it is, without a jolt, and runs to that end instead. The founder asked for this to be tested aggressively, to make it "the smoothest animation ever". tests/scroll-smoothness.spec.js does that: it turns the animation around at 15%, 50% and 90% open in both directions, four times in a row, with slow scrolls, on landing, and from the keyboard, and fails on any jump in speed.
- The founder's sketch shows the title at the top left, under the navigation bar, in a tall condensed face (the Druk Condensed Super he chose for headlines).

## Products section

Asked for by the founder on 18 November 2026.

- The two plain product boxes were "too boring".
- The whole Products section has the planet's own surface as its background: a field of six-sided panels with violet light in the gaps. (A first version put the texture inside each box; the founder corrected that: it belongs to the whole section.)
- The field reacts to the mouse the way the planet does: the panels under the pointer light up and lift a little toward the viewer, and a click sends a wave across them.
- The two products are rounded rectangles of glass over that field, like the liquid glass of macOS. Their text starts at the top of the pane and lines up across the two (see the inset rule). Each pane has a little violet glow behind it.
- Behind the section's title and the small label above it there is a dark shadow, so both read clearly over the lit panels. (The founder first asked for it to be barely noticeable, then on the same day asked for a clearly dark one.)
- The glass must be dark enough that the text on it reads easily; the founder asked for it 2.5 times darker than the first glass version. He then asked for it darker again. And again: it should be like sunglasses that block UV light, dark and smoked, with a stronger frosted blur. That went slightly too far: the founder wants to still see a little of what is behind the glass, with the blur kept. Later he asked for slightly less blur, about a fifth less. Then about a third less again.
- Product names on the cards are bold and in capital letters.

## Typography

Stated by the founder on 16 November 2026.

- Headline type must feel like space technology: modern, flat, minimal, easy to read, and standard.
- Two typefaces at most, never two in one sentence; the founder does not like multiple fonts (an italic serif accent phrase and a separate display face were both tried and rejected the same day). Primary, for headlines: Inter. Secondary, for other text: Inter Tight, the face defi.com uses, chosen by the founder as the reference on 16 November 2026.
- On 18 November 2026 the founder chose Druk Condensed Super for titles and headlines, replacing Inter there. It is a licensed font from Commercial Type and its files have not been supplied yet, so headlines still show in Inter; sizes and letter spacing will need retuning once it is in, because it is far narrower than Inter.
- Reference for headlines: ethereum.org, which sets them in Inter at its heaviest weight with tight line spacing. The site follows that.
- Headlines use a radial gradient: white at the centre, slightly silver toward the edges.
