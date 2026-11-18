// How smoothly the page moves through the Star Track takeover (assets/star-track.js), and what happens
// when the visitor interferes with it: scrolls the other way while it is playing, turns around several
// times, scrolls slowly, scrolls on after it has landed.
//
// Each test drives the page with wheel events shaped like a trackpad's (a flick is a burst that starts
// strong and dies away over about a second) and records every frame: the time, how far the page has
// scrolled past the top of Products, the state of the takeover, and how far the Star Track pane has grown
// (0 = the card, 1 = the whole window). From the recording it measures:
//   - jolts: the largest change of speed between one frame and the next, for the page's scroll and for
//     the pane. A smooth motion changes speed gradually; a jolt is what the eye reads as "not smooth";
//   - steps against the direction the motion is heading (only where the visitor did not turn it around);
//   - where it came to rest, and whether it then stayed there.
// The recording and the measurements are attached to the test report as "scroll trace".
const { test, expect } = require('@playwright/test');

// Motion is only worth measuring with real graphics: without a GPU the browser draws this page a few
// frames a second, and the measurement would be of the test machine. So this file asks for the GPU.
test.use({ launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])] } });
test.setTimeout(90000);
// These tests run on their own, after the others (playwright.config.js). Even so the graphics can stall
// for a frame now and then; a run spoilt that way is tried again.
test.describe.configure({ retries: 2 });

// Limits. The takeover's motion is a spring with a time constant of 0.26s. Starting from rest, a spring's
// speed changes fastest at the very start, by 59 px/s each second for every pixel it has to travel; the
// page travels the height of Products (about two windows). The pane's speed changes by at most about 100
// window-fills/s each second, when it is turned around at full speed. The limits sit a quarter above
// that, so they pass a spring and fail a jump, a stutter or a tug-of-war with the visitor's momentum.
const SCROLL_JOLT_PER_PIXEL = 75;   // px/s per second, for each pixel of travel
let travel = 0;                     // the height of Products, set by startAt
const MAX_PANE_JOLT = 140;        // (fraction of the way open)/s per second
const MAX_BACKWARDS = 4;          // px: on the frame where the page's own motion takes over from the flick
const MAX_DRIFT = 2;              // px: movement after it has come to rest

const load = async (page) => {
  await page.goto('/');
  await page.waitForSelector('.world[data-star]');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.mouse.move(700, 400);
};
// Wait until the browser is drawing frames steadily (30 in a row on time). A visitor reaches Products
// after reading the top of the page, long after loading has finished; a measurement should start the same way.
const steady = (page) => page.evaluate(() => new Promise((resolve) => {
  const started = performance.now();
  let last = started, good = 0;
  const tick = (now) => {
    good = now - last < 25 ? good + 1 : 0;
    last = now;
    if (good >= 30 || now - started > 6000) resolve(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
const atRest = (page) => page.waitForFunction(() => /^(open|closed)$/.test(document.querySelector('.world').dataset.star), null, { timeout: 15000 });
const pause = (page, ms) => page.waitForTimeout(ms);

// Put the page where the progress bar around Star Track is nearly full (120px of scroll short of it), so
// the next scroll down starts the takeover, and let it settle. Returns the height of Products: scrolled
// that far, the next section is at the top of the window.
const startAt = async (page) => {
  const height = await page.evaluate(() => {
    const section = document.querySelector('#products');
    scrollTo(0, section.getBoundingClientRect().top + scrollY + innerHeight - 120);   // the bar takes one window of scroll
    return section.offsetHeight;
  });
  travel = height;
  await pause(page, 500);
  await atRest(page);
  await steady(page);
  return height;
};

const startRecording = (page) => page.evaluate(() => {
  window.__trace = []; window.__recording = true;
  const world = document.querySelector('.world'), pane = document.querySelector('.st-glass');
  const card = document.querySelector('[data-product="star-track"]');
  const base = document.querySelector('#products').getBoundingClientRect().top + scrollY;
  const tick = (now) => {
    if (!window.__recording) return;
    const from = card.getBoundingClientRect().width, full = document.documentElement.clientWidth;
    const grown = (pane.getBoundingClientRect().width - from) / (full - from);
    window.__trace.push([Math.round(now * 10) / 10, Math.round((scrollY - base) * 10) / 10, world.dataset.star, Math.round(grown * 10000) / 10000]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const stopRecording = (page) => page.evaluate(() => { window.__recording = false; return window.__trace; });
const grown = (page) => page.evaluate(() => {
  const from = document.querySelector('[data-product="star-track"]').getBoundingClientRect().width;
  return (document.querySelector('.st-glass').getBoundingClientRect().width - from) / (document.documentElement.clientWidth - from);
});

// A flick: wheel events that start strong and die away. With `until`, it is cut short (as when the
// visitor puts their fingers back down) once the pane has grown, or shrunk, to that point.
const flick = async (page, direction, until) => {
  for (let delta = 60; delta > 0.8; delta *= 0.9) {
    await page.mouse.wheel(0, direction * delta);
    if (until !== undefined) {
      const g = await grown(page);
      if (direction > 0 ? g >= until : g <= until) return;
    }
  }
};
// Keep sending the same flick until the takeover reacts (a tick can be lost to the page's magnetic sections)
const flickUntilMoving = async (page, direction, until) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    await flick(page, direction, until);
    const state = await page.evaluate(() => document.querySelector('.world').dataset.star);
    if (/ing$/.test(state) || state === (direction > 0 ? 'open' : 'closed')) return;
    await pause(page, 300);
  }
};
// A slow, even scroll: small equal steps, like dragging two fingers steadily
const drag = async (page, direction, steps, size = 12) => {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, direction * size); await pause(page, 8); }
};

// Measure a recording. Only the part where the takeover is playing counts, plus the second after it rests.
const measure = (trace) => {
  const first = trace.findIndex((row) => /ing$/.test(row[2]));
  if (first < 0) return { played: false, states: [...new Set(trace.map((row) => row[2]))].join(' > ') };
  let last = trace.length - 1;
  while (last > first && !/ing$/.test(trace[last][2])) last--;
  const rest = trace.slice(last + 1).filter((row) => row[0] - trace[last][0] <= 1000);
  const landed = rest.length ? rest[0][1] : NaN;

  // Speeds between frames, then the change of speed between neighbouring pairs of frames. Frames that
  // arrived late (the browser stalled) are left out: a stall is not the motion's doing.
  let scrollJolt = 0, paneJolt = 0, largestStep = 0, longestFrame = 0, backwards = 0, turns = 0, worst = first;
  let previous = null;
  for (let i = first + 1; i <= last; i++) {
    const dt = (trace[i][0] - trace[i - 1][0]) / 1000;
    longestFrame = Math.max(longestFrame, Math.round(dt * 1000));
    if (trace[i][2] !== trace[i - 1][2]) turns++;
    if (dt <= 0 || dt > 0.03) { previous = null; continue; }
    const speed = { scroll: (trace[i][1] - trace[i - 1][1]) / dt, pane: (trace[i][3] - trace[i - 1][3]) / dt, dt };
    largestStep = Math.max(largestStep, Math.abs(trace[i][1] - trace[i - 1][1]));
    // Against the way it is heading, on frames where the visitor has not just turned it around
    const heading = trace[i][2] === 'opening' ? 1 : -1;
    if (i - first <= 3 && (trace[i][1] - trace[i - 1][1]) * heading < 0) backwards += Math.abs(trace[i][1] - trace[i - 1][1]);
    if (previous && i - first > 2) {   // the first two frames are the hand-over from the browser's own scrolling
      const span = (speed.dt + previous.dt) / 2;
      const jolt = Math.abs(speed.scroll - previous.scroll) / span;
      if (jolt > scrollJolt) { scrollJolt = jolt; worst = i; }
      paneJolt = Math.max(paneJolt, Math.abs(speed.pane - previous.pane) / span);
    }
    previous = speed;
  }
  return {
    played: true,
    states: trace.map((row) => row[2]).filter((state, i, all) => i === 0 || state !== all[i - 1]).join(' > '),
    frames: last - first + 1, milliseconds: Math.round(trace[last][0] - trace[first][0]), longestFrame,
    scrollJolt: Math.round(scrollJolt), paneJolt: Math.round(paneJolt * 10) / 10,
    largestStep: Math.round(largestStep), backwardsAtStart: Math.round(backwards),
    landedAt: landed, endedAt: trace[trace.length - 1][1], endState: trace[trace.length - 1][2],
    drift: rest.length ? Math.max(...rest.map((row) => Math.abs(row[1] - landed))) : NaN,
    // The frames around the largest scroll jolt: [ms since the frame before, position, state]
    aroundWorst: trace.slice(Math.max(1, worst - 4), worst + 4).map((row, k, part) => [k ? Math.round((row[0] - part[k - 1][0]) * 10) / 10 : 0, row[1], row[2]]),
  };
};

// Record while `gesture` runs, wait for the takeover to rest and a moment more, then measure
const run = async (page, info, name, gesture) => {
  await startRecording(page);
  await gesture();
  await pause(page, 150);
  await atRest(page);
  await pause(page, 1200);
  const trace = await stopRecording(page);
  const result = measure(trace);
  await info.attach(`scroll trace: ${name}`, { body: JSON.stringify({ result, trace }), contentType: 'application/json' });
  console.log(`${name}: ${JSON.stringify(result)}`);
  return result;
};
const expectSmooth = (result, name) => {
  expect(result.played, `${name}: the takeover played`).toBe(true);
  expect(result.scrollJolt, `${name}: largest change of scroll speed (px/s per second)`).toBeLessThanOrEqual(SCROLL_JOLT_PER_PIXEL * travel);
  expect(result.paneJolt, `${name}: largest change of the pane's speed (per second per second)`).toBeLessThanOrEqual(MAX_PANE_JOLT);
  expect(result.backwardsAtStart, `${name}: pixels moved against the motion as it started`).toBeLessThanOrEqual(MAX_BACKWARDS);
  expect(result.drift, `${name}: pixels of movement after coming to rest`).toBeLessThanOrEqual(MAX_DRIFT);
};
const expectLanded = (result, name, state, at) => {
  expect(result.endState, `${name}: final state`).toBe(state);
  expect(Math.abs(result.landedAt - at), `${name}: pixels from where it should land`).toBeLessThanOrEqual(1);
};

test('a flick down opens it and a flick up closes it, each in one smooth motion', async ({ page }, info) => {
  await load(page);
  const height = await startAt(page);
  const down = await run(page, info, 'flick down', () => flickUntilMoving(page, 1));
  expectSmooth(down, 'flick down');
  expectLanded(down, 'flick down', 'open', height);
  expect(down.states).toBe('closed > opening > open');

  await pause(page, 400);
  const up = await run(page, info, 'flick up', () => flickUntilMoving(page, -1));
  expectSmooth(up, 'flick up');
  expectLanded(up, 'flick up', 'closed', 0);
  expect(up.states).toBe('open > closing > closed');
});

for (const point of [0.15, 0.5, 0.9]) {
  test(`scrolling up while it is opening (${point * 100}% open) turns it around smoothly`, async ({ page }, info) => {
    await load(page);
    await startAt(page);
    const name = `turn back at ${point * 100}% open`;
    const result = await run(page, info, name, async () => {
      await flickUntilMoving(page, 1, point);   // opening, cut short part of the way
      await flick(page, -1);                    // and straight into a flick the other way
    });
    expectSmooth(result, name);
    expectLanded(result, name, 'closed', 0);
    expect(result.states, 'it never finished opening').toBe('closed > opening > closing > closed');
  });

  test(`scrolling down while it is closing (${point * 100}% open) turns it around smoothly`, async ({ page }, info) => {
    await load(page);
    const height = await startAt(page);
    await flickUntilMoving(page, 1);            // open it first
    await atRest(page);
    await pause(page, 800);
    const name = `turn forward at ${point * 100}% open`;
    const result = await run(page, info, name, async () => {
      await flickUntilMoving(page, -1, point);  // closing, cut short part of the way
      await flick(page, 1);
    });
    expectSmooth(result, name);
    expectLanded(result, name, 'open', height);
    expect(result.states, 'it never finished closing').toBe('open > closing > opening > open');
  });
}

test('turning around four times in a row stays smooth and ends where the last scroll pointed', async ({ page }, info) => {
  await load(page);
  await startAt(page);
  const name = 'four turns';
  const result = await run(page, info, name, async () => {
    await flickUntilMoving(page, 1, 0.4);
    await flick(page, -1, 0.2);
    await flick(page, 1, 0.7);
    await flick(page, -1, 0.5);
    await flick(page, 1);
  });
  expectSmooth(result, name);
  expectLanded(result, name, 'open', await page.evaluate(() => document.querySelector('#products').offsetHeight));
  expect(result.states).toBe('closed > opening > closing > opening > closing > opening > open');
});

test('a slow, steady scroll down and back up plays it just as smoothly', async ({ page }, info) => {
  await load(page);
  const height = await startAt(page);
  const down = await run(page, info, 'slow scroll down', () => drag(page, 1, 45));
  expectSmooth(down, 'slow scroll down');
  expectLanded(down, 'slow scroll down', 'open', height);

  await pause(page, 400);
  const up = await run(page, info, 'slow scroll up', () => drag(page, -1, 45));
  expectSmooth(up, 'slow scroll up');
  expectLanded(up, 'slow scroll up', 'closed', 0);
});

test('a flick up the instant it has landed open closes it again', async ({ page }, info) => {
  await load(page);
  await startAt(page);
  await flickUntilMoving(page, 1);
  await atRest(page);                           // landed: the leftover momentum is still being held
  const name = 'flick up on landing';
  const result = await run(page, info, name, () => flickUntilMoving(page, -1));
  expectSmooth(result, name);
  expectLanded(result, name, 'closed', 0);
});

test('scrolling on after it has landed is not held back', async ({ page }) => {
  await load(page);
  const height = await startAt(page);
  await flickUntilMoving(page, 1);
  await atRest(page);
  await pause(page, 500);                       // the visitor reads the title, then scrolls on
  // A firm scroll, not a nudge: the page's magnetic sections pull a small scroll back to the section's
  // top, here as at every other section, and that is not what this test is about
  await page.mouse.wheel(0, 500);
  await page.mouse.wheel(0, 500);
  await pause(page, 600);
  const position = await page.evaluate(() => -document.querySelector('#products').getBoundingClientRect().top);
  expect(position, 'pixels scrolled past the top of Products').toBeGreaterThan(height + 150);
  expect(await page.evaluate(() => document.querySelector('.world').dataset.star)).toBe('open');
});

test('the keyboard opens it, and a key the other way while it plays turns it around', async ({ page }, info) => {
  await load(page);
  await startAt(page);
  const name = 'keyboard';
  const result = await run(page, info, name, async () => {
    for (let i = 0; i < 8; i++) {               // arrow down until it starts
      await page.keyboard.press('ArrowDown');
      await pause(page, 60);
      if (/ing$/.test(await page.evaluate(() => document.querySelector('.world').dataset.star))) break;
    }
    await pause(page, 250);
    await page.keyboard.press('ArrowUp');       // change of mind, mid-way
  });
  expect(result.played).toBe(true);
  expect(result.paneJolt).toBeLessThanOrEqual(MAX_PANE_JOLT);
  expectLanded(result, name, 'closed', 0);
});
