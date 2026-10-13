// Automated gameplay check in a real browser (software WebGL). Drives the game through the
// keyboard and the window.__gv dev hook, asserts the results, writes screenshots.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/play-check.mjs [outDir] [WxH]
//   (dev server on :1340, or PORT=1341 for a production preview)
//
// Software GL runs at a few fps and the game clamps dt to 1/30, so simulated time runs
// slower than wall time: every wait below polls for a *condition*, never a fixed delay.
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);

const outDir = process.argv[2] || '/tmp/play-check';
const [W, H] = (process.argv[3] || '800x500').split('x').map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const problems = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) problems.push(`console ${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gv = (fn, arg) => page.evaluate(fn, arg);

// poll `fn` (run in the page) until it returns truthy; returns the value, or null on timeout
async function waitFor(fn, arg, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    await sleep(250);
  }
  return null;
}
const settled = () => waitFor(() => window.__gv.stats.dirty === 0 && window.__gv.stats.inFlight === 0);
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });
const body = () =>
  gv(() => {
    const b = window.__gv.player.body;
    return { x: b.x, y: b.y, z: b.z, g: b.grounded };
  });
const hold = (code) => gv((c) => window.__gv.input.keys.add(c), code);
const release = (code) => gv((c) => window.__gv.input.keys.delete(c), code);
// put the player somewhere and let them land
async function teleport(x, y, z, pitch) {
  await gv(
    ({ x, y, z, pitch }) => {
      Object.assign(window.__gv.player.body, { x, y, z, vx: 0, vy: 0, vz: 0 });
      window.__gv.input.yaw = 0;
      if (pitch !== undefined) window.__gv.input.pitch = pitch;
    },
    { x, y, z, pitch },
  );
  await waitFor(() => window.__gv.player.body.grounded, null, 30000);
}

// A crosshair target that has held still for two samples 600 ms apart. Right after a
// teleport the camera pivot is still easing, so the first valid target is about to move,
// and `target` keeps the previous spot until the next frame.
//   mode 'ground'    a block's top face      mode 'underfoot'  ...directly under the player
//   mode 'face'      any face (for placing)
async function stableTarget(mode = 'ground', timeoutMs = 60000) {
  const read = () =>
    gv((mode) => {
      const t = window.__gv.target;
      const p = window.__gv.player.body;
      if (!t.valid) return null;
      if (mode === 'face' ? !(t.nx || t.ny || t.nz) : t.ny !== 1) return null;
      if (mode === 'underfoot' && !(Math.abs(t.x + 0.5 - p.x) < 0.9 && Math.abs(t.z + 0.5 - p.z) < 0.9)) return null;
      return { x: t.x, y: t.y, z: t.z, nx: t.nx, ny: t.ny, nz: t.nz, id: t.id };
    }, mode);
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < timeoutMs) {
    const a = await read();
    if (a && prev && a.x === prev.x && a.y === prev.y && a.z === prev.z) return a;
    prev = a;
    await sleep(600);
  }
  return null;
}

await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/`);
await waitFor(() => window.__gv && window.__gv.world.columns.size > 0 && window.__gv.stats.dirty === 0 && window.__gv.stats.inFlight === 0 && window.__gv.stats.meshes > 20);

// ---------------- spawn / gravity ----------------
const spawned = await waitFor(() => window.__gv.player.body.grounded, null, 30000);
let b = await body();
check('player spawns and settles on the road', !!spawned && Math.abs(b.y - 21) < 0.05, `y=${b.y.toFixed(3)}`);
await shot('1_third_person');

await gv(() => {
  const p = window.__gv.player.body;
  p.y = 70; // drop from above two section borders
  p.vy = 0;
});
await waitFor(() => window.__gv.player.body.grounded && window.__gv.player.body.y < 21.1, null, 60000);
b = await body();
check('falls from y=70 and lands on the road (no tunnelling)', b.g && Math.abs(b.y - 21) < 0.05, `y=${b.y.toFixed(3)}`);

// ---------------- walking, curb, wall ----------------
await hold('KeyW');
// Stop well short of the raised sidewalk (z <= 39): the frame rate varies a lot under software
// GL, so the key can be released a few frames late and the player overshoots by a metre or two.
const walked = await waitFor(() => window.__gv.player.body.z < 44.5, null, 90000);
await release('KeyW');
b = await body();
check('W walks forward (toward -z) on the ground', !!walked && b.g && Math.abs(b.y - 21) < 0.06, `z=${b.z.toFixed(2)} y=${b.y.toFixed(2)}`);

let maxY = 0;
await hold('KeyA'); // strafe -x: up the 1-block sidewalk curb, across the grass, into the tower wall
{
  const t0 = Date.now();
  let lastX = 1e9;
  let stuck = 0;
  while (Date.now() - t0 < 120000) {
    b = await body();
    maxY = Math.max(maxY, b.y);
    stuck = Math.abs(b.x - lastX) < 1e-4 ? stuck + 1 : 0;
    lastX = b.x;
    if (b.x < 20.6 && stuck >= 3) break;
    await sleep(200);
  }
}
await release('KeyA');
b = await body();
check('auto-steps up the 1-block curb (reached y=22 on the sidewalk)', maxY > 21.95, `max y=${maxY.toFixed(2)}`);
check('is stopped by the tower wall at x = 20 + half-width', b.x > 20.28 && b.x < 20.5, `x=${b.x.toFixed(3)}`);
check('is back on the grass after the curb', b.g && Math.abs(b.y - 21) < 0.06, `y=${b.y.toFixed(3)}`);

// ---------------- jump ----------------
await hold('Space');
const jumped = await waitFor(() => window.__gv.player.body.y > 22.1, null, 30000);
await release('Space');
await waitFor(() => window.__gv.player.body.grounded && window.__gv.player.body.y < 21.1, null, 60000);
b = await body();
check('Space jumps (~1.3 blocks) and lands again', !!jumped && b.g && Math.abs(b.y - 21) < 0.06);

// ---------------- break / place ----------------
// open road, facing -z, looking down: the crosshair ray lands on the ground ahead
await teleport(31.5, 21.2, 44.5, -0.85);
const tgt = await stableTarget('ground');
check('crosshair targets a block within reach', !!tgt, tgt ? `${tgt.x},${tgt.y},${tgt.z} id=${tgt.id}` : '');

if (tgt) {
  await settled();
  const quadsBefore = await gv(() => window.__gv.stats.quads);
  await gv(() => (window.__gv.input.breakHeld = true));
  const gone = await waitFor((t) => window.__gv.world.getBlock(t.x, t.y, t.z) === 0, tgt, 30000);
  await gv(() => (window.__gv.input.breakHeld = false));
  check('LMB breaks the targeted block', !!gone);
  await settled();
  const quadsAfter = await gv(() => window.__gv.stats.quads);
  check('the world remeshed after the edit (quad count changed)', quadsAfter !== quadsBefore, `${quadsBefore} -> ${quadsAfter}`);

  // place the selected block against whatever face the crosshair now hits
  await gv(() => window.__gv.useGame.getState().selectHotbar(0)); // brick
  const hit = await stableTarget('face');
  const face = hit && { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
  await gv(() => (window.__gv.input.placeHeld = true));
  const placed = face && (await waitFor((f) => window.__gv.world.getBlock(f.x, f.y, f.z) !== 0, face, 30000));
  await gv(() => (window.__gv.input.placeHeld = false));
  const id = face ? await gv((f) => window.__gv.world.getBlock(f.x, f.y, f.z), face) : 0;
  check('RMB places the selected hotbar block (brick = 11)', !!placed && id === 11, `id=${id}`);
  await settled();
  await shot('2_after_edit');
}

// never entomb yourself: stand on a cell centre and look straight down at your own feet, so
// the cell the crosshair would place into is the player's own cell
await teleport(36.5, 21.2, 40.5, -1.55);
const underHit = await stableTarget('underfoot');
const under = underHit && { x: underHit.x, y: underHit.y + 1, z: underHit.z };
if (under) {
  const overlaps = await gv((c) => {
    const p = window.__gv.player.body;
    return p.x + 0.3 > c.x && p.x - 0.3 < c.x + 1 && p.z + 0.3 > c.z && p.z - 0.3 < c.z + 1 && p.y < c.y + 1 && p.y + 1.8 > c.y;
  }, under);
  await gv(() => (window.__gv.input.placeHeld = true));
  await sleep(3000);
  await gv(() => (window.__gv.input.placeHeld = false));
  const stillAir = await gv((c) => window.__gv.world.getBlock(c.x, c.y, c.z) === 0, under);
  check('refuses to place a block inside the player', overlaps && stillAir, `cell ${under.x},${under.y},${under.z} overlapsPlayer=${overlaps}`);
} else {
  check('refuses to place a block inside the player', false, 'no target under the player');
}

// ---------------- camera modes ----------------
await gv(() => {
  window.__gv.input.pitch = -0.2;
  window.__gv.input.yaw = 0;
});
await sleep(1200);
const startMode = await gv(() => window.__gv.useGame.getState().cameraMode);
await page.keyboard.press('F5');
await sleep(800);
const mode1 = await gv(() => window.__gv.useGame.getState().cameraMode);
const reloaded = await gv(() => !window.__gv);
check('F5 cycles the camera (and does not reload the page)', mode1 === (startMode + 1) % 3 && !reloaded, `mode ${startMode} -> ${mode1}`);
await sleep(800);
await shot('3_first_person');
await page.keyboard.press('F5');
await sleep(1500);
await shot('4_front_view');
await page.keyboard.press('F5');
await sleep(800);
const mode3 = await gv(() => window.__gv.useGame.getState().cameraMode);
check('F5 wraps back to third-person', mode3 === startMode, `mode ${mode3}`);

// ---------------- free camera ----------------
const before = await body();
await page.keyboard.press('KeyV');
await sleep(500);
const free = await gv(() => window.__gv.useGame.getState().freeCam);
await hold('KeyW');
await sleep(2500);
await release('KeyW');
await page.keyboard.press('KeyV');
await sleep(500);
const after = await body();
check('V toggles the free camera', free === true);
check('the player is untouched while free-camming', Math.hypot(after.x - before.x, after.z - before.z) < 0.05 && Math.abs(after.y - before.y) < 0.05);

check('no console errors or warnings', problems.length === 0, problems.slice(0, 3).join(' | '));
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`screenshots in ${outDir}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
