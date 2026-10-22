import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The project lives in a OneDrive folder, where native file events can be missed and
    // the dev server keeps serving a stale module. Polling catches every change.
    watch: { usePolling: true, interval: 300 },
  },
})
