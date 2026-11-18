// Star Track takes over the page (assets/star-track.js). Products is pinned for a stretch of scroll.
// For the first window of that scroll a progress bar runs around the Star Track card; nothing else moves.
// Scrolling down past the full bar plays the opening to its end: the Star Track pane grows to fill the
// window, its name becomes the title at the top, and Flight Check fades out. Scrolling up inside the
// stretch plays it backwards, to its end. Below Products the pane and the title stay to the end of the page.
const { test, expect } = require('@playwright/test');

// Load the page and wait until its scripts have set the takeover up
const load = async (page) => {
  await page.goto('/');
  await page.waitForSelector('.world[data-star]');
};

// Put the scroll a given fraction through the pinned stretch of Products (0 = start, 1 = end), plus `extra`
// pixels, and return once the page has seen that scroll. The stretch is 1.1 windows long and the progress
// bar takes the first window of it, so the bar is full at 0.91.
const scrollProducts = (page, fraction, extra = 0) => page.evaluate(([f, x]) => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.documentElement.style.scrollSnapType = 'none';
  const section = document.querySelector('#products');
  scrollTo(0, section.getBoundingClientRect().top + scrollY + (section.offsetHeight - innerHeight) * f + x);
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}, [fraction, extra]);

const read = (page) => page.evaluate(() => {
  const box = (selector) => { const b = document.querySelector(selector).getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; };
  return {
    window: { width: document.documentElement.clientWidth, height: innerHeight },
    pane: box('.st-glass'), title: box('.st-title'), card: box('[data-product="star-track"]'), name: box('[data-product="star-track"] h3'),
    content: box('#how .block__inner'),
    flightCheck: Number(getComputedStyle(document.querySelector('[data-product="flight-check"]')).opacity),
  };
});
// Wait until the animation has come to rest, open or closed
const settle = (page) => page.waitForFunction(() => /^(open|closed)$/.test(document.querySelector('.world').dataset.star), null, { timeout: 15000 });

test('at the top of Products the pane is the Star Track card and the title sits on its name', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 0);
  await settle(page);
  const s = await read(page);
  for (const side of ['left', 'top', 'width', 'height']) expect(Math.abs(s.pane[side] - s.card[side]), side).toBeLessThan(1);
  expect(Math.abs(s.title.left - s.name.left)).toBeLessThan(1);
  expect(s.title.top).toBeGreaterThanOrEqual(s.name.top);
  expect(s.title.top + s.title.height).toBeLessThanOrEqual(s.name.top + s.name.height + 1);
  expect(s.flightCheck).toBe(1);
});

test('at the end of Products the pane fills the window, the title is at the top and Flight Check is gone', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 1);
  await settle(page);
  const s = await read(page);
  expect(Math.abs(s.pane.left)).toBeLessThan(1);
  expect(Math.abs(s.pane.top)).toBeLessThan(1);
  expect(Math.abs(s.pane.width - s.window.width)).toBeLessThan(1);
  expect(s.pane.height).toBeGreaterThanOrEqual(s.window.height - 1);
  expect(s.title.top).toBeGreaterThan(60);
  expect(s.title.top).toBeLessThan(140);
  expect(Math.abs(s.title.left - s.content.left)).toBeLessThan(1);   // in line with the page's content
  expect(s.flightCheck).toBe(0);
});

test('the pane and the title stay in place through the sections below', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 1);
  await settle(page);
  const before = await read(page);
  await page.evaluate(() => { scrollTo(0, document.querySelector('#pricing').getBoundingClientRect().top + scrollY); return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await settle(page);
  const after = await read(page);
  expect(Math.abs(after.title.top - before.title.top)).toBeLessThan(1);
  expect(Math.abs(after.title.left - before.title.left)).toBeLessThan(1);
  expect(Math.abs(after.pane.top)).toBeLessThan(1);
  expect(after.pane.height).toBeGreaterThanOrEqual(after.window.height - 1);
});

test('scrolling back up to the top of Products undoes it', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 1, 600);
  await settle(page);
  await scrollProducts(page, 0);
  await settle(page);
  const s = await read(page);
  for (const side of ['left', 'top', 'width', 'height']) expect(Math.abs(s.pane[side] - s.card[side]), side).toBeLessThan(1);
  expect(s.flightCheck).toBe(1);
});

test('scrolling just past the full bar opens it all the way, and a small scroll up closes it all the way', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 0);
  await settle(page);
  await scrollProducts(page, 0.95);   // just past the point where the bar is full
  await settle(page);
  let s = await read(page);
  expect(Math.abs(s.pane.left)).toBeLessThan(1);
  expect(Math.abs(s.pane.top)).toBeLessThan(1);
  expect(Math.abs(s.pane.width - s.window.width)).toBeLessThan(1);
  expect(s.pane.height).toBeGreaterThanOrEqual(s.window.height - 1);
  expect(s.flightCheck).toBe(0);

  await scrollProducts(page, 0.93);   // back up a little, still past the full bar
  await settle(page);
  s = await read(page);
  for (const side of ['left', 'top', 'width', 'height']) expect(Math.abs(s.pane[side] - s.card[side]), side).toBeLessThan(1);
  expect(s.flightCheck).toBe(1);
});

test('once started, the animation runs to its end without any more scrolling', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 0);
  await settle(page);
  await scrollProducts(page, 0.95);
  // Leave the scroll alone and watch the pane's width frame by frame until the animation rests
  const seen = await page.evaluate(() => new Promise((resolve) => {
    const widths = [], y = scrollY, world = document.querySelector('.world');
    const tick = () => {
      widths.push(document.querySelector('.st-glass').getBoundingClientRect().width);
      if (/^(open|closed)$/.test(world.dataset.star)) resolve({ widths, moved: scrollY !== y, window: document.documentElement.clientWidth, state: world.dataset.star });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  expect(seen.moved).toBe(false);
  expect(seen.state).toBe('open');
  expect(Math.abs(seen.widths[seen.widths.length - 1] - seen.window)).toBeLessThan(1);   // and it finished
});

test('scrolling up from further down the page does not close it', async ({ page }) => {
  await load(page);
  const settled = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))).then(() => settle(page));
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.documentElement.style.scrollSnapType = 'none'; scrollTo(0, document.querySelector('#pricing').getBoundingClientRect().top + scrollY); });
  await settled();
  await page.evaluate(() => scrollBy(0, -300));
  await settled();
  const s = await read(page);
  expect(Math.abs(s.pane.top)).toBeLessThan(1);
  expect(Math.abs(s.pane.width - s.window.width)).toBeLessThan(1);
});

test('opening with the wheel brings the next section up under the title, and closing brings Products back', async ({ page }) => {
  await load(page);
  await scrollProducts(page, 0.875);   // the bar is nearly full: one more turn of the wheel fills it
  await settle(page);
  const edges = () => page.evaluate(() => ({
    products: Math.round(document.querySelector('#products').getBoundingClientRect().top),
    next: Math.round(document.querySelector('#how').getBoundingClientRect().top),
    state: document.querySelector('.world').dataset.star,
  }));
  // Turn the wheel until the animation starts (a single tick can be lost to the page's magnetic sections,
  // as it can for a visitor, who simply keeps scrolling), then wait for it to finish
  const wheel = async (dy, goal) => {
    await page.mouse.move(700, 400);
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.waitForTimeout(400);
      await page.mouse.wheel(0, dy);
      const started = await page.waitForFunction((g) => {
        const state = document.querySelector('.world').dataset.star;
        return /ing$/.test(state) || state === g;
      }, goal, { timeout: 1500 }).then(() => true, () => false);
      if (started) break;
    }
    await settle(page);
  };

  await wheel(60, 'open');
  let e = await edges();
  expect(e.state).toBe('open');
  expect(Math.abs(e.next)).toBeLessThanOrEqual(1);       // the next section is at the top of the window, its content under the title

  await wheel(-60, 'closed');
  e = await edges();
  expect(e.state).toBe('closed');
  expect(Math.abs(e.products)).toBeLessThanOrEqual(1);   // Products is back at the top of the window
});

test('the progress bar around Star Track fills with the scroll, and nothing else moves until it is full', async ({ page }) => {
  await load(page);
  const bar = () => page.evaluate(() => {
    const world = document.querySelector('.world');
    const drawn = 1 - parseFloat(getComputedStyle(document.querySelector('.st-ring__bar')).strokeDashoffset);
    const pane = document.querySelector('.st-glass').getBoundingClientRect(), card = document.querySelector('[data-product="star-track"]').getBoundingClientRect();
    return { filled: Number(world.dataset.starProgress), drawn, state: world.dataset.star, paneIsCard: Math.abs(pane.width - card.width) < 1 && Math.abs(pane.height - card.height) < 1 };
  });
  // The bar takes one window of scroll; the pinned stretch is 1.1 windows
  for (const [fraction, expected] of [[0, 0], [0.25 / 1.1, 0.25], [0.5 / 1.1, 0.5], [0.8 / 1.1, 0.8]]) {
    await scrollProducts(page, fraction);
    await settle(page);
    const b = await bar();
    expect(b.state, `at ${expected * 100}% of the bar`).toBe('closed');
    expect(b.paneIsCard, `at ${expected * 100}% of the bar the pane is still the card`).toBe(true);
    expect(Math.abs(b.filled - expected), `bar at ${expected * 100}%`).toBeLessThan(0.02);
    expect(Math.abs(b.drawn - expected), `bar drawn at ${expected * 100}%`).toBeLessThan(0.02);
  }
  // Scrolling back up empties it again
  await scrollProducts(page, 0.25 / 1.1);
  await settle(page);
  expect(Math.abs((await bar()).filled - 0.25)).toBeLessThan(0.02);
});
