import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.local/**',
        '**/prisma/**',
        '**/backend/**',
      ],
    },
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  test: {
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
