// ODM gear end-to-end in the real city (real browser, software WebGL): hooks, rope, reel,
// swing, boost, dash, FOV, HUD, fall damage, death and respawn.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/odm-check.mjs [outDir]
//   (dev server on :1340, or PORT=1341 for a production preview)
//
// Software GL is slow and the game clamps dt, so every wait polls for a condition.
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);
const outDir = process.argv[2] || '/tmp/odm-check';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const problems = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gv = (fn, arg) => page.evaluate(fn, arg);
async function waitFor(fn, arg, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    await sleep(200);
  }
  return null;
}
const hold = (code) => gv((c) => window.__gv.input.keys.add(c), code);
const release = (code) => gv((c) => window.__gv.input.keys.delete(c), code);
const state = () =>
  gv(() => {
    const g = window.__gv;
    const b = g.player.body;
    const a = g.odm.anchors[1];
    return {
      x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, grounded: b.grounded,
      speed: Math.hypot(b.vx, b.vy, b.vz),
      active: a.active, len: a.len, ax: a.x, ay: a.y, az: a.z,
      dist: a.active ? Math.hypot(b.x - a.x, b.y + 1 - a.y, b.z - a.z) : 0,
      gas: g.odm.gas, health: g.player.health, score: g.player.score, fov: g.camera ? g.camera.fov : 0,
      dashUsed: g.odm.dashUsed,
    };
  });

await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/?kaiju=0`);
await waitFor(() => window.__gv && window.__gv.city.ready);
await waitFor(() => window.__gv.player.body.grounded, null, 30000);

// ---- find a tall building near the spawn and a clear spot on the outside of its nearest corner ----
const plan = await gv(() => {
  const g = window.__gv;
  const sx = 197;
  const sz = 209;
  let best = null;
  for (const b of g.city.buildings) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const d = Math.hypot(cx - sx, cz - sz);
    if (d < 40 || d > 95) continue;
    if (!best || b.y1 > best.b.y1) best = { b, cx, cz };
  }
  const { b, cx, cz } = best;
  const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]];
  corners.sort((p, q) => Math.hypot(p[0] - sx, p[1] - sz) - Math.hypot(q[0] - sx, q[1] - sz));
  const [kx, kz] = corners[0];
  const dx = Math.sign(kx - cx) || 1;
  const dz = Math.sign(kz - cz) || 1;
  const isFree = (x, z) => {
    const top = g.world.topY(x, z);
    return top >= 20 && top <= 21 && [1, 2, 3, 4].every((dy) => !g.world.isSolid(x, top + dy, z));
  };
  for (let r = 14; r <= 30; r += 1) {
    const x = Math.floor(kx + dx * r * 0.7);
    const z = Math.floor(kz + dz * r * 0.7);
    if (isFree(x, z) && isFree(x + 1, z) && isFree(x, z + 1)) {
      return { b, kx, kz, x: x + 0.5, z: z + 0.5, top: g.world.topY(x, z) + 1 };
    }
  }
  return null;
});
check('found a tall building and a clear standing spot outside its corner', !!plan, plan ? `building ${plan.b.id} (${plan.b.archetype}, ${plan.b.floors} floors) corner ${plan.kx},${plan.kz}; stand ${plan.x},${plan.z}` : '');

async function stand() {
  await gv((p) => {
    const g = window.__gv;
    Object.assign(g.player.body, { x: p.x, y: p.top + 0.05, z: p.z, vx: 0, vy: 0, vz: 0 });
    // aim at the building's top corner from the eye
    const dx = p.kx + 0.5 - p.x;
    const dz = p.kz + 0.5 - p.z;
    const dy = p.b.y1 - (p.top + 1.62);
    g.input.yaw = Math.atan2(-dx, -dz);
    g.input.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 0.9;
  }, plan);
  await waitFor(() => window.__gv.player.body.grounded, null, 30000);
  await sleep(1200); // let the camera settle on the new pose
}

// ============ fire a hook ============
await stand();
const s0 = await state();
await hold('KeyE');
const attached = await waitFor(() => window.__gv.odm.anchors[1].active, null, 30000);
const s1 = await state();
check('E fires the right hook and it sticks', !!attached);
const near = plan && attached ? Math.hypot(s1.ax - Math.max(plan.b.x0, Math.min(s1.ax, plan.b.x1 + 1)), s1.az - Math.max(plan.b.z0, Math.min(s1.az, plan.b.z1 + 1))) : 99;
check('...onto the building (within a block of its footprint)', near < 1.6 && s1.ay > 30, `anchor ${s1.ax?.toFixed(1)},${s1.ay?.toFixed(1)},${s1.az?.toFixed(1)}`);
check('...and it costs gas', s1.gas < s0.gas - 5, `${s0.gas.toFixed(0)} -> ${s1.gas.toFixed(0)}`);
await page.screenshot({ path: `${outDir}/1_hooked.png` });

// the rope is a hard constraint: sample it for a while
let worst = 0;
for (let i = 0; i < 25; i++) {
  const s = await state();
  if (s.active) worst = Math.max(worst, s.dist - s.len);
  await sleep(120);
}
check('the rope never stretches (distance <= length + 0.1)', worst < 0.1, `worst overshoot ${worst.toFixed(3)}`);

// ============ reel up ============
const yStart = s1.y;
const lenStart = s1.len;
await hold('KeyR');
const rose = await waitFor((y0) => window.__gv.player.body.y > y0 + 8, yStart, 90000);
const s2 = await state();
await page.screenshot({ path: `${outDir}/2_reeling.png` });
await release('KeyR');
check('R reels you up toward the anchor (you rose and the rope shortened)', !!rose && s2.len < lenStart - 3, `y ${yStart.toFixed(1)} -> ${s2.y.toFixed(1)}, len ${lenStart.toFixed(1)} -> ${s2.len.toFixed(1)}`);
check('the HUD shows health, gas and score', await gv(() => /HEALTH/.test(document.body.innerText) && /GAS/.test(document.body.innerText) && /SCORE/.test(document.body.innerText)));

// ============ let go ============
await release('KeyE');
const dropped = await waitFor(() => !window.__gv.odm.anchors[1].active, null, 15000);
check('releasing E lets go of the rope', !!dropped);
await waitFor(() => window.__gv.player.body.grounded, null, 90000); // come back down (may take fall damage)
await sleep(500);

// ============ swing + boost: FOV opens with speed, the rope still holds ============
// (Hook firing was covered above. A hook on a building FACADE swings you straight into that wall,
// which is correct but isn't a free swing, so for the swing physics anchor to a block in open air
// above the park path and hang the player off it.)
await gv(() => {
  const g = window.__gv;
  const b = g.player.body;
  const a = g.odm.anchors[1];
  const ax = 197;
  const ay = 95;
  const az = 209;
  g.world.setBlock(ax, ay, az, 14); // a steel block floating over the path
  const len = 34;
  Object.assign(a, { active: true, held: true, x: ax + 0.5, y: ay, z: az + 0.5, bx: ax, by: ay, bz: az, len, len0: len, age: 1 });
  // hang to the side and below, at rest, on the rope's sphere
  b.x = ax + 0.5 + len * 0.8;
  b.z = az + 0.5;
  b.y = ay - len * 0.6 - 1;
  b.vx = b.vy = b.vz = 0;
  g.player.snapCam = true;
  g.input.yaw = Math.PI / 2; // look along the swing
  g.input.pitch = -0.2;
});
await hold('KeyE'); // keep the hook "held" so the update doesn't release it
await hold('Space'); // boost while roped and airborne
let peak = 0;
let peakFov = 0;
let overshoot = 0;
const baseFov = (await state()).fov;
// Simulated time runs far slower than wall time here (a few fps, dt clamped), so sample until the
// swing has actually built up speed rather than for a fixed number of samples.
{
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < 150000) {
    const s = await state();
    if (s.active) overshoot = Math.max(overshoot, s.dist - s.len);
    peak = Math.max(peak, s.speed);
    peakFov = Math.max(peakFov, s.fov);
    if (!shot && s.speed > 20) {
      shot = true;
      await page.screenshot({ path: `${outDir}/3_swinging.png` });
    }
    if (peak > 34 && peakFov > baseFov + 4) break;
    await sleep(120);
  }
}
await release('Space');
const sw = await state();
check('swinging with boost reaches real speed', peak > 18, `peak ${peak.toFixed(1)} m/s`);
check('...never above the 55 m/s cap', peak <= 55.5, `peak ${peak.toFixed(1)}`);
check('...and the rope still never stretches', overshoot < 0.15, `worst overshoot ${overshoot.toFixed(3)}`);
check('the FOV opens up with speed', peakFov > baseFov + 3, `fov ${baseFov.toFixed(1)} -> ${peakFov.toFixed(1)}`);
check('swinging earns score', sw.score > 0, `score ${sw.score}`);

// ============ air dash ============
await release('KeyE');
await waitFor(() => !window.__gv.odm.anchors[1].active, null, 15000);
await gv(() => {
  const g = window.__gv;
  Object.assign(g.player.body, { x: 197, y: 70, z: 209, vx: 0, vy: 0, vz: 0 });
  g.odm.dashUsed = false;
  g.odm.gas = 100;
  g.input.pitch = 0;
});
await sleep(400);
const d0 = await state();
await page.keyboard.press('KeyF');
const dashed = await waitFor(() => window.__gv.odm.dashUsed, null, 10000);
await sleep(200);
const d1 = await state();
check('F dashes in the air (once), costing gas', !!dashed && d1.speed > 12 && d1.gas < d0.gas - 10, `speed ${d1.speed.toFixed(1)}, gas ${d0.gas.toFixed(0)} -> ${d1.gas.toFixed(0)}`);
await waitFor(() => window.__gv.player.body.grounded, null, 90000);

// ============ fall damage and death ============
await gv(() => {
  const g = window.__gv;
  g.player.health = 100;
  g.player.invulnerable = 0;
  Object.assign(g.player.body, { x: 197, y: 52, z: 209, vx: 0, vy: 0, vz: 0 });
});
await waitFor(() => window.__gv.player.body.grounded && window.__gv.player.body.y < 21.5, null, 90000);
await sleep(300);
const f1 = await state();
check('a long fall hurts (health drops but you survive)', f1.health < 95 && f1.health > 20, `health ${f1.health.toFixed(1)}`);

await gv(() => {
  const g = window.__gv;
  g.player.health = 1;
  g.player.invulnerable = 0;
  Object.assign(g.player.body, { x: 230, y: 60, z: 215, vx: 0, vy: 0, vz: 0 });
});
const respawned = await waitFor(() => window.__gv.player.health === 100 && Math.hypot(window.__gv.player.body.x - 197, window.__gv.player.body.z - 209) < 3, null, 90000);
check('dying respawns you at the spawn with full health', !!respawned);

check('no console errors or warnings', problems.length === 0, problems.slice(0, 3).join(' | '));
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`screenshots in ${outDir}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
