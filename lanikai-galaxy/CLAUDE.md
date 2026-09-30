# CLAUDE.md — lanikai-galaxy

A 3D "Super Mario Galaxy"–style little planet themed as Hawaii's windward
O'ahu: a third-person character walks a small spherical island with Lanikai
Beach's powder sand and turquoise lagoon on one side and Kualoa Ranch's fluted
green cliff walls boxing in a valley on the other. Bright, saturated,
cel-shaded "Wii Sports Resort" look. Scenic-only v1: terrain, scenery and music
zones — no notes, photos, NPC or hidden surprise yet.

Sibling of `camille-galaxy/` (same engine, re-skinned). Deployed to the
`/lanikai` route of the SnappyCamille host (static SPA over FTP).

## Stack
Vite + React 18 + React Three Fiber (`@react-three/fiber`, `@react-three/drei`),
`three`, `zustand` (shared state), `maath` (frame-rate-independent smoothing).

## Commands
```bash
npm run dev          # dev server on http://localhost:1339/lanikai/
npm run build        # static build to build/
npm run build:deploy # build -> copy to ../public/lanikai -> ../deploy.sh (FTP)
```
`vite.config.js` sets `base: '/lanikai/'`; runtime assets load from
`import.meta.env.BASE_URL` so they resolve under the subpath.

## Shared with camille-galaxy (copied, not linked)
These are verbatim copies — if you fix a bug in one project, port it to the other:
`utils/sphere.js`, `utils/toon.js`, `hooks/useSphereWalker.js` (only its
collider import path differs: `islandLayout`), `useKeyboardControls.js`,
`useProximityNote.js`, `useAudio.js`, `components/FollowCamera.jsx`,
`Character.jsx`, `Player.jsx`, `Anchor.jsx`, `AudioController.jsx`,
`ui/Hud.jsx`, `ui/MobileJoystick.jsx`, `store.js`. `ui/IntroScreen.jsx` differs
only in its title/copy/colors.

## How it works
- **Spherical walking / follow camera** — identical to camille-galaxy:
  `posDir` unit vector + `heading` in `store.js`, great-circle motion in
  `useSphereWalker.js`, orbiting smoothed-up camera in `FollowCamera.jsx`.
- **Terrain** — `src/utils/terrain.js`, an ANALYTIC height function (mesh,
  feet and Anchors all sample it; no raycasts). Everything is laid out in
  *ocean-polar* coordinates: `d` = arc angle from the ocean center, `θ` =
  azimuth around it (θ=0 points at the spawn, +θ = east). `oceanPolar`,
  `polarToDir`, `polarToLatLon` convert.
  - `d < SHORE (0.9)` — the lagoon: flat at height 0.
  - `SHORE..BEACH_END (1.18)` — Lanikai Beach: low, near-flat sand band (the
    villa-style flat mask), then a smoothstep ramp to land by `LAND_FULL`.
  - Land = low sine "pasture" + `RIDGES` + a far-side peak. Each ridge is an arc
    of constant `d` (with a slow wobble) from `t0` to `t1`; its cross-section is
    a sheer wall (`CREST`→`WALL`) over a gentle talus skirt (`SKIRT`), with a
    jagged crest (two sines along the ridge), tapered prow ends, and vertical
    **flutes** carved mid-face every `FLUTE_PERIOD` m — the Kualoa pali look.
    Ridges combine by `max`. The "Kualoa Pali" (d=1.66) stands right behind the
    beach pasture; "Ka'a'awa Ridge" (d=2.32) closes the far side of the valley;
    both have open ends so you walk around them. A walkable 12m peak crowns
    the antipode of the ocean (`PEAK`).
  - Color factors: `coastFactors` (water / deep / reef / foam / sand / wet) and
    `cliffFactors` (wall / flute).
- **Planet coloring** — `Planet.jsx` paints everything into vertex colors (like
  camille's road stripe): pasture greens, jungle-green cliff faces with red-dirt
  flutes, sand + wet sand, turquoise shallows with reef patches → deep blue, and
  a white surf line + broken reef-break line. `MeshLambertMaterial` on purpose:
  Standard's grazing Fresnel washed the water out to pale mint. Mesh is
  320×240 so cliffs and the round shoreline don't alias.
- **Water** — `Water.jsx`: a separate transparent ShaderMaterial cap (radius
  `SHORE + 0.1` around `OCEAN_DIR`, mounted after `<Planet />`) laid over the
  painted lagoon, which stays the base color. Vertex: gentle 3-sine swell along
  the sphere normal plus a travelling crest; past the waterline it hugs a GLSL
  mirror of the beach height (keep in sync with `terrainHeight`'s beach terms).
  Fragment: shallow→deep tint/opacity (the `coastFactors` `deep` ramp), toon
  diffuse, tinted fresnel rim, cel sun highlight and dot-product-sine sparkles.
  Wave cycle (`uPeriod` 6s): a front runs from `SHORE-0.14` to `SHORE+0.08`
  with a crisp foam cap that brightens toward shore, a swash sheet on the sand,
  and wet-sand darkening that sets when the front arrives and dries before the
  next one. Decorative only (no raycast, colliders untouched).
- **Collision** — `CIRCLE_COLLIDERS` in `constants/islandLayout.js`: one big cap
  over the ocean (radius just inside the waterline, so you can stand in the
  surf but never wade out), plus a chain of circles every ~2m along each ridge
  (`RIDGE_COLLIDE` = 4.4m) so the walker slides along the cliff base instead of
  climbing the wall. `RECT_COLLIDERS` is kept (empty) for walker parity.
- **Scenery** — `Island.jsx` renders `TREES` (deterministic hash scatter in
  `islandLayout.js`: palm fringe rows at the back of the sand leaning out toward
  the water via `yawToward(OCEAN_DIR)`, an ironwood windbreak behind, a few
  trees in the valley and around the peak; kept off the cliffs and ~9.5m clear
  of the spawn so the trailing camera isn't blocked) and `ISLETS` —
  Mokoli'i ("Chinaman's Hat") cone and the twin Na Mokulua, as backdrop-only
  lathed toon meshes sitting in the blocked ocean (bent to the planet
  curvature so their bases meet the water, with a surf ring).
  Tree/islet meshes live in `components/island/` (`Trees.jsx` merges each tree
  into 2–3 shared geometries = 2–3 draw calls per tree).
- **Sky** — `SkyDome.jsx`: a gradient ShaderMaterial keyed to the *player's*
  local up (pale horizon / saturated blue zenith wherever you stand), ~20 big
  fluffy cel-shaded 3D cumulus clusters slowly drifting on a shell around the
  planet, and a white sun disk at `SUN_DIR` (a high tropical-noon sun above the
  beach). `Lighting.jsx`: near-white key sun along `SUN_DIR` (shadows), a soft
  opposite-side bounce light so the far side isn't night, hemisphere fill, and
  drei's `park` Environment.
- **Wildlife** — decorative dinos (Kualoa is a Jurassic Park location), mounted
  in `App.jsx` after `<Island />`; no collision, no interaction. Meshes +
  wrappers live in `components/creatures/`, all toon-shaded with
  `toonGradient` + `addOutlines` like `Character.jsx`.
  `RaptorPack.jsx` drives 4 mini `Raptor.jsx`es (capsule/cone/rounded-box,
  animated legs/tail/head from a mutable `motion` {speed, idle}): each picks a
  target 3–20m away (biased to within 12m of the pack centroid), walks or
  sprints there by rotating its `pos` unit vector about `pos × target` (the
  walker's great-circle step), pauses, repeats. Feet sit on
  `terrainHeight(dir)`. Walkable = `d ≥ BEACH_END + 0.1` and
  `ridgeDistance ≥ 6.5m`; every leg's whole path is sampled (0.8m) before it
  is accepted, target search is bounded (28 tries, else a short pause), so they
  never enter sand/water or climb the pali. They spawn in the pasture behind
  the beach (`HOME`) and roam from there (valley, ridge ends, peak).
  `PterodactylFlock.jsx` flies 3 `Pterodactyl.jsx`es on `FLIGHTS`: circle or
  figure-8 loops laid out in the tangent plane at a center and exp-mapped onto
  a shell 20–23m up (tallest crest ≈17m), facing along the path, banking by the
  signed turn rate, alternating flaps and glides (hinged extruded-slab wings,
  the right one inside a scale-x(-1) mirror).
- **Music zones** — `useAudio.js` + `zoneConfig.js` (Lanikai Beach, Kualoa
  Valley, Mokoli'i Point, Ranch Uplands); identical mechanism to camille-galaxy.

## Editing content
- Geography (shore/beach radii, ridge arcs + heights, peak): `src/utils/terrain.js`
- Trees, islets, colliders: `src/constants/islandLayout.js`
- Music zones + song filenames: `src/constants/zoneConfig.js`
- Music files: `public/audio/` (placeholder names listed in its README)
- Palette: `src/components/Planet.jsx`; sky/clouds: `SkyDome.jsx`
- Dinos: pack size / home / speeds / walkable margins at the top of
  `components/creatures/RaptorPack.jsx`; flight loops in `FLIGHTS` in
  `PterodactylFlock.jsx`; colors in `RAPTOR_PALETTES` / `PTERO_PALETTES`
- World scale / speeds / camera feel / spawn: `src/constants/worldConfig.js`

## TODO / future
- Real songs for the four zones.
- Personal content (notes, photo frames, greeting NPC, hidden surprise) — the
  camille-galaxy components can be ported; `useProximityNote` is already here.
- A rock arch like the Wii Resort cove.
- Camera-collision pull-in near palms and cliffs (the trailing camera can end
  up inside a palm crown in dense spots).
- A sand path into the valley; jet ski / flyover modes are out of scope for now.
- Dinos are purely decorative: they ignore the player and walk through trees.
  Possible next steps are having them scatter or follow when she gets close, and
  adding a "pack home" pull so the raptors drift back toward the beach pasture.
