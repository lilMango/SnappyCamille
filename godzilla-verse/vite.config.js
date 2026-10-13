import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from the /godzilla-verse subpath on the SnappyCamille host.
// `base` rewrites every emitted asset URL to /godzilla-verse/... and also the
// module-worker URLs created with `new Worker(new URL(...), import.meta.url)`.
// Runtime-loaded assets (audio etc.) must be prefixed with import.meta.env.BASE_URL.
export default defineConfig({
  plugins: [react()],
  base: '/godzilla-verse/',
  worker: { format: 'es' },
  build: {
    outDir: 'build',
    assetsInlineLimit: 0,
  },
});
