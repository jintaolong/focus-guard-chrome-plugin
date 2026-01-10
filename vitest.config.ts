import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'build/', 'tests/']
    }
  },
  resolve: {
    alias: {
      '~lib': path.resolve(__dirname, './lib'),
      '~components': path.resolve(__dirname, './components'),
      '~types': path.resolve(__dirname, './types'),
      '~popup': path.resolve(__dirname, './popup.tsx'),
    }
  }
})
