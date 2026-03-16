import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Dev: base '/' so public files serve from root (/sprites/...)
  // Build: base '/bday33' so deployed paths are correct (/bday33/sprites/...)
  base: command === 'build' ? '/bday33/' : '/',
  server: {
    port: 1337,
  },
}))
