import { defineConfig } from 'vite';
import { resolve } from 'path';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Use relative paths - works for both web and Electron
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // Output for renderer (web app)
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Needed for Electron dev mode
    strictPort: true,
  },
})
