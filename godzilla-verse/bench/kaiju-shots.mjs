// Screenshots of the kaiju for a visual review, from a fixed free camera (software WebGL):
// Godzilla at rest / charged / firing, Ghidorah at rest / charged / lightning.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/kaiju-shots.mjs [outDir] [WxH]
//   (dev server on :1340, or PORT=1341 for a production preview)
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);
const outDir = process.argv[2] || '/tmp/kaiju-shots';
const [W, H] = (process.argv[3] || '1100x680').split('x').map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const problems = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, arg, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    await sleep(250);
  }
  return null;
}

// camera: above the roofs (126), 125 blocks south of the action, looking north and down a little
await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/?cam=197,140,338,0,-13&debug=0&time=${process.env.TIME || 'dusk'}`);
await waitFor(() => window.__gv && window.__gv.city.ready);
await waitFor(() => window.__gv.kaiju.list.length === 2);

await page.evaluate(() => {
  const g = window.__gv;
  const T = (window.__t = {});
  T.script = (i, o) => {
    const k = g.kaiju.list[i];
    k.script = o;
    if (!k.scripted) {
      k.scripted = true;
      const it = { moveX: 0, moveZ: 0, faceYaw: null, wantBeam: false, wantMelee: false, wantGrab: false, wantRoar: false, wantDash: false, clashPressure: 0 };
      k.brain.think = () => {
        it.moveX = 0;
        it.moveZ = 0;
        it.faceYaw = k.script.yaw;
        it.wantBeam = !!k.script.beam;
        return it;
      };
    }
  };
  T.place = (i, x, z, yaw, charge = 0) => {
    const c = g.kaiju.list[i].ctl;
    c.x = x;
    c.z = z;
    c.yaw = yaw;
    c.speed = 0;
    c.motion.charge = charge;
    c.weapon.cooldown = 99;
    T.script(i, { yaw, beam: false });
  };
  T.place(1, 60, 60, 0);
  T.place(0, 60, 80, 0);
});

async function shot(name, settle = 3000) {
  await sleep(settle);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log('wrote', name);
}
const set = (fn, arg) => page.evaluate(fn, arg);

// ---- Godzilla facing the camera ----
await set(() => window.__t.place(0, 197, 215, Math.PI));
await shot('g1_rest');
await set(() => (window.__gv.kaiju.list[0].ctl.motion.charge = 1));
await shot('g2_charged', 2000);

// ---- Godzilla in profile, breathing across the frame ----
await set(() => window.__t.place(0, 262, 215, Math.PI / 2));
await set(() => {
  const k = window.__gv.kaiju.list[0];
  k.ctl.weapon.cooldown = 0;
  window.__t.script(0, { yaw: Math.PI / 2, beam: true });
});
await waitFor(() => window.__gv.kaiju.list[0].ctl.weapon.state === 'firing' && window.__gv.fx.beam.power > 0.9);
await shot('g3_beam', 400);
await set(() => window.__t.place(0, 60, 80, 0));

// ---- Ghidorah over the avenue ----
await set(() => window.__t.place(1, 197, 205, Math.PI));
await shot('d1_rest');
await set(() => (window.__gv.kaiju.list[1].ctl.motion.charge = 1));
await shot('d2_charged', 2000);
await set(() => {
  window.__t.place(1, 197, 205, Math.PI);
  window.__gv.kaiju.list[1].ctl.weapon.cooldown = 0;
  window.__t.script(1, { yaw: Math.PI, beam: true });
});
await waitFor(() => window.__gv.fx.bolts.filter((b) => b.ttl > 0.12).length >= 3);
await shot('d3_lightning', 100);

// ---- both ----
await set(() => {
  window.__t.place(1, 225, 175, -Math.PI / 2);
  window.__t.place(0, 150, 215, -Math.PI / 2);
});
await shot('b1_both');

await browser.close();
console.log(problems.length ? `console problems:\n${problems.join('\n')}` : 'console clean');
process.exit(problems.length ? 1 : 0);
