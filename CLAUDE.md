# CatPet — Claude Code Architecture Reference

## What This Is

Desktop virtual pet: upload 1–6 cat photos → photorealistic puppet rig animates on a transparent Electron overlay. Every pixel on screen is real fur from the user's photos.

Full spec: `CatPet_Design_Doc.md`

---

## Offline-First Principle

**This app requires no API keys, no internet connection, and no cloud services for any core functionality.** Every AI/ML step runs locally:

- Background removal — `@imgly/background-removal` (ONNX WASM, runs in renderer)
- Body-part segmentation — local ONNX model (bundled in app)
- Photo analysis / orientation detection — local ONNX model

There is no Anthropic API integration, no Claude Vision, no remove.bg, no external endpoints of any kind. The app works offline from first launch.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | Electron 31 | Transparent click-through overlay, battle-tested |
| Renderer | React 18 + HTML5 Canvas (PixiJS in Session 4) | Canvas for pet, React for settings UI |
| Background removal | `@imgly/background-removal` (WASM) | Runs in renderer, no native module, fully offline |
| Segmentation | ONNX Runtime Web (WASM, local) | Body-part detection, model bundled (~15MB int8), offline |
| Build | Vite 5 + vite-plugin-electron | Fast HMR in dev; ONNX WASM bundled automatically |
| Types | TypeScript strict | Both main and renderer |
| State machine | XState v5 | Pet FSM — walk/idle/sleep/play/startled/groom |
| Package manager | pnpm | Required — do not use npm/yarn |
| Distribution | electron-builder `dir` target → portable zip | Zero-install, no registry, portable |

---

## Project Layout

```
electron/
  main.ts       — BrowserWindow config, IPC handlers, first-launch detection
  preload.ts    — contextBridge: exposes window.catpet.* (see IPC Surface below)
  tray.ts       — Tray icon, Settings + Quit menu items

src/
  main.tsx      — React entry point
  electron.d.ts — Global window.catpet type declaration
  ui/
    App.tsx         — Route: ?view=settings → Upload wizard, default → PetView
    PetView.tsx     — Canvas overlay, static cat sprite, breathing bob, hit detection
    Upload.tsx      — 6-slot guided upload wizard + background removal + quality meter
    QualityMeter.tsx — 1–6 photo count with color-coded quality label
  processing/
    background-removal.ts  — @imgly/background-removal (WASM) wrapper with progress cb
    photo-validator.ts     — Size / brightness / sharpness checks (Canvas API)
  core/         — (Session 5) XState FSM, physics, scheduler
  sprites/      — (Session 4) Puppet rig, pose library, animator
  renderer/     — (Session 4) requestAnimationFrame loop, scene graph
  utils/
    config.ts   — SlotRole, SlotDefinition, CatConfig, ValidationResult types + SLOTS array
    storage.ts  — (future) renderer-side storage helpers

assets/
  rigs/         — JSON keyframes for each pet state (idle, walk, sleep…)
  masks/        — Fallback segmentation templates for generic cat shapes
  guide/        — Silhouette overlays + good/bad photo examples for onboarding

build/          — electron-builder resources (icon.ico, icon.png)
scripts/        — package-portable.ts (post-build zip script)
```

---

## Key Architecture Decisions

### Transparent Click-Through Overlay

```typescript
// electron/main.ts
win = new BrowserWindow({ transparent: true, frame: false, alwaysOnTop: true,
                          skipTaskbar: true, focusable: false, show: false, ... })
win.setIgnoreMouseEvents(true, { forward: true })  // default: fully click-through

// Renderer toggles on cat hover via IPC:
ipcMain.on('cat-hover', (_, isHovering) =>
  win.setIgnoreMouseEvents(!isHovering, { forward: true }))

// Overlay starts hidden; shown after cat:ready IPC (first upload completes)
ipcMain.on('cat:ready', () => { overlayWin.show(); settingsWin.close() })
```

### Portable Data Path

```typescript
const PORTABLE_DATA = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'userdata')
  : path.join(app.getPath('userData'), 'catpet-dev')
app.setPath('userData', PORTABLE_DATA)
```

Everything lives next to `CatPet.exe`. Copy folder to USB = works on any PC.

### Background Removal (WASM, no native module)

`@imgly/background-removal` runs entirely in the Electron renderer process using ONNX WebAssembly. Vite bundles the WASM file (~24MB) automatically into `dist/assets/`. No `extraResources`, no DLLs, no `electron-rebuild`.

```typescript
// src/processing/background-removal.ts
import { removeBackground } from '@imgly/background-removal'
const blob = await removeBackground(inputBlob, { model: 'isnet_quint8' })
```

### Photorealistic Puppet Animation (Sessions 3–4)

The cat photo is segmented into 5 layers (head, torso, front-legs, rear-legs, tail) using a local ONNX model — no API call. Each layer is an independent `ImageData` with feathered alpha. Animation = rotating/translating photo segments at natural joints. All pixels on screen come from the user's actual photo.

---

## Session Roadmap

| Session | Goal | Status |
|---------|------|--------|
| 1 | Electron scaffold + transparent overlay + system tray | **Done** |
| 2 | Multi-photo upload wizard + background removal + static overlay | **Done** |
| 3 | Body segmentation — local ONNX model → generic mask fallback | Pending |
| 4 | Puppet rig + PixiJS + idle breathing animation | Pending |
| 5 | XState FSM + full pose library + interpolation | Pending |
| 6 | Mouse interaction + screen-edge detection + multi-photo routing | Pending |
| 7 | Particle overlays + sound + settings panel + personality system | Pending |
| 8 | First-launch onboarding wizard with photo guide | Pending |
| 9 | Portable zip packaging + clean-machine verification | Pending |

---

## Development

```bash
pnpm install
pnpm electron:dev    # Vite HMR + Electron together
```

## Build

```bash
pnpm build           # Vite + electron-builder → dist/win-unpacked/
pnpm package:zip     # → dist/CatPet-x.x.x-win-x64.zip
```

---

## IPC Surface

### renderer → main (ipcRenderer.send / invoke)

| Channel | Type | Payload | Purpose |
|---------|------|---------|---------|
| `cat-hover` | send | `boolean` | Toggle overlay click-through on cat hover |
| `open-settings` | send | — | Open settings BrowserWindow |
| `cat:ready` | send | — | Cat configured; show overlay, close settings |
| `dialog:open-file` | invoke | → `string \| null` | Open system file picker, return path |
| `file:read` | invoke | `path` → `base64 dataUrl` | Read image file from disk |
| `photo:save` | invoke | `(slot, dataUrl)` | Write bg-removed PNG to `userdata/photos/{slot}.png` |
| `photo:load-all` | invoke | → `Record<slot, dataUrl>` | Load all saved slot PNGs as base64 |
| `photo:delete` | invoke | `slot` | Delete a saved photo from disk |
| `store:get` | invoke | `key` → `unknown` | Read from electron-store |
| `store:set` | invoke | `(key, value)` | Write to electron-store |
| `app:is-first-launch` | invoke | → `boolean` | Check if `cat.json` exists |

### main → renderer (webContents.send)

| Channel | Purpose |
|---------|---------|
| `cat:loaded` | Tells overlay to reload cat photos (fired after `cat:ready`) |

### Exposed as `window.catpet` (preload contextBridge)

All of the above, plus `onCatLoaded(cb)` which returns an unsubscribe function.

---

## Rules

- **pnpm only** — no npm/yarn
- **No installer** — distribution is portable zip, `dir` target only
- **No cartoons** — animation is photo segments on joints, never drawn shapes
- **Fully offline** — no API keys, no network calls, no cloud services for any feature
- **No API keys** — never add Anthropic API, OpenAI, remove.bg, or any external service
- **userdata next to exe** — never write to `%APPDATA%` in packaged builds
- Electron main process: CommonJS (`tsconfig.electron.json`)
- React renderer: ESNext modules (`tsconfig.json`)
- ONNX runs in renderer via WASM — never use `onnxruntime-node` (native) in main process
