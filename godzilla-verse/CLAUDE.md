# CLAUDE.md — godzilla-verse

A Minecraft-style voxel city under kaiju siege. The player is a blocky human with
Attack-on-Titan ODM gear (grapple, swing, reel, boost, dash) and a Spider-Man-style
swing camera. Godzilla (MonsterVerse 2019, atomic) and King Ghidorah (MonsterVerse
2019, gold) fight each other across a procedurally generated skyscraper city, tossing
each other into towers and locking beams in a scripted clash. In the final phase,
buildings break loose, topple and shatter with real block physics. The player can also
take control of a kaiju. Free-roam sandbox with a score HUD — no missions.

Sibling of `camille-galaxy/` and `lanikai-galaxy/` (same stack and deploy flow), but a
**flat chunked voxel world**, not a little planet: none of the sphere math is reused.
Deployed to the `/godzilla-verse` route of the SnappyCamille host (static SPA over FTP).

The full design lives in the approved plan (phases 0–10). This file tracks what is
actually built.

## Stack
Vite 5 + React 18 + React Three Fiber (`@react-three/fiber`, `@react-three/drei`),
`three`, `zustand` (discrete UI state), `maath` (frame-rate-independent smoothing).
Later phases add `@react-three/postprocessing` (bloom, phase 8) and
`@dimforge/rapier3d-compat` (destruction physics, phase 10, dynamically imported).

## Commands
```bash
bun install          # first time (bun.lock; same package manager as the siblings)
bun run dev          # dev server on http://localhost:1340/godzilla-verse/
bun run build        # static build to build/
bun run preview      # serve build/ on :1340 — use this to test the subpath + workers
bun test             # mesher + voxel-world unit tests (bun's built-in runner; pure JS, no WebGL)
bun run build:deploy # build -> copy to ../public/godzilla-verse -> ../deploy.sh (FTP)
```
`vite.config.js` sets `base: '/godzilla-verse/'`; runtime assets load from
`import.meta.env.BASE_URL`, and `worker: { format: 'es' }` so module workers resolve
under the subpath. Dev ports: 1337 cnm-world, 1338 camille-galaxy, 1339 lanikai-galaxy,
**1340 godzilla-verse**.

**Never run `build:deploy` / `deploy.sh` from a git worktree.** `deploy.sh` mirrors
`public/` with `--delete`, and untracked folders (e.g. `public/cnm-world/`) don't exist in
a worktree — the deploy would wipe them from the live server. It also needs `.env`, which
lives only in the main checkout. Deploy from the main checkout.

## Build status
| Phase | Status |
|---|---|
| 0 Scaffold + route + pipeline | **done** |
| 1 Voxel core | **done** |
| 2 Worker meshing + packing + AO + budgets (+ perf gate) | next |
| 3–10 | see plan |

### Phase 0 — what exists
- `src/utils/atlas.js` — the real procedural texture atlas (17 tiles, 16 px content in
  20 px cells with a 2 px edge-replicated gutter, `tileUV(name)` insets half a texel).
  Phase 1's mesher consumes this exact API.
- `src/utils/rng.js` — `mulberry32`, `hash2`, `hash3` (deterministic, stateless hashes).
- `src/utils/toon.js` — verbatim copy from lanikai-galaxy (hero rigs only; never call
  `addOutlines` on voxel chunks).
- `src/utils/pingWorker.js` — pipeline probe: a **module worker** doing a transferable
  `ArrayBuffer` round trip. Replaced by `meshWorker.js` in phase 1/2.
- `src/components/AtlasCube.jsx` — a cube whose six faces use six atlas tiles.
- `src/components/ProbeHud.jsx` — shows `base`, `atlas` and `module worker` probe results.
  Glance at it on the live URL: all green means subpath assets + workers work on the host.
- `src/components/GlErrorBoundary.jsx` — without WebGL the thrown renderer error would
  unmount the whole tree (blank page); this shows a message instead.

### Verified in phase 0
- `bun run build` passes; `index.html` and the worker URL are both emitted with the
  `/godzilla-verse/` prefix; page, worker and bundle are served as `text/html` /
  `text/javascript` under the subpath by `vite preview`.
- In a headless browser: atlas probe OK (17 tiles, 320 px) and module-worker probe OK
  (transferable round trip, ~4 ms).
- The gstack headless browser cannot create WebGL. For visual checks use Playwright's
  Chromium directly: `~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
  --no-sandbox --use-angle=swiftshader --use-gl=angle --enable-unsafe-swiftshader --ignore-gpu-blocklist
  --virtual-time-budget=15000 --screenshot=out.png <url>` (software GL, so ~1 fps).
- **Not verified:** the live FTP host. The probe HUD is how to check it after deploying.

### Phase 1 — voxel core (what exists)
- `constants/worldConfig.js` — column 16x16, **4 sections of 32** = 128 tall, `GROUND_Y = 20`,
  padded-copy dims (18x34x18). `constants/blocks.js` — block ids, per-face tiles, `SOLID` /
  `OPAQUE` lookups, `BLOCK_UV` (Uint16 per block per face), baked `FACE_SHADE_U8`.
- `utils/voxelWorld.js` — `VoxelWorld`: `Map` of `Column`s (numeric `colKey`), lazily allocated
  `Uint8Array(8192)` sections indexed `x | z<<4 | y<<8`, `getBlock/setBlock/fillBox`, `topY`,
  `heightTop`, and the dirty `Set`. `markDirtyAround` dirties all 3x3x3 neighbours on a border
  (AO in phase 2 samples diagonals). `buildPadded()` makes the 18x34x18 copy the mesher reads.
- `utils/mesher.js` — **pure** culled-quad mesher (`meshSection(pad)`): no THREE, no DOM, no
  world access, so phase 2 moves it into a worker unchanged. Emits the packed layout
  (Uint8 position / Uint16 UV / Uint8 colour, ~10 B/vertex; Uint32 indices only past 65 535 verts).
- `utils/atlasLayout.js` — pure tile/UV math split out of `atlas.js` so workers don't import THREE.
- `utils/chunkGeometry.js`, `chunkMaterial.js`, `chunkMeshManager.js` — upload packed arrays as-is,
  precomputed bounds, one shared `MeshBasicMaterial` (atlas + vertex colours + fog, baked lighting,
  `toneMapped:false`), imperative mesh map with a nearest-first, time-budgeted remesh pump.
- `components/ChunkRenderer.jsx` — one `<group>`; chunk meshes are not React children.
- `components/FlyCamera.jsx` + `hooks/usePointerLock.js` — click to capture the mouse; WASD,
  Space/E up, C/Q down, Shift fast, wheel = speed, **G = wireframe**, Esc releases.
- `components/DebugPanel.jsx` + `StatsProbe.jsx` — fps, draw calls, triangles, geometries,
  sections, quads, dirty queue, mesh ms. Reads the mutable `stats` object at ~4 Hz.
- `utils/testWorld.js` — 64x64 crossroads with hollow towers that cross the y=32/64 section
  borders, an open door, rubble, and a floating cube straddling x/y/z borders.

**Debug URL params:** `?cam=x,y,z,yawDeg,pitchDeg` starts the camera there; `?wire=1` starts in wireframe.
Handy for reproducible screenshots, e.g. the border cube: `?cam=16,36,44,0,-14`.

**Meshing baseline (bun, test world):** 41 sections / 39 388 quads; ~0.03 ms to build the padded copy
and ~0.07 ms to mesh a typical section; whole test world ~4 ms on the main thread.

**Verified in phase 1:** `bun test` (16 tests: face counts, outward winding of every triangle,
culling across section borders incl. a cube meeting 8 sections, 32-bit index switch, dirty marking,
height tracking); a real render via Playwright's Chromium + SwiftShader (textures, lit windows,
lane lines, seams, hollow interiors, wireframe) with a clean console. Frame rate there is
software-rendered (~1 fps) so it says nothing about real performance — that is the phase-2 gate.

## Conventions (house style)
- **Mutable state outside React.** Per-frame data (player, camera, kaiju, ODM) lives in
  plain module objects; zustand (`useGame`) holds discrete UI state only. HUD bars poll
  the mutable state at ~10 Hz — never a 60 Hz zustand field.
- **Chunk meshes are not React children** (phase 1): one `<group>` that a manager adds
  and removes `THREE.Mesh`es from imperatively.
- **Zero allocation in `useFrame`:** module-scope scratch vectors, `dispose()` geometry
  on swap.
- **Rig + controller split** for creatures (see lanikai `Raptor.jsx` / `RaptorPack.jsx`):
  the rig reads a mutable `motion` object; the controller owns state and writes transforms.
- Copied, not linked, from lanikai-galaxy: `utils/toon.js`, `main.jsx`. If you fix a bug in
  a copy, port it to the other project.
