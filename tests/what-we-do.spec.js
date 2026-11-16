// "What we do": the pinned section that steps through the description and three points as the visitor
// scrolls (assets/what-we-do.js). These tests drive it with real mouse-wheel input.
//
// The rule under test: one stroke of scrolling moves one step. A stroke is an unbroken run of scrolling
// in one direction; it ends when the scroll rests or turns around.
const { test, expect } = require('@playwright/test');

const DESCRIPTION = 0, CLIENTS = 1, PRODUCE = 2, GAIN = 3;

// Which steps are marked as showing, and whether the section is pinned to the window
const read = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-wwd]');
  const showing = [...root.querySelectorAll('.wwd__step')]
    .map((el, i) => (el.classList.contains('is-active') ? i : -1))
    .filter((i) => i >= 0);
  const top = root.querySelector('.wwd__sticky').getBoundingClientRect().top;
  return { showing, pinned: Math.abs(top) < 1 };
});

// Exactly this step is showing, and no other. Polls quickly, so that between two strokes the check does
// not itself give the scroll time to come to rest.
const expectStep = (page, step) =>
  expect.poll(async () => (await read(page)).showing, { intervals: [25], timeout: 3000 }).toEqual([step]);

// One stroke: a burst of wheel events in one direction. It returns while the page is still scrolling.
async function stroke(page, pixels) {
  const events = Math.ceil(Math.abs(pixels) / 40);
  for (let i = 0; i < events; i++) {
    await page.mouse.wheel(0, pixels / events);
    await page.waitForTimeout(16);
  }
}

// Long enough for the scroll to stop and for the section to register that it has
const rest = (page) => page.waitForTimeout(700);

test.beforeEach(async ({ page }) => {
  // The stepping needs nothing from the network: web fonts and the WebGL library are left out, so the
  // tests do not depend on other servers (without the library the section simply shows no sky)
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-wwd] .wwd__step.is-active'));
  await page.mouse.move(400, 400);
  // Arrive at the section the way the scroll cue does: its top at the top of the window
  await page.evaluate(() => scrollTo(0, document.querySelector('[data-wwd]').offsetTop));
  await rest(page);
});

test('arriving shows only the description, pinned', async ({ page }) => {
  await expectStep(page, DESCRIPTION);
  expect((await read(page)).pinned).toBe(true);
});

test('one stroke moves one step, whether it is short or very long', async ({ page }) => {
  await stroke(page, 60);
  await expectStep(page, CLIENTS);
  await rest(page);
  await expectStep(page, CLIENTS);

  await stroke(page, 1500);   // a fling several windows long
  await expectStep(page, PRODUCE);
  await rest(page);
  await expectStep(page, PRODUCE);

  await stroke(page, 120);
  await expectStep(page, GAIN);
  await rest(page);
  expect(await read(page)).toEqual({ showing: [GAIN], pinned: true });
});

test('scrolling up and down without pausing steps back and forth, one step per turn', async ({ page }) => {
  await stroke(page, 120);
  await rest(page);
  await expectStep(page, CLIENTS);

  await stroke(page, 300);
  await expectStep(page, PRODUCE);
  await stroke(page, -300);
  await expectStep(page, CLIENTS);
  await stroke(page, 300);
  await expectStep(page, PRODUCE);
  await stroke(page, 300);    // still the same downward stroke: no second step
  await expectStep(page, PRODUCE);
  await stroke(page, -300);
  await expectStep(page, CLIENTS);
  await stroke(page, -300);   // still the same upward stroke
  await expectStep(page, CLIENTS);

  await rest(page);
  expect(await read(page)).toEqual({ showing: [CLIENTS], pinned: true });
});

test('from the description: down, up past the top of the section, and down again', async ({ page }) => {
  await stroke(page, 200);
  await expectStep(page, CLIENTS);
  await stroke(page, -400);   // goes above the pinned stretch
  await expectStep(page, DESCRIPTION);
  await stroke(page, 300);
  await expectStep(page, CLIENTS);
  await rest(page);
  expect(await read(page)).toEqual({ showing: [CLIENTS], pinned: true });
});

test('after a burst of quick turns, the next stroke from rest still moves exactly one step', async ({ page }) => {
  for (const pixels of [250, -150, 400, -300, 200, 350, -120, 500]) await stroke(page, pixels);
  await rest(page);
  const { showing, pinned } = await read(page);
  expect(showing).toHaveLength(1);
  expect(pinned).toBe(true);

  const [step] = showing;
  if (step < GAIN) {
    await stroke(page, 100);
    await expectStep(page, step + 1);
    await rest(page);
    await expectStep(page, step + 1);
  }
  await stroke(page, -100);
  await expectStep(page, Math.min(step + 1, GAIN) - 1);
});

test('stepping back up through every step returns to the description', async ({ page }) => {
  for (const step of [CLIENTS, PRODUCE, GAIN]) {
    await stroke(page, 100);
    await expectStep(page, step);
    await rest(page);
  }
  for (const step of [PRODUCE, CLIENTS, DESCRIPTION]) {
    await stroke(page, -100);
    await expectStep(page, step);
    await rest(page);
  }
  expect((await read(page)).pinned).toBe(true);
});

test('one stroke down from the last point leaves for the next section', async ({ page }) => {
  for (const step of [CLIENTS, PRODUCE, GAIN]) {
    await stroke(page, 100);
    await expectStep(page, step);
    await rest(page);
  }
  await stroke(page, 450);
  await expect.poll(async () => (await read(page)).pinned, { timeout: 5000 }).toBe(false);
  // The next section ends up at the top of the window
  await expect
    .poll(() => page.evaluate(() => Math.round(document.querySelector('#products').getBoundingClientRect().top)), { timeout: 5000 })
    .toBe(0);
});
