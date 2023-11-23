import { defineConfig } from 'vite'
import { posts } from './scripts/vite-plugin-posts'

export default defineConfig({
  build: { assetsDir: 'i' },
  plugins: [posts()],
})
