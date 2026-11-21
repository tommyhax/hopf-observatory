import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  globalTimeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8772',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    // Keep the desktop layout, with 1/16 as many pixels for CPU-based WebGL.
    deviceScaleFactor: 0.25,
    video: 'off',
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'python3 -m http.server 8772 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8772',
    reuseExistingServer: false,
  },
});
