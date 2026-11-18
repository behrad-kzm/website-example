// "What we do": a pinned section. The headline stays in place. First only the description shows; scrolling
// replaces it with three points, one at a time, a progress bar shows how far the scroll is through each, while a constellation of three bodies opens up on the right
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
    rail.forEach((el, k) => el.classList.toggle('is-active', k === index));
    buttons.forEach((el, k) => {
      if (k === index - offset) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
  }

  // The step on screen follows the scroll position: the pinned stretch is divided into equal bands, one
  // per step. The progress bar has one segment per step, and each fills as the scroll crosses its band,
  // so the visitor sees how much scrolling is left before the text changes and before the section ends.
  const IDLE = 160;     // milliseconds without a scroll event before the scroll counts as at rest
  const last = steps.length - 1;
  let idleTimer = 0;

  const measure = () => ({ span: root.offsetHeight - sticky.offsetHeight, scrolled: -root.getBoundingClientRect().top });

  // The page's magnetic sections (scroll snap on <html>) would pull the scroll out of the pinned stretch,
  // so they are switched off while the scroll is inside it. They come back on only once the scroll rests
  // outside: switching them on in the middle of a gesture would cut the gesture short.
  function setMagnet(on) { document.documentElement.style.scrollSnapType = on ? '' : 'none'; }

  function show(step) {
    if (step !== active) setActive(step);
    // While only the description shows, the first body is the only one in view, and it stays forward
    for (let i = 0; i < 3; i++) focus[i] = i + offset === step || (i === 0 && step === 0) ? 1 : 0;
    focus[3] = step === 0 ? 0 : 1;
    if (sky) sky.kick();
  }

  function onScroll() {
    if (!isPinned()) return;
    const { span, scrolled } = measure();
    const through = span > 0 ? clamp(scrolled / span, 0, 1) * steps.length : 0;   // 0 to the number of steps
    show(clamp(Math.floor(through), 0, last));
    rail.forEach((el, k) => el.style.setProperty('--p', clamp(through - k, 0, 1).toFixed(4)));
    lightBullets(through);
    if (scrolled > 0 && scrolled < span) setMagnet(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onRest, IDLE);
  }

  // Inside a point's band, its bullets take turns: the band is split evenly between them, and the bullet
  // whose share the scroll is in is the current one. Bullets before it count as read.
  const bullets = panels.map((panel) => [...panel.querySelectorAll('li')]);
  function lightBullets(through) {
    bullets.forEach((items, i) => {
      const local = clamp(through - (i + offset), 0, 1);   // 0 to 1 through this point's band
      const current = through < i + offset ? -1 : clamp(Math.floor(local * items.length), 0, items.length - 1);
      items.forEach((li, j) => {
        li.classList.toggle('is-current', j === current);
        li.classList.toggle('is-read', j < current);
      });
    });
  }

  function onRest() {
    if (!isPinned()) return;
    const { span, scrolled } = measure();
    if (scrolled <= 0 || scrolled >= span) setMagnet(true);
  }

  // Pin the section only if its content fits one window; otherwise show the plain list
  function configure() {
    root.classList.remove('is-static');
    const overflows = inner.scrollHeight > inner.clientHeight + 1 || copy.scrollHeight > copy.clientHeight + 1;
    root.classList.toggle('is-static', overflows);
    active = -1;
    setMagnet(true);
    onScroll();
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => {
    // Scroll to the start of that point's band
    const { span, scrolled } = measure();
    const target = ((i + offset) / steps.length) * span + 2;
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
  // Text set in the fallback font is wider and may not fit, so measure again whenever web fonts arrive
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(configure);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', configure);

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
