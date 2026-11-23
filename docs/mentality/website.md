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
- Each step of "What we do" (the description and each point) takes 1.6 windows of scrolling. The founder asked on 22 November 2026 for the amount to be reduced to 80% of what it was (2 windows).
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
- Before the animation starts there is a progress bar around the Star Track box, like the one in "What we do": it fills as the visitor scrolls and takes one window of scrolling (half of a "What we do" point when that was set; a point has taken 1.6 windows since 22 November 2026). The animation starts when the bar is full. (Asked for on 18 November 2026; before that, the animation started on the first few pixels of scroll.)
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

## Sections under Star Track look alike

Stated by the founder on 22 November 2026.

- The three boxes in "Why it is worth it" ("Don't hire an analyst team. Use ours.") did not match the UI of the sections above them, and the founder asked for them to be updated.
- The sections above ("How it works", "What you get") have no solid cards: their text sits open on Star Track's glass, and lists are separated by a thin rule above each item. "Why it is worth it" now uses that same ruled list, in one column beside its picture (it was three columns across until the picture was added the same day). (Reading the mismatch as "solid cards against open text" is the agent's interpretation; the founder did not name the difference.)

## "Why it is worth it": the saving picture

Asked for by the founder on 22 November 2026, with a screenshot of the report illustration from "How it works" as the style to follow.

- The section "Don't hire an analyst team. Use ours." needs art of its own, in that style, showing that clients save money by having our subscription.
- It must be new art, not the report illustration again. The agent first redrew step 4's page of the report as a review page; the founder rejected that, and step 4's page is back as it was.
- What is there now: on the same glowing floor, a tall pile of dark blocks ("An analyst team of your own": salaries, hiring, tools, data, time) next to one glowing blue block ("Star Track"), with the gap between their heights marked "You save this". It sits to the right of the headline and the three points. (The blocks, their five labels and the wording are the agent's design; not yet confirmed by the founder.)
- It shows no amounts, because the price of Star Track is not set yet.

## "Delivery": the arriving reports picture

Asked for by the founder on 22 November 2026: "do the same art" for "Reports that keep arriving." as was made for "Why it is worth it".

- What is there now: on the same glowing floor, reports sit along a dashed track at even steps. The first is tagged "First report"; the two after it are tagged "What changed" and each has one line marked in blue; the newest glows; a dashed outline tagged "Next" stands at the end of the track. (The agent's design; not yet confirmed by the founder.)
- It has a repeating animation, asked for by the founder the same day: each step in turn lifts up a little and its text shows bolder, then the next step, round and round.
- On hover, asked for by the founder the same day: the block under the mouse comes out and gets bigger, its text gets bigger so it is readable, and the repeating animation stops until the mouse leaves the picture. (The other steps standing back while one is pointed at is the agent's addition, so the bigger tag does not collide with its neighbours.)
- It shows no dates or intervals, because the schedule is not decided and the copy must not promise a fixed rhythm.
- The section took the same layout as "Why it is worth it": headline and the three numbered steps as a ruled list on the left, the picture on the right. Its solid cards are gone.

## Who trusts us

- The founder named the websites that trust us on 22 November 2026: Sendbypass (https://sendbypass.com/) and ApplyMerkez (https://applymerkez.com/fa). They are shown under "Who trusts us" in the Trust section, each logo linking to its site.
- The logos were taken from those two sites and are drawn in white so they sit together on the dark page. (Drawing them in one colour is the agent's choice; the founder has not confirmed it.)
- The founder asked for it to be centred the same day: the two group titles and the logos sit in the middle. The eyebrow "Trust" and the headline "Trusted and listed." must not be centred; they stay on the left like the other section headlines. (The agent first centred the headline too, and the founder corrected it.)
- The listings group (heading "As seen on", renamed from "Where we are listed" on 2026-11-22 to read more established; each listing already says "Featured on", so the heading avoids repeating it) has its first real listing (2026-11-22): DeepLaunch.io. The founder gave the directory's badge snippet and asked for the image to be made consistent with our UI while keeping the link. So a listing badge is redrawn in one colour (white, same as the trust logos) and the link to the directory stays exactly as given. Future listings follow the same rule.

## Book a call

- The team's booking page is https://calendly.com/colonaiz-sales/30min (given by the founder on 22 November 2026). Every "Book a call" button and link on the website goes there, opening in a new tab.

## Pricing cards must be easy to read

- The founder saw the first pricing cards on 22 November 2026 and said they were too dark and clients could not read the text well.
- The plan cards are now lighter than the page's other dark surfaces, with brighter borders, larger text and nearly white text. Text that clients must read to decide (prices, what a plan includes) must not be set in dim grey on a near-black card.

## The 12-month plan card

- Asked for by the founder on 22 November 2026: the background of the $999 card must be similar to the hexagonal view that has a liquid glass on top.
- The card has its own field of lit hexagons. The founder then set the layers (same day): the liquid glass must sit on top of a darker layer with opacity 0.4, and must fill the whole container. The founder then asked for the dark layer to be darker, 0.6. So, from the bottom: hexagons, a black layer at 60%, the liquid glass, the text; every layer fills the card edge to edge. (The agent's first version had the glass stop short of the edge with a rim of hexagons around it; the founder did not want that.) The single-report card stays plain, so the 12-month plan is the one that stands out.

## Typography

Stated by the founder on 16 November 2026.

- Headline type must feel like space technology: modern, flat, minimal, easy to read, and standard.
- Two typefaces at most, never two in one sentence; the founder does not like multiple fonts (an italic serif accent phrase and a separate display face were both tried and rejected the same day). Primary, for headlines: Inter. Secondary, for other text: Inter Tight, the face defi.com uses, chosen by the founder as the reference on 16 November 2026.
- On 18 November 2026 the founder chose Druk Condensed Super for titles and headlines, replacing Inter there. It is a licensed font from Commercial Type and its files have not been supplied yet, so headlines still show in Inter; sizes and letter spacing will need retuning once it is in, because it is far narrower than Inter.
- Reference for headlines: ethereum.org, which sets them in Inter at its heaviest weight with tight line spacing. The site follows that.
- Headlines use a radial gradient: white at the centre, slightly silver toward the edges.

## Legal pages

Asked for by the founder on 22 November 2026.

- Two pages: one for the privacy policy (privacy.html) and one for the Star Track Terms and Conditions (terms.html). Both are linked from the footer.
- How the agent built them (not yet confirmed by the founder): plain reading pages on the site's dark surface, with a short version at the top, a list of sections at the side, and the commitments we make set apart in green. They are written in plain formal English, not in the FAQ's voice.
- There is no "Log in" link in the navbar: the founder had it removed on 22 November 2026 because there is nothing to log in to yet.

## Small screens (2026-11-22)

The founder reported that the page was wrong in the browser's responsive mode (the navbar and the text cut at the right edge) and that it sometimes froze, and asked for it to be tested hard at six sizes. What was found, and the rules that came out of it:

- The page must never be wider than the window. Decoration that is wider than its text (the soft shadows behind the hero copy, a star's number in "What we do") is cut at the edge of its section. A page that is wider makes a phone zoom out, and everything is then cut at the right.
- "What we do" pins on every screen where its text fits one window, phones included. It used to fall back to the plain list on phones and tablets by mistake (the fit was measured wrongly), and which layout a visitor got could change from one load to the next.
- The magnetic sections are for the mouse and the trackpad only. On a touch screen a short swipe was pulled back to where it started, which reads as the page refusing to scroll. (This one was the agent's decision, not the founder's: say so if the founder wants the magnet back on phones.)
- The hero planet keeps one size while a phone's address bar slides in and out, pauses while the rest of the page covers it, and is not stopped for good by one long pause.
- The six sizes are tested in tests/responsive.spec.js: 320x568, 360x740, 390x844, 430x932, 768x1024, 1024x768.

## Analytics

Asked for by the founder on 22 November 2026.

- The website uses Google Analytics (through Google Tag Manager), and we want the maximum benefit from it: track everything we can track.
- What is tracked, and how to set it up, is listed in docs/analytics/README.md.
