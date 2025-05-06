import { defineConfig } from 'vite'
import { checker } from 'vite-plugin-checker'
import dts from 'vite-plugin-dts'
import { externalizeDeps as external } from 'vite-plugin-externalize-deps'

/**
 * vite config
 * @see https://vitejs.dev/
 */
export default defineConfig({
  appType: 'custom',
  plugins: [external(), checker({}), dts()],
  esbuild: {
    minifyIdentifiers: false,
  },
  build: {
    minify: false,
    copyPublicDir: false,
    lib: {
      entry: ['src/index.ts'],
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
        // See https://github.com/vitejs/vite/issues/5174
        preserveModules: true,
      },
    },
  },
})
