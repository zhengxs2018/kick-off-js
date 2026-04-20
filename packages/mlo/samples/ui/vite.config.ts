import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * vite config
 * @see https://vitejs.dev/
 */
export default defineConfig({
  mode: 'production',
  root: __dirname,
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@zhengxs/mlo': resolve(__dirname, '../../src/index.js'),
    },
  },
  server: {
    port: 5173,
  },
})
