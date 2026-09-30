import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from the /lanikai subpath on the SnappyCamille host (mirrors CRA "homepage").
// `base` rewrites every emitted asset URL to /lanikai/... ; runtime-loaded assets
// (audio/models/photos) must be prefixed with import.meta.env.BASE_URL.
export default defineConfig({
  plugins: [react()],
  base: '/lanikai/',
  build: {
    outDir: 'build',
    assetsInlineLimit: 0,
  },
});
