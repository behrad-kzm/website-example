// A phone visitor who scrolls hard: 100 fast swipes down and up the page, with a sideways swipe (left or
// right, at random) between each, and then a calm visit. Afterwards the page must still be in good shape:
//   1. back at the top, the hero planet is animating, and smoothly;
//   2. "What we do" (the second section) starts its animation smoothly as the visitor scrolls into it;
//   3. a soft scroll from there to the bottom of the page stays smooth, every section is drawn on the way,
//      and it reaches the footer.
// The sideways swipes must never move the page: it is never wider than the window.
//
// Swipes are real touch gestures (Chrome's synthetic scroll gestures, with the finger's speed), not wheel
// events. "Smooth" is measured from the browser's own frames (requestAnimationFrame): how long each frame
// took. A dropped frame here and there is allowed; a stall or a page that keeps missing frames is not.
// The frame timings and the measurements are attached to the test report.
const { test, expect } = require('@playwright/test');

// Motion is only worth measuring with real graphics (see tests/scroll-smoothness.spec.js), so this file asks
// for the GPU and runs in the "motion" group, on its own (playwright.config.js).
test.use({
  launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])] },
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
test.setTimeout(300000);
test.describe.configure({ retries: 1 });

const SWIPES = 100;
// Limits, in milliseconds per frame. At 60 frames a second a frame takes 16.7ms. A healthy run here draws
// every frame on time (longest about 17ms). The limits were checked against a page made to stall for
// 80ms every 0.7s, a stutter anyone would see: its longest frames were 67-100ms and 2.5% of frames were
// late, and it fails.
const SMOOTH = {
  median: 20,        // the typical frame is on time
  p95: 34,           // 19 frames in 20 are on time or one frame late
  longest: 50,       // never more than two frames dropped in a row
  late: 0.01,        // at most 1 frame in 100 later than 34ms
};

// Repeatable "random": the same seed gives the same swipes, so a failure can be run again exactly.
// Set STRESS_SEED to replay a run; the seed in use is printed and attached to the report.
const seed = Number(process.env.STRESS_SEED) || Math.floor(Math.random() * 1e9);
const random = (() => {
  let a = seed >>> 0;
  return () => {   // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const between = (lo, hi) => lo + random() * (hi - lo);

// One touch swipe. distance > 0 moves the page down (the finger moves up), like a real scroll.
const swipe = (client, { x = 0, y = 0, speed }) => client.send('Input.synthesizeScrollGesture', {
  x: 195, y: 520, xDistance: -Math.round(x), yDistance: -Math.round(y), speed: Math.round(speed), gestureSourceType: 'touch',
});

// Frame recorder: every requestAnimationFrame timestamp until stopped, with where the page was (scroll
// position and the section in the middle of the window). Alongside it, the browser's own reports of slow
// frames (Long Animation Frames), which name the scripts that ran in them: when a frame is late, the
// report says where on the page it happened and whose code was running.
const startFrames = (page) => page.evaluate(() => {
  window.__frames = []; window.__slow = []; window.__recording = true;
  const sectionAt = () => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const section = el && el.closest('section, footer');
    return section ? section.id || section.className.split(' ')[0] : '';
  };
  const tick = (now) => {
    if (!window.__recording) return;
    window.__frames.push([now, Math.round(scrollY), sectionAt()]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    window.__slowObserver = new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__slow.push({
      at: e.startTime, ms: Math.round(e.duration), blocking: Math.round(e.blockingDuration),
      scripts: e.scripts.map((s) => `${(s.sourceURL || '').split('/').pop() || '?'} ${s.invoker} ${Math.round(s.duration)}ms`),
    })));
    window.__slowObserver.observe({ type: 'long-animation-frame' });
  }
});
const stopFrames = (page) => page.evaluate(() => {
  window.__recording = false;
  if (window.__slowObserver) window.__slowObserver.disconnect();
  return { frames: window.__frames, slow: window.__slow };
});

const LATE_MS = 34;
const measure = ({ frames: rows, slow }) => {
  const frames = rows.slice(1).map((row, i) => ({ ms: row[0] - rows[i][0], at: row[0], y: row[1], section: row[2] }));
  const sorted = frames.map((f) => f.ms).sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  // Each late frame: how long, where, and the browser's report of what ran around that moment
  const lateFrames = frames.filter((f) => f.ms > LATE_MS).map((f) => ({
    ms: Math.round(f.ms * 10) / 10, scrollY: f.y, section: f.section,
    ran: slow.filter((s) => s.at < f.at && s.at + s.ms > f.at - f.ms).flatMap((s) => s.scripts),
  }));
  return {
    frames: sorted.length,
    seconds: Math.round((rows[rows.length - 1][0] - rows[0][0]) / 100) / 10,
    median: Math.round(at(0.5) * 10) / 10,
    p95: Math.round(at(0.95) * 10) / 10,
    longest: Math.round(sorted[sorted.length - 1] * 10) / 10,
    late: Math.round((lateFrames.length / sorted.length) * 1000) / 1000,
    lateFrames,
  };
};
const record = async (page, info, name, during) => {
  await startFrames(page);
  await during();
  const result = measure(await stopFrames(page));
  console.log(`${name}: ${JSON.stringify(result)}`);
  await info.attach(`frames: ${name}`, { body: JSON.stringify(result), contentType: 'application/json' });
  return result;
};
const expectSmooth = (result, name) => {
  expect(result.frames, `${name}: frames drawn`).toBeGreaterThan(30);
  expect(result.median, `${name}: typical frame (ms)`).toBeLessThanOrEqual(SMOOTH.median);
  expect(result.p95, `${name}: 95th percentile frame (ms)`).toBeLessThanOrEqual(SMOOTH.p95);
  expect(result.longest, `${name}: longest frame (ms)`).toBeLessThanOrEqual(SMOOTH.longest);
  expect(result.late, `${name}: share of frames later than 34ms`).toBeLessThanOrEqual(SMOOTH.late);
};

// Is this element's picture changing? Two screenshots a moment apart must differ.
const isMoving = async (page, locator) => {
  const a = await locator.screenshot();
  await page.waitForTimeout(600);
  const b = await locator.screenshot();
  return !a.equals(b);
};
const scrollYOf = (page) => page.evaluate(() => scrollY);
const atBottom = (page) => page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);

test('after 100 fast swipes up and down, the planet, "What we do" and the rest of the page still run smoothly', async ({ page, context }, info) => {
  console.log(`STRESS_SEED=${seed}`);
  await info.attach('seed', { body: String(seed), contentType: 'text/plain' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForSelector('.planet.is-ready', { timeout: 20000 });
  const client = await context.newCDPSession(page);

  // ── The hard scrolling: 100 rounds of a fast swipe down, a sideways swipe, a fast swipe up ──
  // Down a little further than up on average, so the swipes wander over the whole page, not just the top.
  let widest = 0, deepest = 0;
  for (let i = 0; i < SWIPES; i++) {
    await swipe(client, { y: between(700, 2600), speed: between(4000, 8000) });
    deepest = Math.max(deepest, await scrollYOf(page));
    await swipe(client, { x: (random() < 0.5 ? -1 : 1) * between(120, 320), speed: between(1500, 4000) });
    widest = Math.max(widest, await page.evaluate(() => Math.abs(scrollX)));
    await swipe(client, { y: -between(500, 2200), speed: between(4000, 8000) });
  }
  console.log(`swipes reached ${deepest}px down the page`);
  expect(deepest, 'the swipes really moved the page (several windows down)').toBeGreaterThan(844 * 3);
  expect(widest, 'pixels the page moved sideways (it must never be wider than the window)').toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'page wider than the window').toBeLessThanOrEqual(0);

  // ── 1. Back to the top: the planet is there, moving, and smooth ──
  for (let i = 0; i < 40 && (await scrollYOf(page)) > 0; i++) await swipe(client, { y: -4000, speed: 8000 });
  await page.waitForTimeout(1500);   // the fling dies away
  expect(await scrollYOf(page), 'at the top').toBe(0);
  const planet = page.locator('[data-planet]');
  expect(await planet.evaluate((el) => getComputedStyle(el).visibility), 'the planet is shown at the top').toBe('visible');
  expect(await isMoving(page, planet), 'the planet is animating (not frozen into a still)').toBe(true);
  const hero = await record(page, info, 'planet at the top', () => page.waitForTimeout(3000));
  expectSmooth(hero, 'planet at the top');

  // ── 2. A soft scroll into "What we do": its animation starts, smoothly ──
  const wwd = page.locator('#what-we-do');
  const wwdTop = await wwd.evaluate((el) => el.getBoundingClientRect().top + scrollY);
  const intoWwd = await record(page, info, 'scrolling into What we do', async () => {
    while ((await scrollYOf(page)) < wwdTop - 2) {
      await swipe(client, { y: Math.min(220, wwdTop - (await scrollYOf(page))), speed: 500 });
    }
    await page.waitForTimeout(2000);   // the section settles and its animation runs
  });
  expectSmooth(intoWwd, 'scrolling into What we do');
  const sky = page.locator('.wwd__sky canvas');
  if (await wwd.evaluate((el) => !el.classList.contains('no-sky') && !el.classList.contains('is-static'))) {
    await expect(sky, 'the constellation is shown').toBeVisible();
    expect(await isMoving(page, sky), 'the constellation is animating').toBe(true);
  }

  // ── 3. A soft scroll to the bottom: smooth all the way, and every section is drawn ──
  await page.evaluate(() => {
    window.__seen = new Set();
    const watch = new IntersectionObserver((entries) => entries.forEach((e) => {
      const box = e.target.getBoundingClientRect();
      if (e.isIntersecting && box.width > 0 && box.height > 0 && getComputedStyle(e.target).visibility !== 'hidden') window.__seen.add(e.target.id || e.target.className);
    }));
    document.querySelectorAll('main section, section.section, .site-footer').forEach((el) => watch.observe(el));
  });
  const down = await record(page, info, 'soft scroll to the bottom', async () => {
    for (let i = 0; i < 400 && !(await atBottom(page)); i++) {
      await swipe(client, { y: 260, speed: 700 });
      await page.waitForTimeout(120);   // a reading pace: the finger lifts between swipes
    }
    await page.waitForTimeout(1000);
  });
  expect(await atBottom(page), 'reached the bottom of the page').toBe(true);
  expectSmooth(down, 'soft scroll to the bottom');

  const sections = await page.evaluate(() => [...document.querySelectorAll('section.section')].map((s) => s.id).filter((id) => id && id !== 'what-we-do'));
  const seen = await page.evaluate(() => [...window.__seen]);
  for (const id of sections) expect(seen, `section #${id} was drawn on the way down`).toContain(id);
  expect(seen, 'the footer was reached').toContain('site-footer');
  await expect(page.locator('.site-footer')).toBeInViewport();

  expect(errors, 'script errors on the page').toEqual([]);
});
