// The hero planet on a phone appears within 2 seconds of the page being opened, also on a slow phone.
// The planet comes in two steps (index.html, assets/planet-still.js, assets/planet.js): a pre-rendered still
// at once on every device, then, with a graphics chip, the live planet fading in over it.
// "Appears" is the moment the first of the two canvases gets the class is-ready: its first frame is drawn
// and it starts to fade in. Times count from the start of navigation (performance.now() is 0 there).
const { test, expect, devices } = require('@playwright/test');

const LIMIT_MS = 2000;
const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
const PHONE = { ...pixel, baseURL: 'http://localhost:4321' };
test.use(PHONE);
// A mid-range phone on a slow mobile network: Lighthouse's mobile throttling
const SLOW = { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, cpu: 4 };
const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];

// Note when each canvas gets is-ready, watching from before any of the page's scripts run
const watchPlanet = (page) => page.addInitScript(() => {
  const times = window.__planet = { still: null, live: null };
  const watch = (canvas, key) => {
    const check = () => { if (times[key] === null && canvas.classList.contains('is-ready')) times[key] = performance.now(); };
    new MutationObserver(check).observe(canvas, { attributes: true, attributeFilter: ['class'] });
    check();
  };
  const seen = new Set();
  const found = new MutationObserver(() => {
    for (const [selector, key] of [['[data-planet-still]', 'still'], ['[data-planet]', 'live']]) {
      const canvas = document.querySelector(selector);
      if (canvas && !seen.has(key)) { seen.add(key); watch(canvas, key); }
    }
    if (seen.size === 2) found.disconnect();
  });
  found.observe(document, { childList: true, subtree: true });
});

const firstShown = (times) => Math.min(...[times.still, times.live].filter((t) => t !== null));

const openAndTime = async (page) => {
  await page.goto('/');
  // A little past the limit, so a late planet is reported with its real time rather than a timeout
  await page.waitForFunction(() => window.__planet.still !== null || window.__planet.live !== null, null, { timeout: LIMIT_MS + 5000 }).catch(() => {});
  return page.evaluate(() => window.__planet);
};

const report = (times) => {
  const ms = (t) => (t === null ? 'not yet' : `${Math.round(t)} ms`);
  test.info().annotations.push({ type: 'planet', description: `still ${ms(times.still)}, live ${ms(times.live)}` });
};

test.describe('on a phone', () => {
  test('the planet appears in under 2 seconds', async ({ page }) => {
    await watchPlanet(page);
    const times = await openAndTime(page);
    report(times);
    expect(times.still ?? times.live, 'the planet never appeared').not.toBeNull();
    expect(firstShown(times)).toBeLessThan(LIMIT_MS);
    // And it really is fading in
    await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector('.planet-still, .planet')).opacity))).toBeGreaterThan(0);
  });

  test('on a slow phone and a slow network the planet still appears in under 2 seconds', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: SLOW.latency, downloadThroughput: SLOW.download, uploadThroughput: SLOW.upload });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW.cpu });
    await watchPlanet(page);
    const times = await openAndTime(page);
    report(times);
    expect(times.still ?? times.live, 'the planet never appeared').not.toBeNull();
    expect(firstShown(times)).toBeLessThan(LIMIT_MS);
  });
});

// With a graphics chip the live planet takes over: it fades in over the still, and the still is then put away
test('with a graphics chip the live planet replaces the still', async ({ playwright }) => {
  test.setTimeout(60000);
  const browser = await playwright.chromium.launch({ args: GPU_ARGS });
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await watchPlanet(page);
  await page.goto('/');
  const gpu = await page.evaluate(() => import('/assets/gpu.js').then((m) => m.hasGPU));
  test.skip(!gpu, 'no graphics chip in this browser: only the still is shown');

  await page.waitForFunction(() => window.__planet.live !== null, null, { timeout: 20000 });
  const times = await page.evaluate(() => window.__planet);
  report(times);
  expect(times.still, 'the still came first').not.toBeNull();
  expect(times.still).toBeLessThan(times.live);
  await expect(page.locator('[data-planet-still]')).toHaveCount(0, { timeout: 5000 });
  await expect.poll(() => page.locator('[data-planet]').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  await browser.close();
});
