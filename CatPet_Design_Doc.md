# CatPet — Virtual Desktop Pet from Your Cat Photo

## 1. Product Vision

**One-liner:** Upload a photo of your cat → get a living, animated desktop companion that idles, plays, sleeps, and reacts on your screen.

**Core Experience:** The app extracts your cat from its photo, then maps it onto a set of procedurally-generated pose sprites. The result is a persistent screen pet that wanders, naps, stretches, and responds to clicks — all wearing *your* cat's actual appearance.

---

## 2. User Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Upload Cat      │ ──▶ │  Background      │ ──▶ │  Sprite Sheet     │ ──▶ │  Live Desktop    │
│  Photos (1–6)    │     │  Removal + Role  │     │  Generation       │     │  Pet Rendering   │
│  + guided prompts│     │  Assignment      │     │  (multi-source)   │     │                  │
└─────────────────┘     └──────────────────┘     └───────────────────┘     └─────────────────┘
```

1. User uploads 1–6 cat photos via a guided upload wizard (see §2.1)
2. App removes background from each, assigns each photo a **role** (face source, walk source, sleep source, etc.)
3. App generates a composite sprite sheet — picking the best real photo for each posture, falling back to transforms when no matching photo exists
4. The pet renders on-screen with state-driven animation loops

---

### 2.1 Multi-Photo Upload System

**Design principle: "1 required, up to 6 optional — each one unlocks something specific."**

The upload UI is a **guided slot system**, not a generic gallery. Each slot tells the user exactly what it needs and why, with an example silhouette overlay showing the ideal pose.

#### Photo Slot Definitions

| Slot | Role           | Required? | Ideal Photo                         | What It Unlocks                              |
|------|----------------|-----------|-------------------------------------|----------------------------------------------|
| 1    | **Primary**    | ✅ Yes    | Side or 3/4 view, standing/sitting  | Base sprite for idle, walk, sit              |
| 2    | **Face**       | Optional  | Front-facing, eyes visible          | Better face crop for template compositing    |
| 3    | **Sleep**      | Optional  | Curled up, lying down, loaf pose    | Authentic sleep sprite instead of transform  |
| 4    | **Action**     | Optional  | Stretching, jumping, playing        | Richer stretch/play animations               |
| 5    | **Back/Top**   | Optional  | Rear view or top-down               | Back pattern for away-facing walk frames     |
| 6    | **Texture**    | Optional  | Close-up of fur/markings            | Higher-fidelity fur pattern sampling         |

#### Progressive Quality Ladder

```
1 photo:  ██░░░░░░░░  Basic — transforms only, single angle
                       Cat is recognizable but poses feel "same-y"

2 photos: ████░░░░░░  Good — face + body from different angles
                       Idle/sit look natural, walk is decent

3 photos: ██████░░░░  Great — sleep pose is real, not squashed
                       Most states use actual cat imagery

5 photos: ████████░░  Excellent — almost every state has a real source
                       Template compositing has rich color data

6 photos: ██████████  Maximum — fur texture mapped at high fidelity
                       Every angle covered, minimal guesswork
```

#### Upload UX Design

```
┌─────────────────────────────────────────────────────┐
│  Let's capture [Mochi]'s best angles!               │
│                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ 🐱 SIDE │  │ 😺 FACE │  │ 😴 SLEEP│             │
│  │ ✅ Done  │  │ + Add   │  │ + Add   │             │
│  │ [img]    │  │ front   │  │ curled  │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ 🐈 PLAY │  │ 🔙 BACK │  │ 🔍 FUR  │             │
│  │ + Add   │  │ + Add   │  │ + Add   │             │
│  │ jumping │  │ rear    │  │ closeup │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                      │
│  Quality: ████░░░░░░ Good (2/6 photos)              │
│                                                      │
│  [Generate My Pet →]  (min 1 photo to proceed)      │
└─────────────────────────────────────────────────────┘
```

Each slot shows:
- A **ghost silhouette** of the ideal pose (cat outline overlay on camera/upload)
- A **tip** ("Try to capture your cat's face straight-on, eyes visible")
- A **preview** once uploaded, with auto-detection of whether the photo matches the slot's intent

#### Auto-Role Detection

When a user uploads a photo to any slot, the system analyzes it and suggests the best role:

```typescript
// processing/photo-analyzer.ts
interface PhotoAnalysis {
  catDetected: boolean;
  orientation: 'front' | 'side-left' | 'side-right' | '3/4' | 'back' | 'top-down';
  pose: 'standing' | 'sitting' | 'lying' | 'curled' | 'jumping' | 'walking';
  faceCoverage: number;    // 0–1, how much of frame is face
  furDetail: number;       // 0–1, texture richness score
  suggestedSlot: SlotRole; // Best-fit role for this photo
}
```

This can be powered by Claude Vision API (analyze the photo and return structured JSON) or a lighter-weight local classifier. If the user uploads a sleeping photo into the "Side" slot, the system gently suggests: *"This looks like a great sleep photo — want to move it to the Sleep slot instead?"*

#### Sprite Source Priority

When generating sprites for each state, the system uses a **priority cascade**:

```
For each pet state:
  1. Use the REAL photo assigned to that state's slot (best quality)
  2. If no matching slot photo → use the CLOSEST photo + moderate transform
  3. If only primary photo exists → use primary + heavy transform/template composite
```

Example for the `sleep` state:
- **Has sleep photo (Slot 3):** Use it directly — isolate, minor scale adjustment, add Zzz overlay. Looks perfect.
- **Has front + side photos only:** Take side photo, apply curl transform (scale X: 0.7, rotate 20°, tuck limbs via region masking). Decent but synthetic.
- **Has only primary photo:** Apply aggressive squash + rotate + template composite with sampled colors. Recognizable but clearly generated.

---

## 3. Posture / State System

The pet operates as a **finite state machine (FSM)** with these core states:

| State       | Animation                        | Trigger                        | Duration      |
|-------------|----------------------------------|--------------------------------|---------------|
| `idle`      | Gentle breathing bob, ear twitch | Default / return from action   | 5–15s         |
| `walk`      | Horizontal sprite translation    | Random timer                   | 3–8s          |
| `sit`       | Seated pose, tail sway           | Random timer after walk        | 8–20s         |
| `sleep`     | Curled up, slow breathing, Zzzs  | After long idle / night mode   | 15–60s        |
| `stretch`   | Full body elongation anim        | Transition from sleep → idle   | 2s            |
| `play`      | Paw batting, head tracking       | User clicks near the cat       | 3–5s          |
| `startled`  | Jump + wide eyes                 | User clicks directly on cat    | 1s            |
| `groom`     | Licking paw motion               | Random low-priority timer      | 5–10s         |
| `hungry`    | Meowing mouth open, pacing       | Timed interval (configurable)  | Until "fed"   |

**State Transition Diagram:**

```
                    ┌──────────┐
           ┌───────▶│  sleep   │◀── long idle timeout
           │        └────┬─────┘
           │             │ wake
           │        ┌────▼─────┐
           │        │ stretch  │
           │        └────┬─────┘
           │             ▼
  idle ◀──────────── idle ──────────▶ walk
   │                  │    random       │
   │ click nearby     │ timer           │ arrives at edge
   ▼                  ▼                 ▼
  play              groom             sit
   │                  │                 │
   └──────▶ idle ◀────┘◀───────────────┘
              │
              │ click on cat
              ▼
          startled ──▶ idle
```

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer              | Technology                    | Rationale                                               |
|--------------------|-------------------------------|---------------------------------------------------------|
| **Runtime**        | Electron 30+                  | Desktop overlay with transparent, click-through window  |
| **Renderer**       | HTML5 Canvas + PixiJS         | Hardware-accelerated 2D with sprite mesh deformation    |
| **UI Framework**   | React 18 (settings panel)     | Settings/upload UI; pet canvas is raw PixiJS            |
| **Background Removal** | `@imgly/background-removal-node` | Runs locally, no API dependency, ONNX-based     |
| **Segmentation**   | MediaPipe / ONNX Runtime      | Segment cat photo into body parts (head, torso, legs, tail) for puppet rigging |
| **Image Processing** | Sharp + Canvas API          | Crop, resize, layer compositing, alpha edge refinement  |
| **AI Analysis**    | Anthropic API (Claude Vision) | Analyze cat orientation; identify body part boundaries; generate segmentation hints |
| **Puppet Engine**  | Custom (Canvas 2D transforms) | Per-segment transform chains: rotate, translate, mesh warp for natural motion |
| **State Machine**  | XState v5                     | Robust FSM with timers, guards, and visual debugging    |
| **Build**          | Vite + electron-builder       | Fast dev, self-contained portable packaging             |
| **Package Manager**| pnpm                          | Workspace-friendly, fast                                |

### 4.2 Project Structure

```
catpet/
├── electron/
│   ├── main.ts              # Electron main process — transparent overlay window
│   ├── preload.ts           # IPC bridge for renderer
│   └── tray.ts              # System tray icon + context menu
├── src/
│   ├── core/
│   │   ├── state-machine.ts # XState FSM definition (states, transitions, timers)
│   │   ├── physics.ts       # Simple 2D movement: walk speed, boundaries, gravity
│   │   └── scheduler.ts     # Random event timer (triggers groom, sleep, walk)
│   ├── sprites/
│   │   ├── puppet-rig.ts    # Define bone/joint system for segmented cat parts
│   │   ├── segment-mesh.ts  # Per-segment mesh with deformation anchors
│   │   ├── pose-library.ts  # Predefined joint angles for each pet state
│   │   ├── animator.ts      # Frame sequencing: interpolate between pose keyframes
│   │   └── overlays.ts      # Particle effects: Zzz, hearts, !, sweat drops
│   ├── processing/
│   │   ├── background-removal.ts  # @imgly/background-removal-node wrapper
│   │   ├── cat-analyzer.ts        # Detect orientation, pose, color palette per photo
│   │   ├── body-segmenter.ts      # Segment isolated cat into head/torso/legs/tail layers
│   │   ├── photo-router.ts        # Assign photos to roles, pick best source per state
│   │   ├── fur-sampler.ts         # K-means color extraction, multi-region texture map
│   │   ├── edge-refiner.ts        # Feathered alpha edges, fur-fringe synthesis
│   │   └── sprite-builder.ts      # Assemble puppet rig from segmented photo parts
│   ├── renderer/
│   │   ├── canvas.ts        # Main render loop (requestAnimationFrame)
│   │   ├── scene.ts         # Scene graph: cat sprite + overlays + ground line
│   │   └── interaction.ts   # Mouse click/hover detection on cat hitbox
│   ├── ui/
│   │   ├── App.tsx          # Settings panel (upload, preferences, stats)
│   │   ├── Upload.tsx       # Multi-photo guided slot wizard + preview + auto-role detect
│   │   ├── QualityMeter.tsx # Progress bar showing sprite quality by photo count
│   │   ├── Onboarding.tsx   # First-launch welcome + step-by-step photo guide
│   │   ├── PhotoGuide.tsx   # Per-slot: silhouette overlay, tips, good/bad examples
│   │   ├── PetView.tsx      # Canvas wrapper component
│   │   └── Tray.tsx         # Tray menu renderer
│   └── utils/
│       ├── config.ts        # User preferences (speed, sleep schedule, name)
│       └── storage.ts       # Persist cat data + sprite cache (electron-store)
├── assets/
│   ├── rigs/                # Puppet rig definitions (joint positions per pose)
│   │   ├── idle.json        # Joint angles for idle breathing
│   │   ├── walk.json        # Walk cycle keyframes (4-frame loop)
│   │   ├── sit.json         # Seated joint positions
│   │   ├── sleep.json       # Curled-up joint positions
│   │   ├── stretch.json     # Extended stretch keyframes
│   │   └── play.json        # Paw-batting keyframes
│   ├── masks/               # Fallback segmentation masks (generic cat shapes)
│   │   ├── side-segments.png   # Pre-labeled region map for side-view cats
│   │   └── front-segments.png  # Pre-labeled region map for front-view cats
│   ├── guide/               # Photo upload guide assets
│   │   ├── slot-side.png    # Example silhouette: ideal side-view pose
│   │   ├── slot-face.png    # Example silhouette: front-facing
│   │   ├── slot-sleep.png   # Example silhouette: curled/loaf
│   │   ├── slot-action.png  # Example silhouette: jumping/stretching
│   │   ├── slot-back.png    # Example silhouette: rear view
│   │   ├── slot-fur.png     # Example silhouette: close-up fur
│   │   ├── good-1.jpg       # "Good photo" example
│   │   ├── good-2.jpg
│   │   ├── bad-blurry.jpg   # "Bad photo" example: blurry
│   │   ├── bad-cropped.jpg  # "Bad photo" example: head cut off
│   │   └── bad-dark.jpg     # "Bad photo" example: too dark
│   ├── overlays/            # Particle sprites (Zzz, hearts, etc.)
│   └── sounds/              # Optional: purr.mp3, meow.mp3
├── scripts/
│   └── build-sprites.ts     # CLI tool to pre-generate sprite sheet from photo
├── README.txt               # Bundled in zip root — quick-start for friends
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json
```

### 4.3 Electron Window Configuration

The key trick: a **transparent, always-on-top, click-through window** that acts as an overlay.

```typescript
// electron/main.ts — key config
const win = new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  hasShadow: false,
  resizable: false,
  width: screenWidth,
  height: screenHeight,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  },
});

// Make window click-through EXCEPT on the cat sprite region
// The renderer sends cat hitbox coords via IPC
win.setIgnoreMouseEvents(true, { forward: true });

// Listen for mouse enter/leave on cat hitbox to toggle click-through
ipcMain.on('cat-hover', (_, isHovering: boolean) => {
  win.setIgnoreMouseEvents(!isHovering, { forward: true });
});
```

### 4.4 Photorealistic Puppet Animation Pipeline

**Design philosophy: The cat on screen should look like a REAL photograph of your cat that has come alive — not a cartoon, not a pixel art sprite, not a stylized illustration. Every pixel of fur visible on screen is actual fur from your photos.**

The technique is **2D skeletal puppet animation** (similar to Spine, Live2D, or Adobe Character Animator): the real cat photo is segmented into body parts, each part becomes an independent layer with a joint/bone attachment point, and movement is achieved by rotating and translating these real-photo layers relative to each other.

```
  ┌──────────────────────────────────────────────────────┐
  │            Uploaded Photos (1–6)                      │
  │   [Primary] [Face] [Sleep] [Action] [Back] [Texture] │
  └────────────────────────┬─────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  Per-photo processing:   │
              │  1. Background removal   │
              │  2. Orientation detect   │
              │  3. Role assignment      │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────────────┐
              │  BODY SEGMENTATION               │
              │  Split isolated cat into layers:  │
              │  head, torso, front-legs,         │
              │  rear-legs, tail                  │
              └────────────┬────────────────────┘
                           │
              ┌────────────▼────────────────────┐
              │  PUPPET RIG ASSEMBLY             │
              │  Attach joints between layers:   │
              │  neck-joint, shoulder, hip,       │
              │  tail-base                        │
              └────────────┬────────────────────┘
                           │
              ┌────────────▼────────────────────┐
              │  POSE INTERPOLATION              │
              │  For each pet state, define      │
              │  target joint angles → animate   │
              │  by smoothly interpolating       │
              │  between keyframes               │
              └────────────────────────────────┘
```

#### 4.4.1 Body Segmentation

The cat photo is split into 5–7 independently movable layers, each with feathered alpha edges so seams blend naturally:

```
              ┌──────────────┐
              │     HEAD     │ ← Includes ears, face, chin
              │   (layer 5)  │
              └──────┬───────┘
                     │ neck joint (pivot point)
              ┌──────▼───────┐
              │    TORSO     │ ← Main body mass
              │   (layer 1)  │
              └──┬────────┬──┘
     shoulder    │        │   hip joint
    ┌────────────▼┐   ┌───▼────────────┐
    │ FRONT LEGS  │   │  REAR LEGS     │
    │  (layer 2)  │   │   (layer 3)    │
    └─────────────┘   └───┬────────────┘
                          │ tail-base joint
                    ┌─────▼──────┐
                    │    TAIL    │
                    │  (layer 4) │
                    └────────────┘
```

**Segmentation approach (in priority order):**

1. **Claude Vision API** (best): Send the isolated cat photo to Claude with a structured prompt: *"Identify the pixel boundaries of this cat's head, torso, front legs, rear legs, and tail. Return bounding polygons as coordinate arrays."* Parse the response into clipping masks. This gives the most accurate segmentation because it understands cat anatomy.

2. **ONNX animal segmentation model** (offline fallback): Run a local segmentation model that labels body part regions. Less precise but works without network.

3. **Generic fallback masks** (last resort): Pre-built segmentation templates (`assets/masks/side-segments.png`) — a labeled region map for a "generic cat shape" in side view. The system warps this mask to roughly fit the uploaded cat's proportions using key-point alignment. Least accurate, but guarantees the pipeline always produces output.

```typescript
// processing/body-segmenter.ts
interface CatSegmentation {
  layers: {
    id: 'head' | 'torso' | 'front-legs' | 'rear-legs' | 'tail';
    image: ImageData;        // Cropped photo region with alpha channel
    anchor: Point;           // Joint/pivot point in local coordinates
    parentAnchor: Point;     // Where this attaches to parent layer
    zIndex: number;          // Draw order
    boundingPoly: Point[];   // Precise boundary polygon
  }[];
  joints: {
    id: 'neck' | 'shoulder' | 'hip' | 'tail-base';
    position: Point;         // Position in original photo coordinates
    rotationRange: [number, number];  // Min/max degrees of natural rotation
  }[];
}
```

**Edge quality is critical** — this is what separates "real photo" from "cut-out collage":

- **Feathered alpha edges**: Each segment gets a 3–5px Gaussian-blurred alpha boundary, so layers blend softly where they overlap rather than showing hard cut lines.
- **Overlap zones**: Adjacent segments (e.g., head and torso) share a ~15px overlap region. Both layers render in this zone with blended alpha, hiding the seam.
- **Fur fringe synthesis**: Along silhouette edges, sample fur color from nearby pixels and paint 1–2px semi-transparent wisps to break up the hard outline. This prevents the "sticker on screen" look.

#### 4.4.2 Puppet Rig & Pose System

Each pet state is defined as a set of **joint angles** relative to the idle pose. Animation = smoothly interpolating between these angles over time.

```typescript
// sprites/pose-library.ts
// All angles in degrees, relative to idle resting pose (0° = idle position)
interface PoseKeyframe {
  time: number;  // 0.0 – 1.0 within animation cycle
  joints: {
    neck:      number;  // + = head up, - = head down
    shoulder:  number;  // + = front legs forward
    hip:       number;  // + = rear legs forward
    tailBase:  number;  // + = tail up
    tailTip:   number;  // Secondary tail curl
    bodyY:     number;  // Vertical offset (px) — for breathing, jumping
    bodyScaleX: number; // 1.0 = normal, for stretch/squash
    bodyScaleY: number;
  };
}

const POSE_LIBRARY: Record<PetState, PoseKeyframe[]> = {

  idle: [  // Gentle breathing loop — 3s cycle
    { time: 0.0, joints: { neck: 0, shoulder: 0, hip: 0, tailBase: 5,
                           tailTip: 10, bodyY: 0, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
    { time: 0.5, joints: { neck: 1, shoulder: 0, hip: 0, tailBase: 8,
                           tailTip: 15, bodyY: -2, bodyScaleX: 1.0, bodyScaleY: 1.01 } },
    // ↑ Barely visible chest expansion, slight tail drift
  ],

  walk: [  // 4-frame walk cycle — legs alternate, body bobs
    { time: 0.00, joints: { neck: -2, shoulder: 15, hip: -10, tailBase: 10,
                            tailTip: 5, bodyY: 0, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
    { time: 0.25, joints: { neck: 0, shoulder: 5, hip: 5, tailBase: 15,
                            tailTip: 20, bodyY: -3, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
    { time: 0.50, joints: { neck: -2, shoulder: -10, hip: 15, tailBase: 10,
                            tailTip: 5, bodyY: 0, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
    { time: 0.75, joints: { neck: 0, shoulder: 5, hip: 5, tailBase: 5,
                            tailTip: -5, bodyY: -3, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
  ],

  sleep: [  // Uses sleep photo directly if available; otherwise curl rig
    { time: 0.0, joints: { neck: -25, shoulder: 30, hip: 35, tailBase: 40,
                           tailTip: 60, bodyY: 10, bodyScaleX: 0.85, bodyScaleY: 0.9 } },
    { time: 0.5, joints: { neck: -25, shoulder: 30, hip: 35, tailBase: 42,
                           tailTip: 62, bodyY: 11, bodyScaleX: 0.85, bodyScaleY: 0.91 } },
    // ↑ Minimal movement — just slow breathing
  ],

  startled: [  // Quick one-shot: jump up, eyes wide
    { time: 0.0, joints: { neck: 15, shoulder: -5, hip: -5, tailBase: 40,
                           tailTip: 50, bodyY: -20, bodyScaleX: 0.95, bodyScaleY: 1.1 } },
    { time: 0.3, joints: { neck: 10, shoulder: 0, hip: 0, tailBase: 30,
                           tailTip: 35, bodyY: -25, bodyScaleX: 1.0, bodyScaleY: 1.05 } },
    { time: 1.0, joints: { neck: 0, shoulder: 0, hip: 0, tailBase: 5,
                           tailTip: 10, bodyY: 0, bodyScaleX: 1.0, bodyScaleY: 1.0 } },
  ],
  // ... play, stretch, groom, sit follow the same pattern
};
```

**Why this looks realistic:**

- Every pixel on screen is *from the original photograph*. No drawn lines, no vector shapes, no color fills.
- Movement is achieved by **rotating and translating photo segments at their natural joints** — the same way a real cat's body actually moves.
- The motion is subtle. Cats are not bouncy cartoon characters. The idle breathing is a 1–2px vertical shift over 3 seconds. The walk cycle is gentle leg swings with a barely-visible body bob. Restraint is what sells realism.
- The tail has two bones (base + tip) allowing S-curve motion that mimics how real cat tails move — they don't swing like rigid sticks.

#### 4.4.3 Multi-Photo Source Routing (Updated)

The source priority cascade still applies, but now focused on photographic authenticity:

| Pet State   | Best Source                        | Puppet Fallback                                        |
|-------------|-------------------------------------|-------------------------------------------------------|
| `idle`      | Primary photo, segmented + rigged   | Rig with minimal joint angles, breathing only         |
| `walk`      | Primary (side view) puppet rig      | Leg joints cycle ±15°, body translates horizontally   |
| `sit`       | Primary or face photo if sitting    | Hip joints fold, front legs straighten                |
| `sleep`     | **Sleep slot photo used AS-IS**     | Extreme joint curl (only if no sleep photo provided)  |
| `stretch`   | Action slot (if stretching) AS-IS   | Shoulder extends, bodyScaleX 1.2, legs spread         |
| `play`      | Puppet rig of primary               | Front leg joints jitter rapidly, head tracks mouse    |
| `startled`  | Face photo (swap head layer)        | bodyY jumps -25px, tail spikes up                     |
| `groom`     | Puppet rig of primary               | Head rotates down -20°, front leg rises               |

**Key rule for sleep/stretch/action:** When the user provides a real photo of that exact pose, the system does NOT puppet-rig it. It uses the full uncut photo directly (background-removed, edge-refined) as a **static sprite with only breathing micro-motion** added. A real photo of your cat sleeping looks infinitely better than a puppet trying to curl up.

#### 4.4.4 Rendering Pipeline

```typescript
// renderer/puppet-renderer.ts
class PuppetRenderer {
  private layers: SegmentLayer[];
  private rig: PuppetRig;

  render(ctx: CanvasRenderingContext2D, pose: InterpolatedPose) {
    // Sort layers by z-index (back-to-front: tail, rear-legs, torso, front-legs, head)
    const sorted = this.layers.sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sorted) {
      ctx.save();

      // Move to the layer's joint/anchor point
      const joint = this.rig.getJoint(layer.parentJoint);
      ctx.translate(joint.x, joint.y);

      // Apply the joint rotation for this pose
      const angle = pose.joints[layer.parentJoint];
      ctx.rotate((angle * Math.PI) / 180);

      // Draw the REAL photo segment — offset so the anchor is the pivot
      ctx.drawImage(
        layer.image,
        -layer.anchor.x,
        -layer.anchor.y
      );

      ctx.restore();
    }

    // Overlay effects (Zzz, hearts, etc.) drawn on top
    this.renderOverlays(ctx, pose);
  }
}
```

### 4.6 State Machine (XState v5)

```typescript
// core/state-machine.ts
import { createMachine, assign } from 'xstate';

const catPetMachine = createMachine({
  id: 'catPet',
  initial: 'idle',
  context: {
    x: 400, y: 0,          // Position on screen
    direction: 'right',     // Facing direction
    energy: 100,            // Decreases over time → triggers sleep
    happiness: 80,          // Increases with play, decreases over time
    lastFed: Date.now(),
  },
  states: {
    idle: {
      after: {
        RANDOM_IDLE_TIMEOUT: [    // 5–15 seconds
          { target: 'walk', guard: 'hasEnergy' },
          { target: 'sleep', guard: 'isTired' },
          { target: 'groom', guard: 'shouldGroom' },
        ]
      },
      on: {
        CLICK_NEAR: 'play',
        CLICK_ON: 'startled',
      },
    },
    walk: {
      entry: 'pickDirection',
      after: { WALK_DURATION: 'sit' },  // 3–8 seconds
      on: { REACHED_EDGE: 'idle', CLICK_ON: 'startled' },
    },
    sit: {
      after: { SIT_DURATION: 'idle' },  // 8–20 seconds
      on: { CLICK_NEAR: 'play', CLICK_ON: 'startled' },
    },
    sleep: {
      entry: 'restoreEnergy',
      after: { SLEEP_DURATION: 'stretch' },
      on: { CLICK_ON: 'startled' },     // Can be woken up
    },
    stretch: {
      after: { 2000: 'idle' },
    },
    play: {
      entry: 'boostHappiness',
      after: { PLAY_DURATION: 'idle' },
    },
    startled: {
      after: { 1000: 'idle' },
    },
    groom: {
      after: { GROOM_DURATION: 'idle' },
    },
    hungry: {
      on: { FEED: 'idle' },
      after: { 30000: 'idle' },  // Auto-resolve after 30s
    },
  },
});
```

---

## 5. Implementation Phases

### Phase 1 — Static Pet (Week 1)
**Goal:** Cat photo → isolated sprite → rendered on transparent Electron overlay

- [ ] Scaffold Electron + Vite + React project
- [ ] Implement photo upload UI
- [ ] Integrate `@imgly/background-removal-node` for cat isolation
- [ ] Render isolated cat on transparent canvas overlay
- [ ] System tray icon with quit + settings
- [ ] Basic click detection on cat sprite

**Deliverable:** Your cat floats on screen. No animation yet.

### Phase 2 — Puppet Rig & State Machine (Week 2)
**Goal:** Cat photo segmented into body parts, basic puppet movement working

- [ ] Implement body segmentation (Claude Vision API → fallback masks)
- [ ] Build puppet rig: joint system, layer z-ordering, pivot points
- [ ] Feathered alpha edges + overlap zones for seamless segment blending
- [ ] Implement XState state machine with all 8 states
- [ ] Wire up `requestAnimationFrame` render loop with puppet renderer
- [ ] Idle state: breathing micro-motion (1–2px bodyY oscillation, gentle tail drift)

**Deliverable:** Your real cat photo, segmented and gently breathing on screen.

### Phase 3 — Full Motion & Polish (Week 3)
**Goal:** All pose states animating with photorealistic puppet motion

- [ ] Pose library: walk cycle, sit, sleep, stretch, play, startled, groom keyframes
- [ ] Smooth joint interpolation with easing (ease-in-out for natural motion)
- [ ] Multi-photo source routing: sleep/action photos used AS-IS when available
- [ ] Head layer swap from face-slot photo for front-facing states
- [ ] Screen-edge boundary detection + direction flip
- [ ] Click → play / startled interactions with mouse position head-tracking
- [ ] Add particle overlays (Zzz, hearts, !, sparkles)
- [ ] Add sound effects (optional, toggle-able)
- [ ] Settings panel: pet name, speed, sleep schedule, sound toggle

**Deliverable:** Photorealistic cat that walks, sleeps, plays — all using real fur pixels.

### Phase 4 — Personality & Packaging (Week 4)
**Goal:** Ship it as a portable zip your friends can extract and run

- [ ] Implement energy/happiness/hunger system
- [ ] Add time-of-day awareness (sleeps at night, active in morning)
- [ ] Stats panel (total play time, interactions, mood history)
- [ ] Portable packaging: `electron-builder` → `dir` target → zip
- [ ] First-launch onboarding wizard with photo guide (see §10)
- [ ] Bundle README.txt in zip root with quick-start instructions
- [ ] Test on clean Windows machine (no Node/dev tools installed)

**Deliverable:** `CatPet-1.0.0-win-x64.zip` — extract anywhere, double-click `CatPet.exe`.

---

## 6. Key Technical Decisions

| Decision | Choice | Alternative Considered | Why |
|----------|--------|----------------------|-----|
| Desktop framework | Electron 30+ | Tauri | Transparent overlay + click-through is battle-tested in Electron; Tauri's transparent window support is less mature |
| Distribution | Self-contained portable zip (`dir` target) | NSIS installer | Zero-install: extract and run. Friends don't need admin rights, no VC++ install, nothing touches the registry. User data stored relative to app folder |
| Animation approach | **2D skeletal puppet rig** (photo segments + joints) | Cartoon SVG templates / AI image generation | Preserves 100% photographic fidelity — every pixel is real fur. No cartoonification, no style inconsistency. Puppet approach is proven (Spine, Live2D, Character Animator) |
| Rendering | PixiJS | Raw Canvas 2D | Puppet rig needs per-layer transforms at 60fps; PixiJS gives hardware-accelerated sprite batching, mesh deformation, and blend modes for segment overlap |
| Segmentation | Claude Vision API → ONNX fallback → static masks | Manual user annotation | Claude Vision understands cat anatomy and can return precise body-part polygons. Fallback chain ensures offline users still get results |
| State machine | XState v5 | Custom FSM | Visual inspector for debugging, built-in timer support, well-typed |
| Background removal | @imgly/background-removal-node | remove.bg API | Runs offline, no API key, free, bundled as native ONNX module inside the zip |
| User data location | `./userdata/` (relative to exe) | `%APPDATA%` | Portable-friendly — everything travels with the folder, nothing left behind on the host machine |
| Native deps | Bundled in zip | Require user to install | ONNX runtime and Sharp native binaries pre-compiled and included. VC++ runtime statically linked. User installs **nothing** |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cat photo at unusual angle (top-down, extreme close-up) | Poor segmentation, joints misaligned | Onboarding photo guide with silhouette overlay; validation rejects bad angles with helpful re-take tips |
| Background removal fails on complex fur (long-hair cats) | Jagged edges, artifacts | Feathered alpha edge (3–5px Gaussian) + fur fringe synthesis on silhouette |
| Puppet segment seams visible at joints | "Paper doll" cut-out look | 15px overlap zones with blended alpha between adjacent layers; subtle shadow under head layer |
| Segmentation model misidentifies body parts | Legs/tail confused, wrong joints | Claude Vision API as primary (high accuracy); ONNX fallback; user can manually adjust joint positions in Settings |
| Puppet motion looks robotic | Unnatural, stiff movement | Ease-in-out interpolation, subtle secondary motion (tail lag, ear twitch), keep all rotations within ±30° of natural range |
| ONNX native module fails on user's machine | App won't process photos | Bundle pre-built binaries for win-x64; include WASM fallback for edge cases; clear error message with "send us a report" option |
| Electron memory usage | ~150–200MB baseline | Lazy-load settings panel; keep canvas small; use OffscreenCanvas for segmentation |
| Zip is too large (>200MB) | Friends won't download | Strip dev dependencies, compress ONNX models (quantize to int8), electron-builder `asar` packing; target <150MB |
| Click-through window conflicts with OS | Mouse events leak or block | Platform-specific testing; provide "pause" mode via tray |

---

## 8. Claude Code Workflow

Since you'll be building this in Claude Code, here's the recommended session structure:

```
Session 1: "Scaffold the Electron + Vite + React + PixiJS project with
            transparent overlay window. Add system tray. Verify transparent
            click-through window works on my OS."

Session 2: "Build the multi-photo upload wizard with guided slots, photo
            validation (cat detection, blur/dark checks), background removal
            preview, and quality meter. Integrate @imgly/background-removal-node."

Session 3: "Implement body segmentation: send isolated cat to Claude Vision
            API to get body part polygons. Build fallback to generic mask
            templates. Output: 5 layers (head, torso, front-legs, rear-legs,
            tail) each with alpha-feathered edges and overlap zones."

Session 4: "Build the puppet rig: joint system connecting segments, pivot
            points, z-index ordering. Implement idle breathing animation
            (1-2px bodyY oscillation, gentle tail drift). Render with PixiJS."

Session 5: "Implement XState state machine. Build pose library with keyframes
            for walk, sit, sleep, stretch, play, startled, groom. Add smooth
            joint interpolation with ease-in-out easing."

Session 6: "Add mouse interaction: click near cat → play state with head
            tracking, click on cat → startled jump. Screen edge detection.
            Multi-photo source routing: use sleep/action photos AS-IS when
            available instead of puppet-rigging them."

Session 7: "Polish: particle overlays (Zzz, hearts, sparkles), sound effects,
            settings panel, energy/happiness system, pet naming, time-of-day
            awareness."

Session 8: "Build the first-launch onboarding wizard with step-by-step photo
            guide, silhouette overlays, good/bad examples, slot reassignment
            suggestions."

Session 9: "Package as self-contained portable zip with electron-builder dir
            target. Bundle all native deps (ONNX, Sharp). Bundle README.txt.
            Verify on a CLEAN Windows machine (no Node, no dev tools) that
            extract-and-double-click works with zero additional installs."
```

Each session is scoped to ~1–2 hours of Claude Code work with clear acceptance criteria.

---

## 9. Stretch Goals

- **Multi-cat support**: Upload multiple cats, they interact with each other
- **Webcam reaction**: Cat reacts when it "sees" you via webcam (face detection)
- **Widget mode**: Smaller version that sits in system tray / menu bar
- **Mobile companion**: React Native version that syncs pet state
- **AI personality**: Use Claude API to generate unique personality traits and dialogue bubbles based on the cat's appearance ("I'm a distinguished tuxedo cat, I demand treats")

---

## 10. Photo Upload Guide & Onboarding UX

This is critical for friend-distribution. Most users will have never used an app like this. The onboarding must answer three questions immediately: **"What is this?"**, **"What photos do I need?"**, and **"What makes a good photo?"**

### 10.1 First-Launch Welcome Flow

On first launch (no `./userdata/cat.json` found), the app opens a **centered onboarding window** instead of the transparent overlay. The overlay only activates after at least 1 photo is processed.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     🐱  Welcome to CatPet                    │
│                                                              │
│         Turn a photo of YOUR cat into a living               │
│         desktop companion that walks, sleeps,                │
│         and plays on your screen.                            │
│                                                              │
│    ┌──────────────────────────────────────────────┐          │
│    │  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐     │          │
│    │  │idle │ → │walk │ → │sleep│ → │play │     │          │
│    │  │ 🐱  │   │ 🐱  │   │ 😴  │   │ 🐱  │     │          │
│    │  └─────┘   └─────┘   └─────┘   └─────┘     │          │
│    │         (animated preview of a demo cat)     │          │
│    └──────────────────────────────────────────────┘          │
│                                                              │
│           Let's get started — grab some photos               │
│           of your cat and we'll do the rest!                 │
│                                                              │
│                  [ Get Started → ]                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Step-by-Step Photo Guide

After clicking "Get Started", the wizard walks through each photo slot one at a time, fullscreen-style (not all 6 slots at once — that's overwhelming).

**Step 1 of 6 — The Required Photo:**

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1 of 6                            [Skip Optional ▸]   │
│  ─────────────────────────────────────────────────────       │
│  📸  SIDE VIEW  (Required)                                   │
│                                                              │
│  We need a photo of your cat from the SIDE,                  │
│  showing their full body — head to tail.                     │
│                                                              │
│  ┌────────────────────────────┐  TIPS:                       │
│  │                            │  • Full body visible         │
│  │   ┌──────────────────┐     │    (head, body, tail, legs)  │
│  │   │  [ghost outline   │     │  • Side or slight angle     │
│  │   │   of cat from     │     │  • Good lighting            │
│  │   │   the side with   │     │  • Cat not blurry           │
│  │   │   dotted lines]   │     │  • Background doesn't       │
│  │   └──────────────────┘     │    matter (we remove it!)    │
│  │                            │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  ┌─────────── GOOD ──────────┐  ┌────────── BAD ───────────┐│
│  │ ✅ Full body, side angle  │  │ ❌ Head only / cropped    ││
│  │ ✅ Clear, well-lit        │  │ ❌ Very dark / blurry     ││
│  │ ✅ Cat facing left/right  │  │ ❌ Cat facing camera      ││
│  │    [example thumbnail]    │  │    [example thumbnail]    ││
│  └───────────────────────────┘  └───────────────────────────┘│
│                                                              │
│     [ 📁 Choose Photo ]   or   [ 📷 Take Photo ]            │
│                                                              │
│  ────────────────────────────────────────────────────        │
│  Quality: █░░░░░░░░░ (1 photo needed to continue)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Steps 2–6 — Optional Slots (can be skipped):**

Each step follows the same layout but with slot-specific guidance:

| Step | Slot     | Headline                                    | Key Tip                                                         |
|------|----------|---------------------------------------------|-----------------------------------------------------------------|
| 2    | Face     | "Now let's get a FRONT view of their face"  | "Eyes visible, looking at camera. Ears up is ideal."            |
| 3    | Sleep    | "Got a photo of them SLEEPING or curled up?" | "Loaf pose, curled up, lying flat — any resting position works" |
| 4    | Action   | "Caught them mid-STRETCH or JUMP?"          | "Reaching up, pouncing, yawning — any dynamic pose"            |
| 5    | Back     | "How about a REAR or TOP-DOWN view?"        | "Walking away from you, or you looking down at them"            |
| 6    | Texture  | "One last thing — a CLOSE-UP of their fur"  | "Zoom in on their coat pattern. Stripes, spots, solid — all good" |

Each optional step has a prominent **[ Skip → ]** button and the quality meter updates in real-time:

```
Quality: ████░░░░░░  Good — your cat will look great!
         3/6 photos   (Sleep photo really helps the nap animation)
```

### 10.3 Photo Validation & Feedback

After each upload, the system runs quick checks and gives immediate feedback:

```typescript
// processing/photo-validator.ts
interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

type ValidationIssue =
  | { type: 'no_cat';      message: "We couldn't detect a cat in this photo. Try another?" }
  | { type: 'too_dark';    message: "This photo is quite dark. It'll work, but a brighter one would be better." }
  | { type: 'too_blurry';  message: "The photo seems blurry. A sharper image will make your pet look crisper." }
  | { type: 'too_cropped'; message: "We can only see part of the cat. For this slot, we need the full body visible." }
  | { type: 'wrong_pose';  message: "This looks more like a [sleep] photo. Want to use it for that slot instead?" }
  | { type: 'too_small';   message: "This image is very small. Photos at least 500×500px work best." }
```

**Validation UX:**

- **Hard fail** (`no_cat`): Red border, can't proceed with this photo, must re-upload
- **Soft warning** (`too_dark`, `too_blurry`): Yellow border, shows the issue but lets user keep the photo with a "Use Anyway" option
- **Slot mismatch** (`wrong_pose`): Blue suggestion bubble — "This looks like a great sleep photo! Move to Sleep slot?" with one-click reassignment
- **Instant preview**: After upload, show the background-removed result immediately so user can see what the app "sees"

```
┌──────────────────────────────────────────────┐
│  ┌──────────┐                                │
│  │          │  ✅ Cat detected!               │
│  │ [their   │  ⚠️ Slightly dark — still usable│
│  │  cat,    │                                │
│  │  bg      │  Background removed preview:   │
│  │  removed]│  ┌──────────┐                  │
│  │          │  │ [cat on  │                  │
│  └──────────┘  │  checker │                  │
│                │  board]  │                  │
│                └──────────┘                  │
│                                              │
│  [ ✅ Looks Good ]    [ 🔄 Try Another ]     │
│                                              │
└──────────────────────────────────────────────┘
```

### 10.4 Post-Upload Summary & Pet Naming

After completing the wizard (uploading at least 1 photo), show a summary:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│               🎉  Your pet is almost ready!                  │
│                                                              │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│   │ Side │ │ Face │ │Sleep │ │  --  │ │  --  │ │  --  │   │
│   │  ✅  │ │  ✅  │ │  ✅  │ │ skip │ │ skip │ │ skip │   │
│   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│                                                              │
│   Quality: ██████░░░░  Great (3/6 photos)                   │
│   You can always add more photos later in Settings.          │
│                                                              │
│   What's your cat's name?                                    │
│   ┌──────────────────────────┐                               │
│   │  Mochi                   │                               │
│   └──────────────────────────┘                               │
│                                                              │
│                [ 🐱 Bring Mochi to Life! ]                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Clicking the button triggers sprite generation (with a fun loading animation — the cat silhouette assembling piece by piece), then launches the transparent overlay with the pet.

### 10.5 Re-Upload Access

Users can return to the photo wizard anytime via:
- **System tray** → right-click → "Change Photos..."
- **Settings panel** → "My Cat's Photos" section
- **Keyboard shortcut**: `Ctrl+Shift+P` (for "Photos")

This displays the same 6-slot grid but pre-filled with current photos, with "Replace" and "Remove" buttons on each.

---

## 11. Portable Distribution

### 11.1 Build Configuration

```yaml
# electron-builder.yml
appId: com.longjin.catpet
productName: CatPet
directories:
  output: dist
  buildResources: build

win:
  target:
    - target: dir           # ← Produces unpacked folder, NOT an installer
      arch: [x64]
  icon: build/icon.ico

# No NSIS section — we don't want an installer

# After build, a post-build script zips the output:
# dist/win-unpacked/ → CatPet-1.0.0-win-x64.zip
```

**Post-build script** (`scripts/package-portable.ts`):

```typescript
// Runs after electron-builder: zips the dir output + README
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const version = require('../package.json').version;
const output = createWriteStream(`dist/CatPet-${version}-win-x64.zip`);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory('dist/win-unpacked/', 'CatPet');  // Folder name inside zip
archive.file('README.txt', { name: 'CatPet/README.txt' });
archive.finalize();
```

### 11.2 Folder Structure After Extraction

```
CatPet/                              ← User extracts this folder anywhere
├── CatPet.exe                       ← Double-click to launch — NOTHING ELSE NEEDED
├── README.txt                       ← Quick-start instructions (see §11.3)
├── resources/
│   ├── app.asar                     ← Bundled app code (JS/HTML/CSS)
│   └── native/                      ← Pre-compiled native modules
│       ├── onnxruntime-node/        ← ONNX Runtime for background removal + segmentation
│       │   └── onnxruntime.dll
│       ├── sharp/                   ← Image processing native bindings
│       │   └── sharp-win32-x64.node
│       └── models/                  ← ML models bundled with the app
│           ├── bg-removal.onnx      ← Background removal model (~30MB, quantized int8)
│           └── segmentation.onnx    ← Body part segmentation fallback (~15MB)
├── locales/
├── d3dcompiler_47.dll               ← Chromium/Electron runtime
├── ffmpeg.dll
├── libEGL.dll
├── libGLESv2.dll
├── vk_swiftshader.dll
├── vcruntime140.dll                 ← VC++ runtime — STATICALLY INCLUDED, not system-wide
├── msvcp140.dll                     ← VC++ runtime (bundled)
├── ...other Electron runtime files
└── userdata/                        ← Created on first launch (auto)
    ├── cat.json                     ← Cat name, preferences, state, rig data
    ├── photos/                      ← Original uploaded photos (background removed)
    │   ├── primary.png
    │   ├── face.png
    │   └── sleep.png
    ├── segments/                    ← Body part layers from segmentation
    │   ├── primary-head.png
    │   ├── primary-torso.png
    │   ├── primary-front-legs.png
    │   ├── primary-rear-legs.png
    │   └── primary-tail.png
    └── rig/                         ← Cached puppet rig definition
        ├── joints.json              ← Joint positions + rotation ranges
        └── layers.json              ← Layer z-order, anchors, overlap zones
```

**Key portable design decisions:**

- `userdata/` is created **relative to `CatPet.exe`** (using `path.dirname(process.execPath)`), NOT in `%APPDATA%`. Everything stays in the folder — copy it to a USB drive and it works on another PC.
- If `userdata/` doesn't exist on launch → first-launch onboarding triggers automatically.
- If `userdata/` exists but `cat.json` is missing or corrupted → re-triggers onboarding with a "Looks like we need to set up your cat again" message.

```typescript
// electron/main.ts — portable data path
import { app } from 'electron';

const PORTABLE_DATA = path.join(path.dirname(process.execPath), 'userdata');

// Override Electron's default data directories
app.setPath('userData', PORTABLE_DATA);
app.setPath('appData', PORTABLE_DATA);

// First-launch detection
const isFirstLaunch = !fs.existsSync(path.join(PORTABLE_DATA, 'cat.json'));
```

### 11.3 Self-Contained Dependency Bundling

**The user installs NOTHING. No Node.js, no Python, no Visual C++ Redistributable, no .NET, nothing.** This is the #1 distribution requirement. Here's how every dependency gets into the zip:

#### What Electron Already Bundles (free)

Electron itself ships Chromium + Node.js, so you automatically get: a full V8 JavaScript engine, a complete browser rendering engine, Node.js APIs (fs, path, crypto, etc.), and WebGL/Canvas 2D. These total ~70–80MB and handle 90% of the app's needs.

#### Native Modules That Need Explicit Bundling

| Module | What It Does | Native Binary | Bundle Strategy |
|--------|-------------|---------------|-----------------|
| `@imgly/background-removal-node` | Removes photo backgrounds | `onnxruntime.dll` (~25MB) | Use `electron-builder`'s `extraResources` to copy pre-built win-x64 binary into `resources/native/` |
| `sharp` | Image resize, crop, composite | `sharp-win32-x64.node` (~8MB) | Ship pre-built platform-specific binary via `@img/sharp-win32-x64` |
| ONNX models | ML model files | `.onnx` files (~45MB raw) | Quantize to int8 (~15MB each), bundle in `resources/native/models/` |

#### VC++ Runtime (Critical)

Many native modules depend on the Microsoft Visual C++ Runtime (`vcruntime140.dll`, `msvcp140.dll`). On a developer's machine these are always present. On your friend's fresh PC, they might not be.

**Solution: Bundle the DLLs directly in the zip.**

```yaml
# electron-builder.yml
extraFiles:
  # VC++ Runtime DLLs — copied to same directory as CatPet.exe
  - from: "build/redist/vcruntime140.dll"
    to: "."
  - from: "build/redist/msvcp140.dll"
    to: "."
  - from: "build/redist/vcruntime140_1.dll"
    to: "."

extraResources:
  # Native modules — copied to resources/ inside the app
  - from: "native-deps/onnxruntime-node"
    to: "native/onnxruntime-node"
  - from: "native-deps/sharp"
    to: "native/sharp"
  - from: "native-deps/models"
    to: "native/models"
```

Where do you get these DLLs? They ship with Visual Studio Build Tools. During the build (on your dev machine), a script copies them from `C:\Program Files\Microsoft Visual Studio\...\Redist\` into `build/redist/`. They're small (~1MB total) and freely redistributable.

#### Full electron-builder.yml (Production)

```yaml
appId: com.longjin.catpet
productName: CatPet
directories:
  output: dist
  buildResources: build

asar: true                # Compress app code into single .asar archive
asarUnpack:
  - "native-deps/**"     # Native binaries must stay unpacked (can't load from .asar)

win:
  target:
    - target: dir         # Unpacked folder output — NO installer
      arch: [x64]
  icon: build/icon.ico

extraFiles:
  # VC++ Runtime — ensures app works on machines without Visual Studio
  - from: "build/redist/vcruntime140.dll"
    to: "."
  - from: "build/redist/msvcp140.dll"
    to: "."
  - from: "build/redist/vcruntime140_1.dll"
    to: "."
  - from: "README.txt"
    to: "."

extraResources:
  # Native node modules (pre-built for win-x64)
  - from: "native-deps/onnxruntime-node"
    to: "native/onnxruntime-node"
    filter: ["**/*.dll", "**/*.node"]
  - from: "native-deps/sharp"
    to: "native/sharp"
    filter: ["**/*.dll", "**/*.node"]
  # ML models (quantized for smaller zip)
  - from: "native-deps/models"
    to: "native/models"
    filter: ["*.onnx"]
```

#### Build & Package Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Pre-build: download platform-specific native modules
pnpm run prebuild:native    # Custom script that fetches win-x64 binaries
                            # and quantizes ONNX models

# 3. Build the app
pnpm run build              # Vite bundles → electron-builder produces dir

# 4. Package as zip
pnpm run package:zip        # Runs package-portable.ts → CatPet-1.0.0-win-x64.zip

# Output: dist/CatPet-1.0.0-win-x64.zip (~120–150MB)
```

#### Size Budget

| Component | Size | Notes |
|-----------|------|-------|
| Electron runtime (Chromium + Node) | ~75MB | Unavoidable baseline |
| ONNX Runtime native DLLs | ~25MB | Background removal engine |
| Sharp native binary | ~8MB | Image processing |
| ONNX models (int8 quantized) | ~30MB | BG removal + segmentation |
| App code (JS/HTML/CSS) | ~3MB | Your actual application |
| VC++ runtime DLLs | ~1MB | Ensures native modules load |
| Assets (guide images, sounds) | ~5MB | Onboarding examples, overlays |
| **Total (uncompressed)** | **~147MB** | |
| **Total (zip level 9)** | **~100–120MB** | DLLs compress well |

#### Verification Checklist (Session 9)

Before distributing to friends, test on a **clean Windows 10/11 machine** (VM or a friend's non-dev PC):

- [ ] Extract zip to `C:\Users\Someone\Desktop\CatPet\`
- [ ] Double-click `CatPet.exe` — app launches with no errors, no "missing DLL" popups
- [ ] Onboarding wizard appears (first launch, no `userdata/`)
- [ ] Upload a photo — background removal works (ONNX loads correctly)
- [ ] Cat appears on screen, animates (PixiJS renders, puppet rig works)
- [ ] Close app, re-launch — cat persists from `userdata/`
- [ ] Move entire folder to USB drive → plug into different PC → still works
- [ ] No files created outside the CatPet folder (`%APPDATA%`, registry, Start Menu all clean)

### 11.4 Bundled README.txt

This ships inside the zip at the same level as `CatPet.exe`. Written for non-technical friends.

```
═══════════════════════════════════════════════════════
   🐱  CatPet — Your Cat, Living on Your Screen
═══════════════════════════════════════════════════════

QUICK START
───────────
1. Double-click "CatPet.exe" to launch
2. Follow the on-screen guide to upload photos of your cat
3. Your cat will appear on your desktop!

WHAT PHOTOS DO I NEED?
──────────────────────
You only NEED one photo (a side view), but more photos = better pet.
The app will guide you through each one. Here's the cheat sheet:

  📸 REQUIRED:
     • Side view — full body (head to tail), your cat standing
       or sitting, taken from the side

  📸 OPTIONAL (but recommended!):
     • Front face — looking straight at the camera, eyes visible
     • Sleeping — curled up, loaf pose, or lying down
     • Action shot — stretching, jumping, playing
     • Back view — walking away, or top-down angle
     • Fur close-up — zoom in on their coat pattern

PHOTO TIPS
──────────
  ✅ DO:                              ❌ DON'T:
  • Use good lighting                 • Use blurry photos
  • Show the full cat (not cropped)   • Use very dark photos
  • Any background is fine            • Cut off head, tail, or legs
    (the app removes it!)             • Use photos of other animals

HOW TO USE
──────────
• Your cat wanders, naps, and plays on its own
• Click near your cat → it plays with you
• Click directly on your cat → it gets startled (sorry!)
• Right-click the 🐱 icon in your system tray for options:
    - Pause / Resume
    - Change Photos (add better photos anytime)
    - Settings (speed, sounds, name)
    - Quit

CONTROLS
────────
  Ctrl+Shift+P     Open photo manager
  Ctrl+Shift+S     Open settings
  Ctrl+Shift+Q     Quit CatPet

FAQ
───
Q: Can I move the folder to another computer?
A: Yes! Copy the entire "CatPet" folder (including userdata/).
   Your cat and all settings travel with it.

Q: My cat looks weird in some poses.
A: Add more photos! The more angles you provide, the better
   each pose looks. Go to tray icon → Change Photos.

Q: It's using too much memory.
A: Right-click tray → Settings → Performance → Low. This
   reduces animation smoothness but uses less RAM.

Q: How do I completely remove it?
A: Just delete the CatPet folder. Nothing is installed on
   your system — no registry entries, no hidden files.

───────────────────────────────────────────────────────
Made with love by Long Jin  •  v1.0.0
═══════════════════════════════════════════════════════
```
