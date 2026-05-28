# CatPet — Claude Code Architecture Reference

## What This Is

Desktop virtual pet: upload 1–6 cat photos → photorealistic puppet rig animates on a transparent Electron overlay. Every pixel on screen is real fur from the user's photos.

Full spec: `CatPet_Design_Doc.md`

---

## Offline-First Principle

**This app requires no API keys, no internet connection, and no cloud services for any core functionality.** Every AI/ML step runs locally:

- Background removal — `@imgly/background-removal` (ONNX WASM, runs in renderer)
- Body-part segmentation — geometric silhouette analysis (bounding box + topmost-pixel head detection + percentage-based region masks with smoothstep feathering)

There is no Anthropic API integration, no Claude Vision, no remove.bg, no external endpoints of any kind. The app works offline from first launch.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | Electron 31 | Transparent click-through overlay, battle-tested |
| Renderer | React 18 + PixiJS v8 | PixiJS for pet canvas; React for settings UI |
| Background removal | `@imgly/background-removal` (WASM) | Runs in renderer, no native module, fully offline |
| Segmentation | Geometric silhouette analysis (Canvas API) | Bounding box + percentage region masks, no model needed |
| Animation | PixiJS v8 `Application` + `Ticker` | Sprite layers on Container, WebGL, ~60 fps |
| State machine | XState v5 (`setup()` + `createActor`) | Pet FSM — idle/walk/sleep/play/groom/startled |
| Build | Vite 5 + vite-plugin-electron | Fast HMR in dev; ONNX WASM bundled automatically |
| Types | TypeScript strict | Both main and renderer |
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
    App.tsx             — Route: ?view=onboarding | settings | preferences | default overlay
    PetView.tsx         — PixiJS overlay; PuppetRig + FSM actor; particles; sound; multi-photo routing
    OnboardingWizard.tsx — 4-step first-launch wizard (welcome → primary → optional → launch)
    CatGuide.tsx        — Canvas-drawn cat silhouettes for each photo slot (6 drawings)
    Upload.tsx          — 6-slot photo management grid (returning users via tray)
    QualityMeter.tsx    — 1–6 photo count with color-coded quality label
    Preferences.tsx     — Personality picker + sound + cat-size settings panel
  processing/
    background-removal.ts  — @imgly/background-removal (WASM) wrapper with progress cb
    photo-validator.ts     — Size / brightness / sharpness checks (Canvas API)
    silhouette-analyzer.ts — Bounding box + head-side detection from ImageData
    layer-extractor.ts     — Smoothstep feathered rectangular mask → PNG data URL
    body-segmenter.ts      — Orchestrates segmentation pipeline → SegmentationResult
  core/
    PetFSM.ts   — XState v5 machine (idle/walk/sleep/groom/play/startled)
    poses.ts    — Per-state LayerPose targets (rotation, yOffset, alpha, breathAmp)
  sprites/
    PuppetRig.ts — PixiJS puppet: 5 layer sprites, lerp pose interpolation, walk flip
  utils/
    config.ts   — All shared types: SlotRole, CatConfig, LayerId, RigDefinition, etc.

assets/
  rigs/         — (future) JSON keyframes for additional pet states
  masks/        — (future) fallback segmentation templates
  guide/        — (future) silhouette overlays for onboarding

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

### Body Segmentation (Geometric, No Model)

The bg-removed primary photo is split into 5 layers using pure Canvas API geometry:

1. `silhouette-analyzer.ts` — scans pixels to find bounding box; detects head side by comparing the topmost pixel in the left 35% vs right 35% of the bbox (ears are highest in a side-view cat).
2. `layer-extractor.ts` — applies a smoothstep (`t²(3−2t)`) feathered rectangular mask to isolate each region.
3. `body-segmenter.ts` — defines 5 percentage-based region rects (head: front 27%, torso: middle upper 65%, front/rear legs: lower 65%, tail: rear 27%), calls `extractLayer` for each with `feather=15`, and computes joint pivot points.

Saved to `userdata/segments/primary/{id}.png` + `userdata/rig/primary.json`.

### PixiJS Puppet Rig

`PuppetRig` (src/sprites/PuppetRig.ts):
- A single `catGroup: Container` is positioned at the cat's bottom-center on screen.
- Each layer sprite's `pivot` is set to its joint anchor in image coordinates; `position` is placed in catGroup local space so the anchor appears at the correct screen point.
- `catGroup.scale.x = -1` flips the whole cat for directional walking (PixiJS handles all transform math automatically — no per-layer sign corrections needed).
- `tick(deltaMs)` runs per-frame: lerps `curPose → targetPose` at `LERP_SPEED=3.5/s`, overlays breathing sinusoid (amp + period from active `PoseConfig`), adds walk-cycle leg swing when walking.

### XState FSM

```
idle → (7–16 s) → choosingAction → walking (40%) | playing (30%) | sleeping (35%) | grooming (45%) | idle
Any state + STARTLE → startled → (0.7 s) → idle
walking + ARRIVED   → idle
```

`setup()` is used to define named delays with random functions:
```typescript
delays: { IDLE_TIMEOUT: () => 7000 + Math.random() * 9000, ... }
```

FSM actor is created in `PetView` with `createActor(petMachine, { input: { screenW } })`. The ticker reads `actor.getSnapshot()` each frame and syncs to `PuppetRig`.

### Multi-Photo Routing

| FSM state | Display |
|-----------|---------|
| `idle`, `walking`, `grooming`, `startled` | PuppetRig (segmented layers) |
| `sleeping` + sleep photo uploaded | Flat sleep photo sprite at `rig.x` |
| `playing` + action photo uploaded | Flat action photo sprite at `rig.x` |

The rig always ticks (invisible when a flat photo takes over) so position and pose keep interpolating smoothly for when it reappears.

---

## Session Roadmap

| Session | Goal | Status |
|---------|------|--------|
| 1 | Electron scaffold + transparent overlay + system tray | **Done** |
| 2 | Multi-photo upload wizard + background removal + static overlay | **Done** |
| 3 | Body segmentation — geometric masks → 5 feathered layer PNGs | **Done** |
| 4 | Puppet rig + PixiJS v8 + idle breathing animation | **Done** |
| 5 | XState FSM + pose library + lerp interpolation | **Done** |
| 6 | Directional walk flip + screen-edge clamp + multi-photo routing | **Done** |
| 7 | Particle overlays + sound + settings panel + personality system | **Done** |
| 8 | First-launch onboarding wizard with photo guide | **Done** |
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
| `segments:save` | invoke | `(slot, layers[])` | Write layer PNGs to `userdata/segments/{slot}/{id}.png` |
| `segments:load` | invoke | `slot` → `Record<id, dataUrl> \| null` | Load all layer PNGs as base64 |
| `rig:save` | invoke | `(slot, RigDefinition)` | Write rig JSON to `userdata/rig/{slot}.json` |
| `rig:load` | invoke | `slot` → `RigDefinition \| null` | Load rig JSON |
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
- PixiJS runs in renderer — all animation in `PuppetRig.tick()` called from `app.ticker`
- XState actor lives in `PetView` component — do not put FSM in Electron main process
