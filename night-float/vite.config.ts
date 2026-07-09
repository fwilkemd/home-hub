import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  css: {
    // Inline (empty) PostCSS config: Night Float uses none, and this stops
    // Vite's upward config search from escaping the subproject and finding
    // the unrelated Home Hub app's Tailwind postcss.config.js at the repo
    // root (which breaks fresh clones that only installed night-float).
    postcss: {},
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
