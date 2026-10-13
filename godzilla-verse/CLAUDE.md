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
bun run bench        # perf gate: generate the real city, mesh all of it, print sizes + timings
                     # (`bun run bench synthetic` = the phase-2 box-tower world)
                     # (browser checks: see "Browser checks" below — bench/*.mjs, need Node >= 20)
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
| 3 Player + physics + camera shell + block editing | **done** |
| 4 The city (generator, sky, fog, lighting, loading screen) | **done** |
| 5 ODM gear + swing camera | **done** |
| 6 Kaiju rigs + placeholder carving (destruction seam, beams, debris/dust, intent contract) | **done** |
| 7 Combat FSM + Director | next |
| 8–10 | see plan |

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

**URL params** (all parsed in `utils/worldSelect.js`): the default world is the **real city** (phase 4);
`?world=test` is the 64x64 engine test world (daytime; what `play-check`/`touch-check` use) and
`?world=synthetic` the phase-2 box-tower perf-gate world; `?time=day|dusk|night` (dusk for the city, day for
the others); `?cam=x,y,z,yawDeg,pitchDeg` starts in the **free camera** at that pose (and `?free=1` starts in
it at the spawn); `?wire=1` starts in wireframe; `?kaiju=0|1` turns the kaiju off/on (on in the city, off in the test worlds); `?gas=limited` turns ODM gas costs back on (unlimited by default); `?workers=0` meshes and generates on the main thread;
`?rd=N` sets the render distance in chunks; `?debug=1|0` forces the debug overlays on/off (off by default on
touch devices). Handy for reproducible screenshots, e.g. the border cube: `?world=test&cam=16,36,44,0,-14`.

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

### Phase 3 — player, physics, camera shell, block editing (what exists)
**You now start as a character on the road** (the free camera is `V`, or `?cam=` / `?free=1`).

| Input | Action |
|---|---|
| click canvas | capture the mouse (Esc releases) |
| WASD / arrows | move, relative to where the camera looks |
| Shift / Space | sprint / jump |
| LMB / RMB | break / place the selected block (hold to repeat) |
| 1–9 or wheel | hotbar |
| F5 | camera: third-person back → first-person → third-person front |
| V / G | free camera / wireframe |
| touch | floating joystick (push past the ring to sprint), drag the right half to look, JUMP / BREAK / PLACE / CAM buttons, tap hotbar slots |

- `utils/physics.js` — `moveBody(world, body, dt)`: swept AABB resolved Y → X → Z against `world.isSolid`,
  **substeps of <= 0.4 m** (no tunnelling at any speed), slides along walls, **auto-step-up**, ceiling
  bumps. Pure, shared by the player now and debris/kaiju feet later. `sweep()` and `bodyOverlapsCell()` are exported.
- `utils/raycast.js` — allocation-free Amanatides & Woo DDA (`raycastVoxel`): used for block targeting
  and the camera's wall pull-in now, grapple anchors and beams later.
- `utils/input.js` — the one mutable `input` object that keyboard, mouse and touch all write into.
  `components/InputController.jsx` owns every DOM listener, pointer lock and the shared yaw/pitch
  (so the player camera and the free camera hand over seamlessly). Mount order is frame order in `App.jsx`:
  input → player → interaction → camera → meshing.
- `components/Player.jsx` (controller + blob shadow), `PlayerMesh.jsx` (box-built Survey-Corps character
  with a walk/air animation driven by the mutable `player` object), `CameraRig.jsx` (F5 modes; the boom is
  pulled in by 5 guard rays — a hard snap in, eased out — so the camera can never end up inside a building),
  `BlockInteraction.jsx` (reach-checked crosshair ray from the *eye*, outline, break/place with cooldowns,
  refuses to place inside the player, bedrock is unbreakable), `Sparks.jsx` (pooled break burst),
  `Hotbar.jsx`, `Crosshair.jsx`, `MobileControls.jsx`, `Lighting.jsx`.
- `constants/playerConfig.js` — all the numbers (walk 6 / sprint 10 m/s, jump 8.6 → ~1.3 blocks,
  gravity 28, boom 4.5, reach 6, hotbar blocks).
- **Deviation from the plan:** auto-step height is **1.0**, not 0.6. A 0.6 step cannot climb a 1-block
  curb, and in a city of raised sidewalks you'd have to jump every kerb.
- **Lighting:** chunks are unlit (baked vertex shading), but the character uses toon materials, which are
  black without lights — `Lighting.jsx` supplies a placeholder day rig (no shadow maps; blob shadow instead).
  Phase 4 retunes it for dusk/night.
- `window.__gv` exposes `{ player, input, camState, target, stats, world, useGame }` for automated checks.

**Verified in phase 3:**
- `bun test`: 61 tests (27 new) — landing/standing without jitter, identical landing at 30 and 144 fps,
  walking across column borders, stopped by a 2-block wall, steps a curb and a staircase, no step-up
  under a low ceiling, wall sliding, no tunnelling at 80 m/s (30 and 20 fps), jump apex, can't jump a
  2-block wall, ceiling bump; raycast faces/normals/distances, negative coordinates, column borders,
  starting inside a block, grid-line skimming.
- `bench/play-check.mjs` — 17 end-to-end checks in a real browser, **stable over repeated runs, in dev and
  in the production build**: spawn + gravity, walk, curb step-up (y reaches exactly 22.00), wall stop
  (x = 20.300 exactly), jump, target, break, remesh after the edit (quad count changes), place, refusing
  to entomb the player, F5 cycling without a reload, free-cam handoff, clean console.
- `bench/touch-check.mjs` — 15 checks with **real touch events** (Chrome DevTools Protocol): controls are
  shown, joystick forward/sprint/release, look pad, JUMP/BREAK/PLACE/CAM buttons, joystick + look pad at once.
- Screenshots reviewed for: the character (it was solid black until `Lighting.jsx`), a mobile layout (the
  debug panels used to cover the buttons, so they're now hidden on touch devices), and the player in the city.

**Not verified:** the real mouse path (headless Chrome can't acquire pointer lock, so `mousedown`/look
deltas were exercised through the shared `input` object rather than real mouse events); how the movement
*feels* on a real GPU/mouse (tuning constants are in `playerConfig.js`); touch on a physical phone.

### Phase 4 — the city (what exists)
**The default world is now the real city.** Dusk over a harbour city: 80 blocks, ~190 buildings, a central park
with the spawn, a bay with a seawall and a suspension bridge to a lighthouse island, a perimeter "Wall Maria"
on the west/north/south, lit windows, neon, street lamps, fog, stars and a moon.

- **Layout** (`constants/cityConfig.js`, all the numbers): 384x384; avenues every 48 (10 wide, k = 0..6),
  streets every 32 (8 wide, m = 0..11); raised 2-wide sidewalks (one block above the road) ring each block and
  lots are inset a further block; the park replaces the 2x2 blocks (and the avenue/street between) at the centre.
  Vertical rhythm: ground slab at `BASE_Y`, a floor slab every 4 blocks (`BASE_Y + 4k`), 3-high air rows
  between, roof slab on a slab row; nothing (spire tips included) above `MAX_TOP = 126`.
- `utils/cityGen.js` — `generateCity(world, { seed, onProgress })`: pure and **deterministic** (same seed →
  byte-identical world), ~35–75 ms. Ground, roads (double-yellow avenues, dashed street lines, zebra crossings on
  every junction arm), block ground, the park (grass, paved paths + plaza, a fountain with a recessed pool and lit
  spout, benches, lamps, ~35 trees: log + cutout leaves), the bay + bridge + island + lighthouse, the wall,
  recursive-BSP lot subdivision, buildings, street lamps. Returns `lotMap` (Uint16Array building id per column —
  replaces a per-voxel id array), `buildings`, `anchors` (roof corners for the phase-5 grapple assist), stats.
- `utils/cityBuild.js` — the 7 archetypes by district (downtown / midtown / outskirts / waterfront weights):
  `boxTower` (0–2 setbacks), `glassSlab` (steel + curtain wall + crown), `setbackDeco` (stepped, pilasters, lit crown,
  spire; the two nearest the park are landmarks), `brickWalkup`, `podiumTower` (storefront podium, fenced terrace,
  curtain tower), `parkingDeck` (open floors, columns, neon), `lowShop` (storefront + neon sign). **Hollow shells**
  with a 3x3 core on tall ones, doors you can walk through, three window styles, and **clustered** lit windows
  (each building picks scattered 2x2 / whole floors / stairwell columns / a bright crown, so facades don't look
  like TV static), plus rooftop AC units, water towers, antennas with warning lights, helipads, penthouses.
- `utils/cityWorker.js` + `utils/cityLoader.js` — generation runs in a Web Worker and streams finished columns
  back as transferables in batches of 48 with progress; `loadCity()` falls back to the main thread (with
  `world.clear()` first) if workers are unavailable or error. `VoxelWorld` gained **bulk mode**
  (`beginBulk/endBulk`: no dirty marking, section counts or height upkeep per write; rebuilt once) and
  `adoptColumn()`.
- **Self-lit blocks:** `EMIT` lookup (lit windows, neon) → the mesher writes a per-vertex `aEmit` byte (11 B/vertex
  now) and full-brightness colour; `chunkMaterial` multiplies a shared `worldTint` colour onto everything *except*
  emissive faces (via `onBeforeCompile`), so dusk/night darken the city while windows keep glowing.
- **Time of day** (`constants/skyConfig.js`): `SKY_PRESETS` day/dusk/night drive the sky, fog, background, tint, water
  and the lights on lit objects. `Sky.jsx` (gradient dome following the camera: sun glow, moon, stars, fbm clouds),
  `Surroundings.jsx` (the bay as a translucent rippling plane over the stone bay floor, plus ground outside the
  wall), `Lighting.jsx`. New blocks/tiles: E–W lane lines, crosswalks, log, leaves (cutout), neon, planks, pool.
- `LoadingScreen.jsx` — title card + progress bar driven by `city.pct`/`city.label` while generating, then by the
  mesh queue; the player waits for `city.generated` and the screen fades once the area around the camera is meshed
  and quiet (`city.ready`). `window.__gv.city` exposes it.
- **Perf (`bun run bench`, the real city):** 1 173 filled sections / 1.33 M quads / 71 MB packed in total; generate
  35 ms; mesh everything 175 ms (0.15 ms/section, worst 2.8 ms); **render ring at the spawn: 44 MB** (plan: ~50 MB),
  downtown 42 MB. In a browser (software GL): ~313 draw calls from the spawn, 724 sections, worker generation +
  streaming ~400–600 ms. Real-GPU frame rate is still unmeasured.
- **Known limitations:** the bay is a plane, not water — falling in lands you on the bay floor under it (no
  swimming); `?time=` is fixed per load (no cycle); sections beyond the wall are void under the sky haze.

**Verified in phase 4:** `bun test` 78 tests (17 new): generator determinism, every archetype present, height
ceiling, spawn clearance + a physics walk from the spawn to the fountain, buildings never on roads/park and the lot
map agrees, every enclosed building has a walkable door, window/lit ratio, a continuous bridge over open water,
wall/park/road details, anchors are real roof corners, emissive/cutout mesher behaviour. `bench/city-check.mjs`
(15 checks, worker path + main-thread fallback + day/night; passes in dev and in the production build). The Phase 3
`play-check`/`touch-check` still pass. Screenshots reviewed: spawn, aerial skyline, street canyon, bridge, wall,
night park, day. **Bugs found on the way:** `?cam=` placed the wrong camera (drei swaps in its own default camera
after mount — place on the first frame instead); anchors floated in the air on setback towers (now the highest
solid at each footprint corner); bulk `fillBox` recounted 8 192 voxels per call (now deferred to `endBulk`).

### Phase 5 — ODM gear + swing camera (what exists)
Attack-on-Titan style 3D manoeuvre gear: two hooks, a rope you swing on, reel, boost, air dash, gas.

| Input | Action |
|---|---|
| hold Q / E | fire and hold the left / right hook (release to let go) |
| Ctrl or R | reel in |
| Space | jump on the ground; **boost** while roped and airborne |
| F | air dash (one per airtime) |
| touch | L HOOK / R HOOK / REEL (hold), DASH, plus the existing JUMP / BREAK / PLACE / CAM |

- `utils/odm.js` — pure, no browser: `createOdm`, `odmUpdate` (per frame: firing, releasing, upkeep, reel, pump,
  boost, dash, drag, speed cap, gas) and `odmConstraint` (the rope, run **inside every physics substep** through
  `body.constraint`, which is what keeps a 55 m/s swing stable instead of stretching then snapping back).
  `constants/odmConfig.js` has every number (gas costs, speeds, windows).
- **The rope is a hard distance constraint, not a spring**: if the body is further than the rope length from the
  anchor it is pulled back onto the sphere and *only the outward radial velocity is removed*, so tangential speed is
  preserved exactly. Result: a clean pendulum (peak speed matches sqrt(2·g·h) within 5%), two ropes at once solved with
  3 Gauss–Seidel passes, one-sided (a slack rope does nothing).
- **Reel conserves angular momentum**: shortening the rope scales tangential speed by oldLen/newLen (capped at x1.25 per
  frame) plus a small zip pull. (Found by test: positional projection alone shortens the rope without changing
  velocity, so reeling at the bottom *lost* speed. This is the "pump".)
- **Aim assist**: the crosshair ray goes first; if it misses, 8 rays in a Fibonacci spiral within 7° are tried (smallest
  angle, then nearest). If nothing is hit (aiming at the sky), `snapAnchor` snaps to a roof corner from `city.anchors`
  inside a 25° cone, preferring higher ones — so swinging across the skyline is reliable.
- **Release pop**: let go within 0.25 s after the bottom of the arc (vy crosses from falling to rising) → x1.10
  horizontal speed + a little lift. **Air dash**: 22 m/s along the stick direction (or the camera look), a 0.12 s
  zero-g window (`body.gravityScale`), recharged by landing or firing a hook. **Boost**: 40 m/s² along the direction of
  travel, 55 m/s cap (enforced after gravity too). **Pump**: forward input on the downswing adds speed along the arc.
- **Gas** (100): hook -10, rope upkeep -4/s each, reel -10/s, boost -20/s, dash -18; refills +25/s on the ground after
  0.4 s without spending, +6/s in the air after 1.5 s. At 0 you can't reel, boost or fire (you still swing).
- **Hooks aim high**: every shot is tilted `aimLiftDeg` (12°) above the crosshair, and tries first for a roof corner at least `highSnapRise` (8) above your feet inside a `highSnapDeg` (32°) cone around that lifted aim, then the lifted ray, the plain ray, and the old sky-snap. A rope from above lifts you; one from chest height only drags you sideways.
- **Unlimited gas (default)**: `ODM.unlimitedGas` makes every gas cost a no-op, so the bar stays full; `?gas=limited` brings the costs below back (the unit tests and `odm-check` run with them on).
- **Anchors die with their block**: if the anchored block is destroyed the rope drops (a kaiju beam cutting your rope
  mid-swing is a feature, phase 6+).
- `components/Player.jsx` — controller around it: on the ground you ease to the wanted velocity; **in the air you steer
  by acceleration** (25 m/s², capped at walking speed along the wish direction, x0.35 while roped) so you can nudge a
  swing but never brake it for free; the body leans into the swing and faces the motion; health/score; **fall damage**
  (landing faster than 28 m/s: 2.5 per m/s over), **wall damage** (>25 m/s into a wall), death → respawn at the spawn
  with 2 s of immunity, the camera snapping with you. Score = swing distance / 4 + bonuses (`player.bonus` for later).
- `components/Ropes.jsx` (8 cylinder segments per rope, slack sag, a ~0.07 s shoot animation, a glowing anchor marker),
  `PlayerMesh` (arms reach toward the anchor), `Hud.jsx` (HEALTH + GAS bottom-left, SCORE top-centre, a red vignette
  on damage; polled at 10 Hz).
- **Camera feel** (`components/CameraRig.jsx`, `utils/shake.js`): the boom's pivot **lags more the faster you go** (smooth
  time 0.07 → 0.22 s) and leads along the velocity; **FOV opens with speed** (70° → ~94°) with a 14° punch on a dash;
  the view **banks into turns** (roll from the heading's rate of change, ±12.6°); the boom lengthens at speed but is still
  pulled in by the voxel rays; when swinging fast and not touching the mouse it **auto-follows** the motion; **trauma
  shake** (landings, wall hits, hook attach, dash) applied last. Everything is tuned from `constants/odmConfig.js` /
  `playerConfig.js`.
- **Deviations from the plan**: gas costs are lighter than the plan's (shot -10, not -25) so swinging is sustainable;
  reel is Ctrl **or R** because Ctrl+W/S/etc. are browser shortcuts.

**Verified in phase 5:** `bun test` 109 tests (31 new): the rope never stretches, it is a real pendulum (peak speed =
sqrt(2gh), far side nearly as high, planar), 30 fps agrees with 144 fps, two ropes hold both lengths, no tunnelling into
a wall at 40 m/s, the constraint removes only outward velocity, reel speeds you up and respects the minimum length, boost
costs gas and respects the cap, no gas = no boost/reel/hook, dash once per airtime and recharges on landing, release pop
only near the bottom of the arc, anchors (centre ray, assist cone, snap assist), destroyed anchor drops the rope, gas
rules, trauma shake. `bench/odm-check.mjs` (17 checks in the real city): finds a tall building, fires a hook onto it,
costs gas, the rope never stretches (worst overshoot 0.000), reel lifts you, a free-air swing with boost reaches 34 m/s,
FOV opens 70.7° → 79.2°, swinging scores, F dashes, a long fall costs health, dying respawns. The phase 3/4 checks still
pass (`play-check`, `touch-check` incl. the new buttons, `city-check`).

**Not verified (needs hands):** how the swing *feels* — whether the numbers (speeds, gas, camera lag, FOV, auto-follow,
bank) suit you. Everything is one file of constants; tell me what to change. Real-mouse input is still untested
(headless Chrome can't pointer-lock). The roll sign was reasoned, not seen: if the view banks *away* from turns, flip the
sign of `rollTarget` in `CameraRig.jsx`.

### Phase 6 — kaiju (what exists)
Godzilla and King Ghidorah now live in the city. They **wander** (heading for buildings, not fighting yet — that is phase 7),
stomp, smash what they walk through, and fire their weapons at buildings. `?kaiju=0` turns them off.

- **Intent contract** (`utils/kaiju/controller.js`): a brain produces *intent* `{moveX, moveZ, faceYaw, wantBeam, wantMelee,
  wantGrab, wantRoar, wantDash, clashPressure}`; `KaijuController` turns it into locomotion (heavy: turn limits, slows to
  fire), the weapon state machine (idle → charging → firing → cooldown, `motion.charge` 0..1), gait footfalls, hover/flap,
  and *events* (footfall, carve, weapon). `utils/kaiju/brain.js` `WanderBrain` is the phase-6 AI; the phase-7 combat brain
  and the phase-9 player controller are drop-in replacements. Pure, no THREE.
- **Destruction seam** (`utils/destruction.js`): `applyDamage({ shape: sphere | capsule | cylinder | flatten, ... })`. Phase 6
  implements it with carving (ragged rim, never carves bedrock or below `minY`), a **FIFO budget** (1 500 voxels/frame) so a beam
  "eats" through a tower over a few frames and nothing can stall one, per-building integrity from the city's lot map, and a
  scripted **top-down collapse** when a building drops below 35% of its voxels. Removed voxels (`rx/ry/rz/rid`) feed the debris.
  Phase 10 swaps real physics in behind the same signature.
- **Rigs** (`utils/kaiju/rigKit.js`, `rigParts.js`, `rigAnim.js`): authored ~7 units tall, root scaled x10 (~70 blocks). Every
  box/cone of a joint is merged into one geometry with vertex colours (pebbled hide noise) plus two per-vertex attributes,
  `aGlow` (vein / plate / eye) and `aSpine` (0 tail tip → 1 head). `kaijuMaterial` is a toon material whose emissive comes from
  those and three uniforms driven by the one number `motion.charge`: **plates light in a wave from tail to head**, veins and
  eyes follow, the head rears back, the jaw opens, then it thrusts forward to fire. Godzilla: 3 rows of dorsal plates, 8-segment
  tail, charcoal hide / pale belly / icy-blue plates. Ghidorah: gold, 3 necks × 3 segments + heads (own phases), 2 bat wings
  (shoulder + elbow), 2 tails, crest and cracks that light with the charge. Outlines only on joints > 0.9 radius (each outline
  is another draw call); the whole kaiju is one frustum-cull unit.
- **Effects** (`components/kaiju/`): `KaijuPair` (the sim + event handling), `KaijuRig`, `Beams` (atomic breath: three nested
  additive cylinders white → cyan → blue, charge ball, impact glow, 2 permanent point lights; lightning: instanced stretched
  boxes, gold body + white core), `Debris` (2 048 tinted cubes, ballistic + bounce on the height map), `Dust` (512 camera-facing
  puffs). The jaw and the beam impact also light the *unlit chunks* through two point glows in `chunkMaterial` (`worldGlow`).
- **Weapons**: atomic breath = DDA beam from the jaw (length stops at the first block), head sweeps ±30°, a bore every 70 ms at
  the impact point. Gravity lightning = 3 heads × a strike every 0.3 s (midpoint-displaced bolts, a blast sphere each; 22% of
  strikes aim near the player). Footfalls knock chunks out of whatever stands at street level (the ground itself is never destructible), shake the camera, hurt a player within 10 blocks.
- **Constants**: `constants/kaijuConfig.js` (everything tunable). Godzilla spawns north of the park walking south; Ghidorah hovers
  at ~86 blocks over the west side.
- Hooks for checks: `window.__gv.kaiju` (`list[{ctl, brain}]`, `destruction`, `stats`), `__gv.fx`, `__gv.forceBeam(i)`.

**Verified in phase 6:** `bun test` 175 tests (66 new: kaiju controller/intent contract, destruction budget + collapse, weapon
maths, rig geometry/attributes/pose), plus `bench/kaiju-check.mjs` (22 checks in the real city, dev and production build): both
kaiju exist and move, footfalls stomp and hurt a player standing there, a body walked through a building drops it below 35% and
collapses it, the breath charges → fires → stops at a building and bores into it → switches off, Ghidorah's bolts strike the city,
debris is thrown, clean console, `?kaiju=0` really turns it off. `bench/kaiju-shots.mjs` writes free-camera screenshots (reviewed:
Godzilla in profile with glowing plates/veins and the beam, Ghidorah's silhouette and lightning). The phase 3–5 checks still pass
(city/odm checks now load with `?kaiju=0`).

**Perf (software GL, numbers from `bench`/checks):** the kaiju add ~67 draw calls when both are in view (17 + 25 merged joint
meshes + ~15 outlines + effects pools); downtown looking at them lands at **430–510 total** (chunks 264–400 + kaiju + player/ropes)
— above the plan's 450 *target*, so the check's ceiling is 540. Knobs if a real GPU needs it: kaiju outlines off (−15), `?rd=9`
(−60), fewer tail/neck segments. Destruction: ≤1 500 voxel removals/frame; a collapse removes a 14×14×40 building in 0.5 s.

**Not verified (needs a real GPU/hands):** real-GPU frame rate with the kaiju, how the weapons *feel*, whether the kaiju read as
Godzilla/Ghidorah to *you* (judged only from software-GL screenshots at dusk), real-mouse input, a phone, the live FTP deploy.
Known gaps (by design, later phases): kaiju ignore each other and the player (phase 7), no beam clash/bloom (phase 8), no audio or
playable kaiju (phase 9), debris is ballistic cubes and collapse is a scripted top-down shave, not physics (phase 10).

### Browser checks
The gstack `browse` tool cannot create a WebGL context, and Chrome's `--virtual-time-budget` freezes
`performance.now()` (every timing reads ~0). Use the real-time script, which drives Playwright's Chromium
with SwiftShader and waits for the mesh queue to settle:
```bash
~/.nvm/versions/node/v24.13.0/bin/node bench/browser-check.mjs /tmp/out.png "cam=197,112,335,0,-22" 960x600 300
# production build: `bun x vite preview --port 1341` in another shell, then prefix PORT=1341
```
It exits non-zero on any console error/warning (GPU-driver noise excluded). Needs Node >= 20.
Gameplay and touch have their own scripts (same setup, `PORT=1341` for a production preview):
```bash
~/.nvm/versions/node/v24.13.0/bin/node bench/play-check.mjs /tmp/play 800x500   # 17 end-to-end checks (test world)
~/.nvm/versions/node/v24.13.0/bin/node bench/touch-check.mjs /tmp/touch          # touch controls (test world)
~/.nvm/versions/node/v24.13.0/bin/node bench/city-check.mjs /tmp/city            # the real city, 15 checks
~/.nvm/versions/node/v24.13.0/bin/node bench/odm-check.mjs /tmp/odm              # ODM gear in the city, 17 checks
~/.nvm/versions/node/v24.13.0/bin/node bench/kaiju-check.mjs /tmp/kaiju          # both kaiju: stomp, collapse, breath, lightning, 22 checks
~/.nvm/versions/node/v24.13.0/bin/node bench/kaiju-shots.mjs /tmp/kaiju-shots    # free-camera screenshots of both kaiju for review
```
(Run them by **absolute path** or from `godzilla-verse/`; a `cd` into `bench/` breaks the relative path.)
Software GL runs at a few fps and the game clamps dt to 1/30, so simulated time runs slower than wall time:
every wait in these scripts polls for a *condition*. Two rules learned the hard way — after a teleport, wait for
a target that has held still across two samples (`stableTarget`), and after dispatching a touch event, poll for
the resulting state rather than reading once (the main thread is busy rendering).

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
