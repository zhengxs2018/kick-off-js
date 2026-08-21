import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * vite config
 * @see https://vitejs.dev/
 */
export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'ui/src'),
    },
  },
  server: {
    port: 5173,
  },
});
