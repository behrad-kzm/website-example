// UI tests: `npm test`. They run the static site on a local port and drive it in headless Chromium.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    viewport: { width: 1440, height: 820 },
  },
  // Two groups. The motion tests (tests/scroll-smoothness.spec.js) measure frame-by-frame smoothness, which
  // is spoilt if anything else is using the machine's graphics at the same time: they run after everything
  // else has finished, one at a time.
  projects: [
    { name: 'ui', testIgnore: /scroll-smoothness\.spec\.js/ },
    { name: 'motion', testMatch: /scroll-smoothness\.spec\.js/, dependencies: ['ui'], fullyParallel: false, workers: 1 },
  ],
  webServer: {
    command: 'npx serve . --listen 4321 --no-clipboard',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});
