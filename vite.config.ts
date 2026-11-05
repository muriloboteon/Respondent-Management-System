import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Prototype variants: each folder under variants/ is its own page (variants/<id>/index.html) with
 * its own copy of the app (src/variants/<id>, or src/ for main). The build includes every one of
 * them, plus the root page, which only opens the first tab.
 */
const variantPages = Object.fromEntries(
  readdirSync(here('./variants'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [d.name, here(`./variants/${d.name}/index.html`)]),
)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Shared by every variant: the sample respondents, and the bar that switches variants.
      '@data': here('./src/data'),
      '@prototype': here('./src/prototype'),
    },
  },
  build: {
    // "root", not "main": the main variant's page is variants/main/index.html.
    rollupOptions: { input: { root: here('./index.html'), ...variantPages } },
  },
  server: {
    // The project lives in a OneDrive folder, where native file events can be missed and
    // the dev server keeps serving a stale module. Polling catches every change.
    watch: { usePolling: true, interval: 300 },
  },
})
