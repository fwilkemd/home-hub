import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server is exposed on all interfaces so the kiosk tablet (and the
// preview screenshotter) can reach it from outside the container.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true },
})
