import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages the app is served from /home-hub/; locally it's served from /.
// The Pages deploy workflow sets GH_PAGES=true so asset URLs resolve correctly.
const base = process.env.GH_PAGES ? '/home-hub/' : '/'

// Dev server is exposed on all interfaces so the kiosk tablet (and the
// preview screenshotter) can reach it from outside the container.
export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true },
})
