import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: process.env.APP_ORIGIN,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: 'node backend/src/index.js',
    url: process.env.APP_ORIGIN + '/api/health',
    reuseExistingServer: false,
  },
})
