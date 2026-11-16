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
  webServer: {
    command: 'npx serve . --listen 4321 --no-clipboard',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});
