import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` must match the GitHub Pages project path so built asset URLs resolve.
// Overridable for other hosts: BASE_PATH=/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/furina_cover_web_player/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
