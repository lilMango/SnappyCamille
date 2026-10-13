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
bun test             # mesher, voxel-world and mesh-manager unit tests (bun's runner; no WebGL needed)
bun run bench        # perf gate: build the 384x384 synthetic city, mesh it, print sizes + timings
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
| 2 Worker meshing + AO + cutout pass + budgets (+ perf gate) | **done** |
| 3 Player + physics + camera shell + block editing | next |
| 4–10 | see plan |

### Phase 0 — what exists
- `src/utils/atlas.js` — the real procedural texture atlas (17 tiles, 16 px content in
  20 px cells with a 2 px edge-replicated gutter, `tileUV(name)` insets half a texel).
  Phase 1's mesher consumes this exact API.
- `src/utils/rng.js` — `mulberry32`, `hash2`, `hash3` (deterministic, stateless hashes).
- `src/utils/toon.js` — verbatim copy from lanikai-galaxy (hero rigs only; never call
  `addOutlines` on voxel chunks).
- `src/utils/pingWorker.js` — pipeline probe: a **module worker** doing a transferable
  `ArrayBuffer` round trip. Kept as the live check; the real mesh worker is `meshWorker.js`.
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
- The gstack `browse` headless browser cannot create WebGL, so use `bench/browser-check.mjs`
  (see "Browser checks" below).
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
  precomputed bounds, shared `MeshBasicMaterial`s (atlas + vertex colours + fog, baked lighting,
  `toneMapped:false`), imperative mesh map with a nearest-first remesh pump (see phase 2).
- `components/ChunkRenderer.jsx` — one `<group>`; chunk meshes are not React children.
- `components/FlyCamera.jsx` + `hooks/usePointerLock.js` — click to capture the mouse; WASD,
  Space/E up, C/Q down, Shift fast, wheel = speed, **G = wireframe**, Esc releases.
- `components/DebugPanel.jsx` + `StatsProbe.jsx` — fps, draw calls, triangles, geometries,
  sections, quads, dirty queue, mesh ms. Reads the mutable `stats` object at ~4 Hz.
- `utils/testWorld.js` — 64x64 crossroads with hollow towers that cross the y=32/64 section
  borders, an open door, rubble, and a floating cube straddling x/y/z borders.

**Debug URL params:** `?cam=x,y,z,yawDeg,pitchDeg` starts the camera there; `?wire=1` starts in
wireframe; `?world=city` loads the 384x384 synthetic city; `?workers=0` meshes on the main thread;
`?rd=N` sets the render distance in chunks. Handy for reproducible screenshots, e.g. the border
cube: `?cam=16,36,44,0,-14`.

**Verified in phase 1:** face counts, outward winding of every triangle, culling across section
borders incl. a cube meeting 8 sections, 32-bit index switch, dirty marking, height tracking
(unit tests); a real render (textures, lit windows, lane lines, seams, hollow interiors, wireframe).

### Phase 2 — worker meshing, AO, budgets, perf gate (what exists)
- `utils/mesher.js` — now with **per-vertex ambient occlusion** (3-neighbour rule; each quad is split
  along the diagonal joining its two *brighter* corners so a dark inside corner doesn't smear), growable
  scratch buffers, and two outputs: `{ opaque, cutout }`.
- **Cutout pass** — `CUTOUT` lookup in `blocks.js`, `B.FENCE` (new `fence` atlas tile, a transparent
  lattice) and `cutoutMaterial()` (alpha-tested, double-sided, no blending so no sorting). A cutout face
  is hidden by an opaque neighbour or by the same block; it hides nothing.
- `utils/meshWorker.js` + `utils/meshPool.js` — 2–4 module workers (`min(4, cores-1)`), 3 jobs in
  flight each. The main thread stays authoritative: it sends an 18x34x18 padded copy as a transferable,
  the worker returns transferable buffers. No SharedArrayBuffer (an FTP host can't send COOP/COEP).
- `utils/chunkMeshManager.js` — the pump:
  - **Ring:** only columns within `renderDist` (10) chunks of the camera are meshed; they're unmeshed
    past `renderDist + 2` (hysteresis). A column that appears inside the ring (edit, streamed
    generation) joins it immediately, not at the next scan.
  - **Budgets:** <= 24 jobs sent and a time-boxed number of geometries uploaded per frame (3 ms; 10 ms
    during a long queue).
  - **Versioning:** every job has an id; a reply is applied only if it's still the latest job for its
    section, so a slow reply can't resurrect a removed/out-of-ring section or overwrite a newer mesh.
  - **Fallback:** if workers are unavailable or one errors, meshing continues on the main thread under a
    4 ms/frame budget and lost in-flight jobs are re-queued.
  - Queues up to 1024 sections are re-sorted nearest-first every frame; bigger bulk queues reuse the
    order for 200 ms. Out-of-ring dirty keys are purged (they remesh in full on activation).
- `utils/syntheticCity.js` + `bench/city.bench.js` — the perf-gate world and its benchmark (`bun run bench`).
- `bench/browser-check.mjs` — real-time software-GL browser check (below).

**Bugs the tests caught (kept as regression tests):** (1) the nearest-first order was cached by queue
*size*, so a different section becoming dirty at the same size was missed for ~200 ms — which would
have made block edits feel laggy; (2) a section in a column created after the last ring scan was dropped
until the next scan (up to 500 ms), which streaming generation in phase 4 would hit constantly.

### Perf gate — 384x384 synthetic city (256 hollow towers, 1 409 filled sections)
Measured with `bun run bench` (CPU, real numbers) and `bench/browser-check.mjs` (browser, software GL).
| | result | plan said |
|---|---|---|
| world generation | ~150 ms (bun), 120–180 ms in browser | 200–400 ms |
| voxel data | 11 MB | ~20 MB |
| mesh the whole city | 194 ms total, 0.14 ms/section, worst 1.3 ms | — |
| vertex layout | 13 B/vertex incl. indices; whole city 104 MB (a float32 layout: 304 MB) | ~10 B/vertex |
| **mid-city, render dist 10 (worst case: full ring)** | 787 sections, 1.16 M quads, **57.3 MB** GPU geometry | ~50 MB |
| draw calls in view | **285** (mid-city), 306 (city edge) | ~300 for chunks, <= 450 total |
| render dist 6 (mobile tier idea) | 219 sections, 347 k quads, 17.2 MB, 120 draw calls | — |

Browser numbers equal the bench numbers exactly (same quad count and MB), so the worker pipeline
produces the same output as the inline mesher, in dev and in the production build.
**Verdict: within the plan** (memory +15% over the estimate; draw calls on target). About 830 k
triangles are drawn per frame mid-city — fine for desktop, heavy for mobile, which is what the smaller
ring is for. **Not measured:** real-GPU frame time and real remesh latency — the software renderer runs
at 3–9 fps and uploads wait for a frame, so its "remesh latency" (80–350 ms) is frame-bound and
meaningless. Measure those on a real GPU before phase 5. If it's too heavy, the planned fallbacks in
order: floor slabs every 8 (halves interior quads), `RENDER_DIST` 8, `SECTION_H` 64, then a
`DataArrayTexture` + greedy mesher.

### Browser checks
The gstack `browse` tool cannot create a WebGL context, and Chrome's `--virtual-time-budget` freezes
`performance.now()` (every timing reads ~0). Use the real-time script, which drives Playwright's Chromium
with SwiftShader and waits for the mesh queue to settle:
```bash
~/.nvm/versions/node/v24.13.0/bin/node bench/browser-check.mjs /tmp/out.png "world=city&rd=6" 960x600 300
# production build: `bun x vite preview --port 1341` in another shell, then prefix PORT=1341
```
It exits non-zero on any console error/warning (GPU-driver noise excluded). Needs Node >= 20.

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
