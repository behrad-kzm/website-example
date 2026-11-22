// The page on small and medium screens: four phones, a tablet upright and a tablet on its side.
// What must hold at every size:
//   - the page is never wider than the window, at the top or anywhere down the page (a page that is wider
//     makes a phone zoom out, and the navbar and the text are cut at the right edge);
//   - nothing readable crosses the side edges of the window;
//   - the navbar and the hero's scroll cue are fully inside the first window;
//   - the sections that pin ("What we do", "How it works") choose the same layout on every load;
//   - a short swipe moves the page and it stays where the finger left it.
const { test, expect } = require('@playwright/test');

const SIZES = [
  ['small phone', 320, 568],
  ['phone', 360, 740],
  ['phone', 390, 844],
  ['large phone', 430, 932],
  ['tablet', 768, 1024],
  ['tablet on its side', 1024, 768],
];

const open = async (browser, width, height) => {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, baseURL: 'http://localhost:4321' });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(800);   // the pinned sections measure again when the fonts arrive
  return { context, page };
};

// Step down the page half a window at a time. At each stop: how wide the page is, and any readable text
// that crosses a side edge of the window.
const walk = (page) => page.evaluate(async () => {
  const width = document.documentElement.clientWidth, found = [];
  let widest = 0;
  const visible = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.1) return false;
    }
    return true;
  };
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((done) => setTimeout(done, 60));
    widest = Math.max(widest, document.documentElement.scrollWidth, innerWidth);
    for (const el of document.querySelectorAll('h1, h2, h3, p, li, a, small, dt, dd')) {
      if (el.children.length || !el.textContent.trim()) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > innerHeight) continue;
      if ((box.left < -1 || box.right > width + 1) && visible(el)) found.push(`"${el.textContent.trim().slice(0, 30)}" at ${Math.round(y)}`);
    }
  }
  scrollTo({ top: 0, behavior: 'instant' });
  return { width, widest, cut: [...new Set(found)] };
});

for (const [name, width, height] of SIZES) {
  test.describe(`${name} ${width}x${height}`, () => {
    test('the page is never wider than the window, and no text is cut at the sides', async ({ browser }) => {
      test.setTimeout(60000);
      const { context, page } = await open(browser, width, height);
      const result = await walk(page);
      expect(result.width).toBe(width);
      expect(result.widest).toBe(width);
      expect(result.cut).toEqual([]);
      await context.close();
    });

    test('the navbar and the scroll cue are inside the first window', async ({ browser }) => {
      const { context, page } = await open(browser, width, height);
      const boxes = await page.evaluate(() => ['.cz-nav', '.cz-nav .cz-btn', '[data-scroll-cue]', '.hero h1', '.hero__lead'].map((selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }));
      for (const box of boxes) {
        expect(box.left, box.selector).toBeGreaterThanOrEqual(0);
        expect(box.right, box.selector).toBeLessThanOrEqual(width);
        expect(box.top, box.selector).toBeGreaterThanOrEqual(0);
        expect(box.bottom, box.selector).toBeLessThanOrEqual(height);
      }
      await context.close();
    });

    test('the pinned sections choose the same layout on every load', async ({ browser }) => {
      const seen = [];
      for (let load = 0; load < 3; load++) {
        const { context, page } = await open(browser, width, height);
        seen.push(await page.evaluate(() => [
          document.querySelector('[data-wwd]').classList.contains('is-static') ? 'list' : 'pinned',
          document.querySelector('[data-how]').classList.contains('is-static') ? 'list' : 'pinned',
          document.documentElement.scrollHeight,
        ].join(' ')));
        await context.close();
      }
      expect(new Set(seen).size, seen.join(' | ')).toBe(1);
      // "What we do" pins wherever its text fits one window: every size here but the smallest phone
      expect(seen[0].startsWith('pinned')).toBe(height >= 700);
    });

    if (width < 1000) {
      test('a short swipe moves the page, and it stays where the finger left it', async ({ browser }) => {
        const { context, page } = await open(browser, width, height);
        const client = await context.newCDPSession(page);
        await client.send('Input.synthesizeScrollGesture', { x: width / 2, y: height * 0.6, yDistance: -150, speed: 1200, gestureSourceType: 'touch' });
        await page.waitForTimeout(1200);
        const y = await page.evaluate(() => scrollY);
        expect(y).toBeGreaterThan(100);
        await context.close();
      });
    }
  });
}
