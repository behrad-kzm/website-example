// "How it works": a pinned section, like "What we do". The headline stays in place while the scroll
// crosses one band per step; only the current step shows, a progress bar fills as the scroll crosses each
// band in the row of steps under the headline. On the right is a report of five pages, one per step:
// changing step sends the front page to the back of the pile, and within a step the three parts of its
// page fill in one by one as the scroll crosses the step's band. Without this script (or when the
// content cannot fit one window) the section is a plain grid of cards.
import { holdMagnet } from './magnet.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function init(root) {
  const sticky = root.querySelector('.how__sticky');
  const inner = root.querySelector('.how__inner');
  const steps = [...root.querySelectorAll('.how__step')];
  const copy = root.querySelector('.how__copy');
  const rail = [...root.querySelectorAll('.how__bar')];
  const docBox = root.querySelector('.how__doc');
  const doc = root.querySelector('.doc');
  const tiles = [...root.querySelectorAll('.doc__tile')];         // the floor tiles, one per step
  const pages = [...root.querySelectorAll('.doc__page')];
  const sections = pages.map((page) => [...page.querySelectorAll('.doc__sec')]);
  const buttons = [...root.querySelectorAll('.how__go')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const last = steps.length - 1;
  const IDLE = 160;   // milliseconds without a scroll event before the scroll counts as at rest
  let active = -1;
  let idleTimer = 0;

  const isPinned = () => !root.classList.contains('is-static');
  const measure = () => ({ span: root.offsetHeight - sticky.offsetHeight, scrolled: -root.getBoundingClientRect().top });

  // The page's magnetic sections would pull the scroll out of the pinned stretch, so they are off while
  // the scroll is inside it, and come back on once it rests outside (only if this section switched them off)
  const setMagnet = (on) => holdMagnet('how-it-works', !on);

  function setActive(index) {
    const from = active;
    active = index;
    turnPages(from, index);
    steps.forEach((el, k) => {
      el.classList.toggle('is-active', k === index);
      el.classList.toggle('is-before', k < index);
    });
    tiles.forEach((el) => {
      const k = Number(el.dataset.step);
      el.classList.toggle('is-on', k <= index);
      el.classList.toggle('is-now', k === index);
    });
    buttons.forEach((el, k) => {
      if (k === index) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      el.classList.toggle('is-done', k < index);
    });
  }

  // Each page's place in the pile: 0 in front, then 1, 2, 3, 4 behind. One step forward, the page that was
  // in front slides out and goes to the back; one step back, the page at the back comes round to the front.
  // Any other change (the first set-up, a jump of several steps) just moves the pages to their places.
  function turnPages(from, to) {
    pages.forEach((page, k) => {
      page.classList.remove('to-back', 'to-front');
      page.style.setProperty('--pos', (k - to + pages.length) % pages.length);
    });
    const mover = to === from + 1 ? pages[from] : to === from - 1 ? pages[to] : null;
    if (!mover || from < 0) return;
    void mover.offsetWidth;   // restart the animation if it was already playing
    mover.classList.add(to > from ? 'to-back' : 'to-front');
  }

  // A page's three parts take turns: the step's band is split evenly between them. Pages already passed
  // are complete; pages still ahead are empty.
  function fillPages(through) {
    sections.forEach((parts, k) => {
      const reached = through < k ? -1 : clamp(Math.floor((through - k) * parts.length), 0, parts.length - 1);
      parts.forEach((el, j) => el.classList.toggle('is-on', j <= reached));
    });
  }

  function onScroll() {
    if (!isPinned()) return;
    const { span, scrolled } = measure();
    const through = span > 0 ? clamp(scrolled / span, 0, 1) * steps.length : 0;   // 0 to the number of steps
    const step = clamp(Math.floor(through), 0, last);
    if (step !== active) setActive(step);
    rail.forEach((el, k) => el.style.setProperty('--p', clamp(through - k, 0, 1).toFixed(4)));
    fillPages(through);
    // Show the report once the section is at the top of the window; hide it again well above the section
    if (scrolled >= -8) root.classList.add('is-arrived');
    else if (scrolled < -innerHeight * 0.6) root.classList.remove('is-arrived');
    if (scrolled > 0 && scrolled < span) setMagnet(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onRest, IDLE);
  }

  function onRest() {
    if (!isPinned()) return;
    const { span, scrolled } = measure();
    if (scrolled <= 0 || scrolled >= span) setMagnet(true);
  }

  // Pin the section only if its content fits one window; otherwise show the plain grid
  function configure() {
    root.classList.remove('is-static');
    const overflows = copy.offsetHeight > inner.clientHeight + 1 || copy.scrollWidth > copy.clientWidth + 1;
    root.classList.toggle('is-static', overflows);
    // The report is drawn at 420 x 480: scale it down to the room it has
    if (!overflows && docBox.clientWidth) doc.style.setProperty('--doc-k', Math.min(1, docBox.clientWidth / 420, docBox.clientHeight / 480).toFixed(3));
    active = -1;
    if (overflows) steps.forEach((el) => el.classList.remove('is-active', 'is-before'));
    onScroll();
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => {
    const { span, scrolled } = measure();
    const target = (i / steps.length) * span + 2;   // the start of that step's band
    scrollBy({ top: target - scrolled, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
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
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', configure);

  configure();
}

const root = document.querySelector('[data-how]');
if (root) init(root);
