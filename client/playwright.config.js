import { defineConfig } from '@playwright/test';

const database = process.env.BRIGHTLOOP_BROWSER_DB;
if (!database || !/^mongodb:\/\/127\.0\.0\.1:\d+\/brightloop_browser_test$/.test(database)) {
  throw new Error('Set BRIGHTLOOP_BROWSER_DB to mongodb://127.0.0.1:<isolated port>/brightloop_browser_test. Browser tests replace only this disposable database.');
}

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:5179',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    launchOptions: process.env.BRIGHTLOOP_BROWSER_EXECUTABLE ? { executablePath: process.env.BRIGHTLOOP_BROWSER_EXECUTABLE } : {}
  },
  webServer: [
    { command: 'node ../index.js', url: 'http://127.0.0.1:5019/api/auth/me', reuseExistingServer: false, env: { MONGODB_URI: database, PORT: '5019', CLIENT_ORIGIN: 'http://127.0.0.1:5179', JWT_SECRET: 'brightloop-browser-test-secret-for-local-isolation', NODE_ENV: 'test' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5179 --strictPort', url: 'http://127.0.0.1:5179', reuseExistingServer: false, env: { VITE_API_URL: 'http://127.0.0.1:5019/api' } }
  ]
});
