// Star Track takes over the page. Products is a little taller than the window and its content is pinned
// while the visitor scrolls through the extra height. For the first part of that scroll (one window's
// worth: half of what one point of "What we do" takes) a progress bar runs around the Star Track card,
// showing how much scrolling is left before anything happens. When the bar is full, the takeover starts.
// The takeover is an animation that always plays to an end, in the direction the visitor is scrolling:
//   - scrolling down past the full bar opens Star Track: its pane grows from the card until it fills the
//     window, the name "Star Track" travels to the top of the window and grows into a title, Flight Check
//     moves off to the right and fades, and the rest of Products fades;
//   - scrolling up anywhere inside Products closes it again, back to the two cards.
// It never rests halfway. When the visitor starts it with the
// wheel or the keyboard, the page also scrolls itself while it plays: opening brings the next section up
// to sit under the title, closing brings Products back to the top of the window. Scrolling the other way
// while it plays turns it around from wherever it is.
// Both motions (the animation and the page's own scroll) are springs, not fixed-length tweens: a spring
// keeps its speed when its target changes, so taking over from the visitor's flick, and turning around
// mid-way, happen without a jolt.
// Below Products the pane and the title stay in the window to the end of the page, so every later section
// sits on Star Track's glass, under its name. The layout and the look are in index.html (.world, .st-*);
// this file creates the two layers, decides when to open and close, and places things as the motion runs.
import { holdMagnet } from './magnet.js';

const world = document.querySelector('[data-star-world]');
const products = world && world.querySelector('#products');
const card = products && products.querySelector('[data-product="star-track"]');
const sticky = typeof CSS !== 'undefined' && CSS.supports('position', 'sticky') && CSS.supports('overflow', 'clip');

if (card && sticky) {
  const name = card.querySelector('h3');
  const other = products.querySelector('[data-product="flight-check"]');
  const head = products.querySelector('.block__head');
  const inner = products.querySelector('.block__inner');
  const rest = [...card.children].filter((el) => el !== name);   // the card's description and link

  // Two layers that stay in the window: the pane under the page's content, the title over it
  const make = (className, parent, text) => {
    const el = document.createElement('div');
    el.className = className;
    el.setAttribute('aria-hidden', 'true');  // decoration: the card's own heading is what assistive tech reads
    if (text) el.textContent = text;
    parent.append(el);
    return el;
  };
  const layers = document.createDocumentFragment();
  const stage = make('st-stage', layers);
  const glass = make('st-glass cz-glass', stage);
  // The progress bar: an outline around the pane that is drawn on as the visitor scrolls. Two rectangles,
  // the faint track and the bar; the bar's length is set as a fraction of the outline (pathLength = 1).
  const SVG = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(SVG, 'svg');
  ring.setAttribute('class', 'st-ring');
  const outline = (className) => {
    const rect = document.createElementNS(SVG, 'rect');
    rect.setAttribute('class', className);
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('pathLength', '1');
    ring.append(rect);
    return rect;
  };
  const track = outline('st-ring__track'), bar = outline('st-ring__bar');
  glass.append(ring);
  const top = make('st-top', layers);
  const band = make('st-band', top);
  const title = make('st-title', top, name.textContent);
  world.insertBefore(layers, products);
  world.classList.add('is-live');

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const mix = (a, b, k) => a + (b - a) * k;
  const px = (v) => `${v.toFixed(2)}px`;
  const SMOOTH = 0.26;    // the springs' time constant, in seconds: a full opening or closing settles in about 0.9s
  // How far the visitor scrolls into Products before it opens, in pixels: the length of the progress bar.
  // The number of windows is set in index.html (--st-dwell on .world), which also sizes Products to fit.
  const dwell = () => (parseFloat(getComputedStyle(world).getPropertyValue('--st-dwell')) || 1) * innerHeight;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let open = false;                    // where the animation is heading
  const progress = { p: 0, v: 0 };     // where it is (0 closed, 1 open) and how fast it is moving, per second
  let carry = null;                    // while the page scrolls itself: { p: position, v: pixels per second, to: target }
  let lastY = scrollY, lastScroll = 0, speed = 0;   // the visitor's scroll: last position, when, and pixels per second
  let lastTime = 0, running = false;
  let lastInput = -Infinity;           // when the visitor last used the wheel or the keyboard
  let magnetOff = false;               // whether this script has switched the page's magnetic sections off

  // One step of a critically damped spring: the fastest approach to a target that does not overshoot it
  // from rest. `state` holds a position p and a speed v; both change smoothly whatever the target does.
  const spring = (state, target, dt) => {
    const omega = 2 / SMOOTH, k = omega * dt, decay = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
    const away = state.p - target, push = (state.v + omega * away) * dt;
    state.v = (state.v - omega * push) * decay;
    state.p = target + (away + push) * decay;
  };

  // Where the page should come to rest: the next section when open, the top of Products when closed
  const landing = () => {
    const section = products.getBoundingClientRect();
    return scrollY + section.top + (open ? section.height : 0);
  };

  // A flick on a trackpad keeps sending wheel events for a second or more after the fingers lift. While the
  // page is scrolling itself those would fight it frame by frame, and after it lands they would push the
  // page past its target, for the magnetic sections to drag it slowly back. So from the moment the page
  // takes over until that momentum has died away, wheel events are swallowed, with two exceptions that
  // can only be the visitor acting on purpose:
  //   - an event in the opposite direction: while the page is scrolling itself it turns the animation
  //     around; after it has landed it is let through, and starts the animation the other way;
  //   - after landing, an event clearly stronger than the one before it (momentum only ever dies away):
  //     the visitor is scrolling on, and the hold ends at once.
  const QUIET = 220, HOLD_MAX = 2500;   // ms without a wheel event that ends the hold; and its upper limit
  let holdUntil = 0;                    // 0: not holding. While carrying: Infinity. After landing: the latest it may last
  let lastDelta = Infinity;             // size of the previous wheel event
  const turnAround = () => {
    open = !open;
    carry.to = landing();
    publish();
  };
  const swallow = (event) => {
    lastInput = performance.now();
    if (!holdUntil) return;   // not holding: the visitor's scroll is their own
    const size = Math.abs(event.deltaY), against = size >= 2 && Math.sign(event.deltaY) !== (open ? 1 : -1);
    const stronger = size > lastDelta * 1.6 + 3;
    lastDelta = size;
    if (carry) {
      if (against) turnAround();
      if (event.cancelable) event.preventDefault();
    } else if (against || stronger) release();
    else if (event.cancelable) event.preventDefault();
  };
  const hold = () => {
    holdUntil = Infinity; lastDelta = Infinity;
    holdMagnet('star-track', true);   // the magnetic sections must not pull against the page's own scroll
  };
  const release = () => { holdUntil = 0; magnetOff = false; holdMagnet('star-track', false); };
  // Getting ready ahead of time. A listener that may cancel wheel events, and elements that are about to
  // move, both cost the browser a moment of set-up the first time. Done at the instant the takeover
  // starts, that moment shows as a stutter in its first frames. So both are set up as Products comes
  // near (.is-near, see index.html), and taken down again when it is far away.
  new IntersectionObserver(([entry]) => {
    world.classList.toggle('is-near', entry.isIntersecting);
    if (entry.isIntersecting) addEventListener('wheel', swallow, { passive: false });
    else if (!holdUntil) removeEventListener('wheel', swallow);
  }, { rootMargin: '100% 0px' }).observe(products);
  const watchMomentum = () => {
    if (!holdUntil || holdUntil === Infinity) return;
    const now = performance.now();
    if (now - lastInput >= QUIET || now >= holdUntil) release(); else setTimeout(watchMomentum, 40);
  };
  // The keyboard, while the page is scrolling itself: keys that scroll down or up steer the animation
  const KEYS = { ArrowDown: 1, PageDown: 1, End: 1, ArrowUp: -1, PageUp: -1, Home: -1 };
  addEventListener('keydown', (event) => {
    lastInput = performance.now();
    if (!carry) return;
    const way = event.key === ' ' ? (event.shiftKey ? -1 : 1) : KEYS[event.key];
    if (!way) return;
    event.preventDefault();
    if (way !== (open ? 1 : -1)) turnAround();
  });
  addEventListener('wheel', () => { lastInput = performance.now(); }, { passive: true });

  // Draw the takeover at progress e (0 closed, 1 open)
  const draw = (e) => {
    const frame = stage.getBoundingClientRect();

    // The pane: from the card's box to the whole layer. Positions are relative to the layer, which moves
    // with the card until Products is pinned, so nothing lags behind the scroll.
    const box = card.getBoundingClientRect();
    glass.style.transform = `translate(${px(mix(box.left - frame.left, 0, e))}, ${px(mix(box.top - frame.top, 0, e))})`;
    glass.style.width = px(mix(box.width, frame.width, e));
    glass.style.height = px(mix(box.height, frame.height, e));
    const radius = mix(parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0, 0, e);
    glass.style.borderRadius = px(radius);

    // The progress bar: as full as the scroll is far through the dwell; it fades as the pane starts to grow
    const filled = open ? 1 : clamp(-products.getBoundingClientRect().top / dwell());
    for (const rect of [track, bar]) rect.setAttribute('rx', radius.toFixed(2));
    bar.style.strokeDashoffset = (1 - filled).toFixed(4);
    bar.style.opacity = filled > 0.002 ? '1' : '0';
    track.style.opacity = clamp(filled * 12).toFixed(3);
    ring.style.opacity = (1 - clamp(e * 5)).toFixed(3);
    world.dataset.starProgress = filled.toFixed(3);

    // The name: drawn by the title element at every stage. At rest it is scaled down to sit exactly where
    // the card's heading is; at the end it is full size at the top, in line with the page's content.
    const from = name.getBoundingClientRect();
    const nameStyle = getComputedStyle(name), titleStyle = getComputedStyle(title);
    const small = parseFloat(nameStyle.fontSize), large = parseFloat(titleStyle.fontSize);
    const lead = (parseFloat(nameStyle.lineHeight) - small) / 2 || 0;   // the heading's text sits this far below its box
    const endX = inner.getBoundingClientRect().left - frame.left;
    const endY = parseFloat(getComputedStyle(world).getPropertyValue('--st-title-top')) || 100;
    title.style.transform = `translate(${px(mix(from.left - frame.left, endX, e))}, ${px(mix(from.top - frame.top + lead, endY, e))}) scale(${mix(small / large, 1, e).toFixed(4)})`;
    band.style.opacity = e.toFixed(3);

    // What leaves: Flight Check to the right, the section's title upward, the card's own text in place
    other.style.opacity = (1 - clamp(e * 1.6)).toFixed(3);
    other.style.transform = `translateX(${px(e * 180)})`;
    head.style.opacity = (1 - clamp(e * 2.2)).toFixed(3);
    head.style.transform = `translateY(${px(-28 * e)})`;
    for (const el of rest) {
      el.style.opacity = (1 - clamp(e * 2.5)).toFixed(3);
      el.style.pointerEvents = e > 0.25 ? 'none' : '';
    }
  };
  // The state is published on the world element as data-star: closed, opening, open or closing
  const resting = () => progress.p === (open ? 1 : 0) && !carry;
  const publish = () => { world.dataset.star = resting() ? (open ? 'open' : 'closed') : open ? 'opening' : 'closing'; };

  // Decide from the scroll whether Star Track should be open. `direction` is 1 scrolling down, -1 up, 0 unknown.
  const decide = (direction) => {
    const section = products.getBoundingClientRect();
    const into = -section.top;                              // how far the scroll is into Products
    if (into < dwell()) open = false;                       // the progress bar is not full yet: the two cards
    else if (into >= section.height) open = true;           // below Products: always Star Track
    else if (direction > 0) open = true;                    // past the full bar, going down: open
    else if (direction < 0) open = false;                   // past the full bar, going up: close
    else open = true;                                       // past the full bar on arrival (a reload, a link): open
    // Inside Products the page's magnetic sections are off, or they would pull the scroll back to the top
    // of the section and empty the progress bar under the visitor's fingers
    if (!holdUntil) {
      const inside = into > 0 && into < section.height;
      if (inside !== magnetOff) { magnetOff = inside; holdMagnet('star-track', inside); }
    }
    // With Products out of the window there is nothing to watch: go straight to the end state
    if (section.bottom <= 0 || section.top >= innerHeight || reduceMotion.matches) { progress.p = open ? 1 : 0; progress.v = 0; }
    publish();
  };

  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const goal = open ? 1 : 0;
    if (progress.p !== goal) {
      spring(progress, goal, dt);
      // Turned around near an end, the spring can run past it: the pane is then simply at that end
      if (progress.p > 1 || progress.p < 0) { progress.p = clamp(progress.p); progress.v = 0; }
      if (Math.abs(progress.p - goal) < 0.0004 && Math.abs(progress.v) < 0.004) { progress.p = goal; progress.v = 0; }
    }
    if (carry) {
      if (carry.p !== carry.to) {
        spring(carry, carry.to, dt);
        if (Math.abs(carry.p - carry.to) < 0.4 && Math.abs(carry.v) < 6) { carry.p = carry.to; carry.v = 0; }
        scrollTo({ top: carry.p, behavior: 'instant' });
      }
      if (progress.p === goal && carry.p === carry.to) {
        // Landed. Keep swallowing what is left of the visitor's momentum until it dies away.
        carry = null;
        lastY = scrollY; speed = 0;
        holdUntil = performance.now() + HOLD_MAX;
        watchMomentum();
      }
    }
    draw(progress.p);
    publish();
    if (resting()) running = false; else requestAnimationFrame(frame);
  };
  // Draw now, and keep drawing while anything is moving
  const run = () => {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  };

  addEventListener('scroll', () => {
    const y = scrollY, now = performance.now();
    if (carry) { lastY = y; lastScroll = now; return; }   // the page is scrolling itself
    const elapsed = now - lastScroll;
    speed = elapsed > 0 && elapsed < 120 ? Math.max(-5000, Math.min(5000, ((y - lastY) / elapsed) * 1000)) : 0;
    const was = open;
    decide(Math.sign(y - lastY));
    lastY = y; lastScroll = now;
    // The visitor's own scroll has just started the animation: carry the page along with it, starting at
    // the speed it is already moving. A jump from a link does not count (it has its own destination), nor
    // does touch, where the finger holds the page.
    if (open !== was && !resting() && now - lastInput < 400) {
      carry = { p: y, v: speed, to: landing() };
      hold();
    }
    run();
  }, { passive: true });
  addEventListener('resize', run);
  new ResizeObserver(run).observe(world);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  decide(0);
  progress.p = open ? 1 : 0;   // on arrival there is no animation: the page starts in the right state
  draw(progress.p);
  publish();
}
