// "What we do": a pinned section. The headline stays in place. First only the description shows; scrolling
// replaces it with three points, one at a time, while a constellation of three bodies opens up on the right
// and brings the body of the current point forward. The constellation itself is drawn by
// assets/what-we-do-sky.js, which is fetched only when the section comes near the screen. Without this script (or when the content cannot fit one window) the section is a plain list.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function init(root) {
  const sticky = root.querySelector('.wwd__sticky');
  const inner = root.querySelector('.wwd__inner');
  const copy = root.querySelector('.wwd__copy');
  const lead = root.querySelector('.wwd__lead');
  const panels = [...root.querySelectorAll('.wwd__panel')];
  const rail = [...root.querySelectorAll('.wwd__rail span')];
  const buttons = [...root.querySelectorAll('.wwd__star')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const steps = [lead, ...panels]; // the description is the first step, before the points
  const offset = 1;                // index of the first point within steps
  let active = -1;
  // What the sky should show. 0 to 2: how far each body comes forward, 0 to 1. 3: how far the constellation
  // is spread out: 0 = seen head-on, the other two bodies hidden behind the first; 1 = seen from above.
  const focus = [1, 0, 0, 0];

  let sky = null;   // set once assets/what-we-do-sky.js has loaded

  const isPinned = () => !root.classList.contains('is-static');

  function setActive(index) {
    active = index;
    root.classList.toggle('is-intro', index === 0);
    steps.forEach((el, k) => {
      el.classList.toggle('is-active', k === index);
      el.classList.toggle('is-before', k < index);
    });
    rail.forEach((el, k) => el.classList.toggle('is-active', k === index - offset));
    buttons.forEach((el, k) => {
      if (k === index - offset) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
  }

  // One stroke of scrolling moves one step. A stroke is an unbroken run of scrolling in one direction: it
  // ends when the scroll rests or turns around. So scrolling down, then straight back up, then down again
  // goes forward, back, forward, one step each, with no waiting in between.
  //
  // While the section is pinned its content does not move, so the scroll position inside the pinned
  // stretch is invisible to the visitor. The script uses that in two ways:
  // 1. The step on screen follows the strokes, not the position: TRIGGER pixels into a stroke the next
  //    (or previous) step shows, and it stays however far that stroke travels.
  // 2. When the scroll rests, the scroll position is silently moved to the resting place of the step on
  //    screen: the first step rests at the very start of the pinned stretch and the last at its very
  //    end, so scrolling past either one leaves the section at once.
  const TRIGGER = 30;   // pixels a stroke travels before it takes its step
  const TURN = 8;       // pixels of scrolling the other way that count as turning around
  const IDLE = 160;     // milliseconds without a scroll event before the scroll counts as at rest
  const last = steps.length - 1;
  let lastScrolled = null;  // scroll position within the section at the previous scroll event
  let lastSide = 0;         // where that was: -1 above the pinned stretch, 0 inside it, 1 below
  // The current stroke
  let dir = 0;              // -1 up, 1 down, 0 at rest
  let travel = 0;           // pixels travelled in that direction
  let turn = 0;             // pixels travelled against it since it last moved forward
  let stepped = false;      // whether it has taken its one step
  let fromAfar = false;     // whether it began well outside the section (for example in the hero)
  let restInside = false;   // whether the scroll last rested inside the pinned stretch
  let leaving = 0;          // set when scrolling that began inside is now outside: -1 above, 1 below
  let idleTimer = 0, touching = false;

  const measure = () => ({ span: root.offsetHeight - sticky.offsetHeight, scrolled: -root.getBoundingClientRect().top });
  const restPosition = (step, span) => (step === 0 ? 0 : step === last ? span : ((step + 0.5) / steps.length) * span);
  const sideOf = (scrolled, span) => (scrolled < -1 ? -1 : scrolled > span + 1 ? 1 : 0);

  // The page's magnetic sections (scroll snap on <html>) would pull the scroll away from our resting
  // places, so they are switched off while the scroll is inside the pinned stretch
  function setMagnet(on) { document.documentElement.style.scrollSnapType = on ? '' : 'none'; }

  function show(step) {
    if (step !== active) setActive(step);
    // While only the description shows, the first body is the only one in view, and it stays forward
    for (let i = 0; i < 3; i++) focus[i] = i + offset === step || (i === 0 && step === 0) ? 1 : 0;
    focus[3] = step === 0 ? 0 : 1;
    if (sky) sky.kick();
  }

  function endStroke() { dir = 0; travel = 0; turn = 0; stepped = false; fromAfar = false; }

  // Rest on a step: move the scroll position to its resting place without the visitor seeing it
  function settle(step, span, scrolled) {
    endStroke();
    restInside = true;
    leaving = 0;
    setMagnet(false);
    const target = restPosition(step, span);
    if (Math.abs(scrolled - target) > 1) scrollBy(0, target - scrolled);
    lastScrolled = measure().scrolled;   // so our own move is not read as a stroke
    lastSide = 0;
  }

  function onScroll() {
    if (!isPinned()) return;
    const { span, scrolled } = measure();
    const side = sideOf(scrolled, span);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onRest, IDLE);

    if (lastScrolled === null) {
      // First reading (page load, or after a resize): go by where the scroll is
      lastScrolled = scrolled;
      lastSide = side;
      show(side < 0 ? 0 : side > 0 ? last : span > 0 ? clamp(Math.floor((scrolled / span) * steps.length), 0, last) : 0);
      return;
    }

    // Follow the stroke
    const delta = scrolled - lastScrolled;
    const before = lastScrolled;
    lastScrolled = scrolled;
    if (delta !== 0) {
      if (Math.sign(delta) === dir) { travel += Math.abs(delta); turn = 0; }
      else {
        turn += Math.abs(delta);
        if (dir === 0 || turn > TURN) {
          // A new stroke: the scroll has started from rest, or has turned around
          const outsideBy = Math.max(-before, before - span, 0);
          dir = Math.sign(delta); travel = turn; turn = 0; stepped = false;
          fromAfar = outsideBy > 0.5 * sticky.offsetHeight;
        }
      }
    }

    if (side !== 0) {
      // Outside the pinned stretch: show the step at that end
      if (restInside) leaving = side;
      show(side < 0 ? 0 : last);
    } else {
      leaving = 0;
      if (lastSide !== 0) {
        // The stroke has just come in. One that began far away (a scroll down from the hero, say) has
        // spent its step on arriving: the step at this end holds until the scroll rests or turns. One
        // that began just outside is the visitor moving around within the section, so it steps as usual.
        stepped = fromAfar;
        travel = lastSide < 0 ? scrolled : span - scrolled;
      }
      if (!stepped && travel > TRIGGER) {
        stepped = true;
        show(clamp(active + dir, 0, last));
      }
    }
    lastSide = side;
  }

  function onRest() {
    if (!isPinned()) return;
    // A finger resting on the screen is not the end of the stroke
    if (touching) { idleTimer = setTimeout(onRest, IDLE); return; }
    const { span, scrolled } = measure();
    // If the page was busy, this timer can fire before a pending scroll event has been handled. The
    // scroll is only at rest if it is still where the last handled event left it.
    if (lastScrolled !== null && Math.abs(scrolled - lastScrolled) > 0.5) { onScroll(); return; }
    if (sideOf(scrolled, span) === 0) { settle(active, span, scrolled); return; }
    endStroke();
    const wasLeaving = leaving;
    leaving = 0;
    restInside = false;
    const height = sticky.offsetHeight;
    if (wasLeaving && scrolled > -height && scrolled < span + height) {
      // The scroll left from the first or last step but stopped with the section still partly on
      // screen: finish the move to the neighbouring section, so leaving also takes one stroke
      scrollBy({ top: wasLeaving > 0 ? span + height - scrolled : -height - scrolled, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      return; // the magnet comes back on at the next rest
    }
    setMagnet(true);
  }

  addEventListener('touchstart', () => { touching = true; }, { passive: true });
  for (const type of ['touchend', 'touchcancel']) addEventListener(type, () => { touching = false; }, { passive: true });

  // Pin the section only if its content fits one window; otherwise show the plain list
  function configure() {
    root.classList.remove('is-static');
    const overflows = inner.scrollHeight > inner.clientHeight + 1 || copy.scrollHeight > copy.clientHeight + 1;
    root.classList.toggle('is-static', overflows);
    active = -1;
    lastScrolled = null;
    restInside = false;
    leaving = 0;
    endStroke();
    setMagnet(true);
    onScroll();
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => {
    const { span, scrolled } = measure();
    show(i + offset);
    settle(i + offset, span, scrolled);
  }));

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }, { passive: true });

  let size = '';
  addEventListener('resize', () => {
    const next = innerWidth + 'x' + sticky.offsetHeight;
    if (next !== size) { size = next; configure(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(configure);

  // The sky needs Three.js and the hero planet's code: fetch it when the section is within a window of
  // the screen, and only draw while the section is on screen
  let skyRequested = false;
  new IntersectionObserver((entries) => {
    const near = entries[entries.length - 1].isIntersecting;
    if (near && !skyRequested) {
      skyRequested = true;
      import('./what-we-do-sky.js')
        .then((module) => {
          sky = module.createSky(root.querySelector('.wwd__sky'), buttons, focus, reduceMotion);
          if (!sky) throw new Error('no WebGL');
          new IntersectionObserver(([entry]) => sky.setVisible(entry.isIntersecting)).observe(root);
        })
        .catch(() => { sky = null; root.classList.add('no-sky'); configure(); });
    }
  }, { rootMargin: '100% 0px' }).observe(root);

  configure();
}

const root = document.querySelector('[data-wwd]');
if (root) init(root);
