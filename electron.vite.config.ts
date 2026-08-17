import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))
const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: at('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: at('src/preload/index.ts') },
        // A sandboxed preload must be CommonJS; the package is type: module, so
        // the file has to carry the .cjs extension to be read that way.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: at('src/renderer'),
    plugins: [react()],
    // The About page reads the licence straight out of the repo's LICENSE file,
    // which sits above the renderer root.
    server: { fs: { allow: [root] } },
    resolve: {
      alias: {
        '@shared': at('src/shared'),
        '@renderer': at('src/renderer')
      }
    },
    build: {
      // electron-vite leaves this off; the renderer is the shipped artefact and
      // the package size ends up on the README badge.
      minify: 'esbuild',
      rollupOptions: {
        input: { index: at('src/renderer/index.html') }
      }
    }
  }
})
