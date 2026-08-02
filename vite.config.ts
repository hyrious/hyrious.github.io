import { defineConfig } from 'vite'
import { posts } from './scripts/vite-plugin-posts.ts'

export default defineConfig({
  build: { assetsDir: 'i' },
  plugins: [posts()],
})
