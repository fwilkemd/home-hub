import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// base is only needed for the GitHub Pages deploy; keep dev at /.
// HTTPS (for LAN testing on the headset) is opt-in via `npm run dev:host`.
export default defineConfig(({ command, mode }) => ({
  base: command === 'build' ? '/home-hub/' : '/',
  plugins: mode === 'https' ? [basicSsl()] : [],
  server: { port: 5173 },
}))
