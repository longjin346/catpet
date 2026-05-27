# CatPet — Claude Code Architecture Reference

## What This Is

Desktop virtual pet: upload 1–6 cat photos → photorealistic puppet rig animates on a transparent Electron overlay. Every pixel on screen is real fur from the user's photos.

Full spec: `CatPet_Design_Doc.md`

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | Electron 31 | Transparent click-through overlay, battle-tested |
| Renderer | React 18 + HTML5 Canvas (PixiJS in Session 4) | Canvas for pet, React for settings UI |
| Build | Vite 5 + vite-plugin-electron | Fast HMR in dev, bundles both processes |
| Types | TypeScript strict | Both main and renderer |
| State machine | XState v5 | Pet FSM — walk/idle/sleep/play/startled/groom |
| Package manager | pnpm | Required — do not use npm/yarn |
| Distribution | electron-builder `dir` target → portable zip | Zero-install, no registry, portable |

---

## Project Layout

```
electron/
  main.ts       — BrowserWindow config (transparent overlay), IPC listeners
  preload.ts    — contextBridge: exposes window.catpet.{setCatHover, openSettings}
  tray.ts       — Tray icon, Settings + Quit menu items

src/
  main.tsx      — React entry point
  ui/
    App.tsx     — Route: ?view=settings → Settings panel, default → PetView
    PetView.tsx — Canvas overlay + hit detection + IPC to toggle click-through
  core/         — (Session 5) XState FSM, physics, scheduler
  sprites/      — (Session 4) Puppet rig, pose library, animator
  processing/   — (Session 2-3) Background removal, segmentation, sprite builder
  renderer/     — (Session 4) requestAnimationFrame loop, scene graph
  utils/        — config.ts, storage.ts (electron-store)

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
                          skipTaskbar: true, focusable: false, ... })
win.setIgnoreMouseEvents(true, { forward: true })  // default: fully click-through

// Renderer toggles on cat hover via IPC:
ipcMain.on('cat-hover', (_, isHovering) =>
  win.setIgnoreMouseEvents(!isHovering, { forward: true }))
```

### Portable Data Path

```typescript
const PORTABLE_DATA = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'userdata')
  : path.join(app.getPath('userData'), 'catpet-dev')
app.setPath('userData', PORTABLE_DATA)
```

Everything lives next to `CatPet.exe`. Copy folder to USB = works on any PC.

### Photorealistic Puppet Animation (Sessions 3–4)

The cat photo is segmented into 5 layers (head, torso, front-legs, rear-legs, tail). Each layer is an independent `ImageData` with feathered alpha. Animation = rotating/translating photo segments at natural joints. All pixels on screen come from the user's actual photo.

---

## Session Roadmap

| Session | Goal | Status |
|---------|------|--------|
| 1 | Electron scaffold + transparent overlay + system tray | **Done** |
| 2 | Multi-photo upload wizard + background removal | Pending |
| 3 | Body segmentation (Claude Vision API + ONNX fallback) | Pending |
| 4 | Puppet rig + idle breathing animation (PixiJS) | Pending |
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

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `cat-hover` | renderer → main | `boolean` | Toggle window click-through |
| `open-settings` | renderer → main | — | Open settings BrowserWindow |

---

## Rules

- **pnpm only** — no npm/yarn
- **No installer** — distribution is portable zip, `dir` target only
- **No cartoons** — animation is photo segments on joints, never drawn shapes
- **userdata next to exe** — never write to `%APPDATA%` in packaged builds
- Electron main process: CommonJS (`tsconfig.electron.json`)
- React renderer: ESNext modules (`tsconfig.json`)
