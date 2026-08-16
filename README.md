# 🪖 Digital Soldier — drill pose studio

A 3D digital soldier you pose, dress, photograph and film — entirely in your
browser. Move his limbs joint by joint to show drill positions, jump between
preset positions (attention, stand at ease, salute, marching…), customise his
uniform and appearance, take PNG snapshots, and record videos of animated
drill sequences.

Two interchangeable figures share every control (Appearance → Figure):

- **Realistic** (default): a rigged, motion-captured human soldier — the
  "Vanguard" character with a full 49-bone Mixamo skeleton. Marches with real
  mocap Walk/Run clips. His scanned uniform is fixed, but can be tinted.
- **Stylized**: the fully customisable figure — any uniform colour,
  camouflage patterns, headgear, skin tone, gloves.

Poses, presets, keyframes and saved projects work identically on both.

No installation, no internet connection and no build step required — Three.js
is vendored in the repo.

## Quick start

**Easiest:** open `dist/digital-soldier-standalone.html` — a single file with
everything inlined. Double-click it, or send it to anyone.

**From the repo folder** (any static server works):

```bash
cd digital-soldier
python3 -m http.server 8000     # or: npx http-server
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works in most browsers, since the
app uses plain scripts (no modules).

**GitHub Pages:** repo Settings → Pages → deploy from the `main` branch root,
and the app will be live at `https://<user>.github.io/digital-soldier/`.

Best in Chrome or Edge (video recording). Firefox works too; Safari can pose
and snapshot but video support varies.

## What you can do

### Pose the soldier
- **Drill positions** panel: one click applies a preset — Attention, Stand at
  ease, Stand easy, Salute, Eyes right/left, Quick march, Double march, Mark
  time, Present (hands), Kneel, T-pose. Presets tween smoothly so you can see
  the movement.
- **Pose — joints** panel: 30+ sliders grouped by body part (head, torso, each
  arm and leg, body position). Positive values mean forward / out / up.
  Double-click a slider label to zero that joint.
- **Copy R→L / L→R / Mirror** buttons duplicate or mirror one side's pose.
- Body position sliders slide the soldier across the parade square, lift him
  (jumps, kneeling) and turn him to face any direction.

### Living motion
- **March on the spot**: ▶ Quick march / ▶ Double with a live tempo slider
  (steps per minute). The realistic figure marches with genuine
  motion-capture Walk/Run clips; the stylized figure uses a procedural gait
  (opposite arm-leg swing, knee lift, body bounce). Record it directly with
  ⏺ Record, or **■ Halt** to freeze and fine-tune with the sliders.
- **Idle life** (Scene panel): breathing, blinking and subtle sway so the
  soldier never looks frozen. It layers on top of any pose and records into
  videos; untick to disable for perfectly still frames.

### Customise appearance
- **Uniform presets**: olive drab, woodland/desert/digital/jungle camouflage,
  ceremonial white, ceremonial red, navy blues.
- Or hand-pick: jacket, trousers, headgear, boots, belt and hair colours,
  camouflage pattern, skin tone, gloves.
- **Headgear**: beret, peaked cap, helmet, patrol cap, or none.
- **Height** and **Build** sliders adjust the figure.

### Snapshots
- **📷 Snapshot PNG** saves the current view at 1×, 2× or 4× resolution.
- Set Background to **Transparent (PNG)** for a cut-out snapshot you can drop
  onto posters/slides, or **Green screen** for chroma-key work.
- Camera: drag to orbit, scroll to zoom, right-drag to pan, plus one-click
  Front/Back/Left/Right/¾/Top views and a turntable spin toggle.

### Videos
1. Pose the soldier, then in **Animation** click **+ Add current pose as
   keyframe**. Repeat for each position in the sequence (e.g. Attention →
   Salute → Attention).
2. Set each keyframe's **Move** (transition seconds) and **Hold** time.
   **▶ Play** previews it; **⟳ Loop** repeats.
3. In **Snapshots & video**, click **⏺ Record sequence** — it plays the
   sequence once and saves a `.webm` video automatically. Or use plain
   **⏺ Record** to capture everything you do live (slider moves, orbiting,
   preset clicks) until you press stop.

`.webm` files play everywhere modern and import into any video editor. If you
need `.mp4`: `ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4`, or any
online converter. (Browser-recorded `.webm` sometimes shows an unknown
duration in players; remuxing fixes it: `ffmpeg -i in.webm -c copy out.webm`.)

### Save your work
**💾 Save project** downloads a JSON file with the pose, appearance and
keyframes; **📂 Load project** restores it. Handy for building a library of
drill positions and sequences.

## Repo layout

| Path | What |
| --- | --- |
| `index.html` | app shell |
| `js/soldier.js` | articulated figure: joint registry, body build, appearance/camo system |
| `js/poses.js` | preset drill positions (add your own here — they appear as buttons) |
| `js/animation.js` | pose tweening + keyframe timeline |
| `js/motion.js` | idle life layer (breathing/blinks) + procedural march gait |
| `js/human.js` | rigged human figure: bone mapping, mocap march clips |
| `js/capture.js` | PNG snapshots + MediaRecorder video |
| `js/ui.js` | control panel construction and wiring |
| `js/main.js` | scene, lights, ground, render loop |
| `vendor/` | Three.js r147, OrbitControls, GLTFLoader + the rigged soldier model (licences included) |
| `dist/digital-soldier-standalone.html` | the whole app in one file |
| `scripts/build-standalone.mjs` | rebuilds the standalone file (`node scripts/build-standalone.mjs`) |

## Adding your own drill position

Edit `js/poses.js` and add an entry — it shows up as a button automatically:

```js
'Port arms': {
  'armR.swing': 40, 'armR.elbow': 100,
  'armL.swing': 35, 'armL.elbow': 110,
},
```

Tip: pose the soldier with the sliders, **💾 Save project**, and copy the
non-zero values from the saved JSON.

## Ideas / not yet included

- Rifle & sword props (present arms, order arms)
- Multiple soldiers for squad formations
- Drag limbs directly in the viewport
- GIF export

Licence: app code MIT; Three.js is MIT (see `vendor/LICENSE-threejs.txt`).
The rigged human model is the "Vanguard" character from the three.js
examples / Adobe Mixamo (see `vendor/LICENSE-soldier-model.txt`).
