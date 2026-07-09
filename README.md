# ICU VR Simulator

A WebXR ICU training simulator for Meta Quest 2, running in the Meta Quest
Browser. This codebase is the **engine only** — all clinical content
(scenarios, drugs, deterioration logic) is authored separately as JSON under
`/content/`. The bundled demo scenario uses deliberately nonsensical
placeholder values.

**Status: Milestone 1** — room + live monitor. XR session with VR button,
desktop fallback, low-poly ICU bay, and a patient monitor rendering live
drifting vitals from the bundled demo scenario.

## Architecture

```
/src/sim     Pure simulation core. No three.js. Runs headless in Node.
/content     JSON data files, owned by the content author.
/src/app     Presentation: three.js scene, XR session, monitor, controls.
/src/cli     Headless tools (arrives in M3): validate, simulate, schema export.
```

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, sim core
npm run build    # typecheck + production build
```

The app runs flat on desktop when WebXR is unavailable: click to grab the
pointer, mouse to look, WASD to move. Everything is testable without a
headset.

## Getting builds into the headset

WebXR needs a secure context. Two options:

1. **adb reverse (preferred, needs Quest developer mode):**

   ```sh
   npm run dev
   adb reverse tcp:5173 tcp:5173
   ```

   Then open `http://localhost:5173` in the Quest Browser. Localhost counts
   as a secure context and hot reload works.

2. **LAN + HTTPS:**

   ```sh
   npm run dev:host
   ```

   Open `https://<pc-ip>:5173` in the Quest Browser and accept the
   self-signed-certificate warning.

## Deploy

GitHub Pages. `vite.config.ts` sets `base: '/home-hub/'` for production
builds, so the published URL serves the app over HTTPS and WebXR works
directly.

## Debug

Until the in-VR debug panel lands, fast-forward from the browser console:
`simTimeScale = 60`.
