import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~~': rootDir,
      '@@': rootDir,
      '~': path.resolve(rootDir, 'app'),
      '@': path.resolve(rootDir, 'app'),
      '#shared': path.resolve(rootDir, 'shared'),
      '#server': path.resolve(rootDir, 'server'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
