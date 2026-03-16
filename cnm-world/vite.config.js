import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Dev: base '/' so public files serve from root (/sprites/...)
  // Build: base '/cnm-world/' so deployed paths are correct (/cnm-world/sprites/...)
  base: command === 'build' ? '/cnm-world/' : '/',
  server: {
    port: 1338,
  },
}))
