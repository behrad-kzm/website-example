// "What we do": the pinned section that goes through the description and three points as the visitor
// scrolls (assets/what-we-do.js).
//
// The rule under test: the step on screen follows the scroll position. The pinned stretch is divided into
// four equal bands, one per step, and the progress bar has one segment per step that fills as the scroll
// crosses that step's band.
const { test, expect } = require('@playwright/test');

const DESCRIPTION = 0, CLIENTS = 1, PRODUCE = 2, GAIN = 3;
const STEPS = 4;

// Which steps are marked as showing, how full each progress segment is (0 to 1), whether the section is
// pinned to the window, and how far through the pinned stretch the scroll is (0 to 4)
const read = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-wwd]');
  const sticky = root.querySelector('.wwd__sticky');
  const showing = [...root.querySelectorAll('.wwd__step')]
    .map((el, i) => (el.classList.contains('is-active') ? i : -1))
    .filter((i) => i >= 0);
  const bar = [...root.querySelectorAll('.wwd__rail span')].map((el) => Number(el.style.getPropertyValue('--p') || 0));
  const span = root.offsetHeight - sticky.offsetHeight;
  const scrolled = -root.getBoundingClientRect().top;
  return {
    showing, bar,
    pinned: Math.abs(sticky.getBoundingClientRect().top) < 1,
    through: (Math.min(Math.max(scrolled / span, 0), 1)) * 4,
  };
});

// Put the scroll a given distance through the pinned stretch: 0 = start, 4 = end, 1.5 = halfway through the first point
const scrollThrough = (page, through) => page.evaluate((t) => {
  const root = document.querySelector('[data-wwd]');
  const span = root.offsetHeight - root.querySelector('.wwd__sticky').offsetHeight;
  scrollTo(0, root.offsetTop + (t / 4) * span);
}, through);

// The step and the bar agree with the scroll position
async function expectInStep(page) {
  await expect.poll(async () => {
    const { showing, bar, through } = await read(page);
    const step = Math.min(Math.floor(through), STEPS - 1);
    const barOk = bar.every((p, k) => Math.abs(p - Math.min(Math.max(through - k, 0), 1)) < 0.01);
    return showing.length === 1 && showing[0] === step && barOk;
  }, { intervals: [25], timeout: 3000 }).toBe(true);
}

const expectStep = (page, step) =>
  expect.poll(async () => (await read(page)).showing, { intervals: [25], timeout: 3000 }).toEqual([step]);

// A burst of wheel events in one direction. It returns while the page is still scrolling.
async function wheel(page, pixels) {
  const events = Math.ceil(Math.abs(pixels) / 40);
  for (let i = 0; i < events; i++) {
    await page.mouse.wheel(0, pixels / events);
    await page.waitForTimeout(16);
  }
}

const rest = (page) => page.waitForTimeout(700);

test.beforeEach(async ({ page }) => {
  // The section needs nothing from the network: web fonts and the WebGL library are left out, so the
  // tests do not depend on other servers (without the library the section simply shows no sky)
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-wwd] .wwd__step.is-active'));
  await page.mouse.move(400, 400);
  await scrollThrough(page, 0);
  await rest(page);
});

test('arriving shows only the description, pinned, with an empty progress bar', async ({ page }) => {
  const state = await read(page);
  expect(state.showing).toEqual([DESCRIPTION]);
  expect(state.pinned).toBe(true);
  expect(state.bar).toEqual([0, 0, 0, 0]);
  await expect(page.locator('.wwd__rail')).toBeVisible();
});

test('each band of the scroll shows its own step', async ({ page }) => {
  for (const step of [DESCRIPTION, CLIENTS, PRODUCE, GAIN]) {
    for (const within of [0.05, 0.5, 0.95]) {
      await scrollThrough(page, step + within);
      await expectStep(page, step);
      expect((await read(page)).pinned).toBe(true);
    }
  }
});

test('the progress bar fills with the scroll: earlier segments full, the current one partly, later ones empty', async ({ page }) => {
  await scrollThrough(page, 2.25);
  await expectStep(page, PRODUCE);
  const { bar } = await read(page);
  expect(bar[0]).toBe(1);
  expect(bar[1]).toBe(1);
  expect(bar[2]).toBeCloseTo(0.25, 2);
  expect(bar[3]).toBe(0);

  // The fill is drawn, not only stored: the dark part of the current segment covers a quarter of it
  const background = await page.locator('.wwd__rail span').nth(2).evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(background).toMatch(/25%/);
});

test('scrolling with the wheel does not change the step until its segment is full', async ({ page }) => {
  await wheel(page, 600);   // well under one band (two windows of scrolling)
  await rest(page);
  let state = await read(page);
  expect(state.showing).toEqual([DESCRIPTION]);
  expect(state.bar[0]).toBeGreaterThan(0.2);
  expect(state.bar[0]).toBeLessThan(1);

  await wheel(page, 1300);  // past the end of the first band
  await rest(page);
  state = await read(page);
  expect(state.showing).toEqual([CLIENTS]);
  expect(state.bar[0]).toBe(1);
  expect(state.bar[1]).toBeGreaterThan(0);
  expect(state.pinned).toBe(true);
});

test('scrolling up and down without pausing keeps the step and the bar in line with the scroll', async ({ page }) => {
  await scrollThrough(page, 1.9);
  for (const pixels of [400, -300, 500, -700, 250, 900, -1200, 600]) {
    await wheel(page, pixels);
    await expectInStep(page);
  }
  await rest(page);
  await expectInStep(page);
  expect((await read(page)).pinned).toBe(true);
});

test('the scroll stays where the visitor left it', async ({ page }) => {
  await scrollThrough(page, 1.5);
  await rest(page);
  const before = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await expectStep(page, CLIENTS);
});

test('scrolling back up returns to the description and empties the bar', async ({ page }) => {
  await scrollThrough(page, 3.6);
  await expectStep(page, GAIN);
  await scrollThrough(page, 0);
  await expectStep(page, DESCRIPTION);
  expect((await read(page)).bar).toEqual([0, 0, 0, 0]);
});

test('past the end of the last band the bar is full and the section scrolls away', async ({ page }) => {
  await scrollThrough(page, 3.9);
  await expectStep(page, GAIN);
  await wheel(page, 1200);
  await expect.poll(async () => (await read(page)).pinned, { timeout: 5000 }).toBe(false);
  const state = await read(page);
  expect(state.showing).toEqual([GAIN]);
  expect(state.bar).toEqual([1, 1, 1, 1]);
});
