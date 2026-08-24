import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The site is served from the root of its own host (furina-cover.lostjay.xyz),
// so assets resolve from `/`. For a GitHub Pages *project* path, which serves
// under /<repo>/, build with: BASE_PATH=/furina_cover_web_player/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
