// End-to-end check of the real city in a real browser (software WebGL): the loading screen,
// generation in a worker, the main-thread fallback, the spawn, walking, editing, time of day.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/city-check.mjs [outDir]
//   (dev server on :1340, or PORT=1341 for a production preview)
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);
const outDir = process.argv[2] || '/tmp/city-check';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const problems = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/?${query}`);
  return { page, problems };
}
async function waitFor(page, fn, arg, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    await sleep(250);
  }
  return null;
}

// ======================= worker path =======================
{
  const { page, problems } = await open('');
  // the loading screen is up first
  const sawLoading = await waitFor(page, () => document.body.innerText.includes('DUSK OVER THE HARBOUR CITY') || window.__gv?.city?.ready, null, 20000);
  check('the loading screen appears while the city generates', !!sawLoading);

  const ready = await waitFor(page, () => window.__gv && window.__gv.city.ready);
  check('the city generates and the first view is meshed (ready)', !!ready);
  const info = await page.evaluate(() => ({ via: window.__gv.city.via, buildings: window.__gv.city.buildings.length, anchors: window.__gv.city.anchors?.length / 3, lot: window.__gv.city.lotMap?.length, trees: window.__gv.city.stats?.trees }));
  check('generation ran in a Web Worker', info.via === 'worker', info.via);
  check('the lot map, buildings and grapple anchors arrived', info.lot === 384 * 384 && info.buildings > 150 && info.anchors > 300, JSON.stringify(info));

  const gone = await waitFor(page, () => !document.body.innerText.includes('DUSK OVER THE HARBOUR CITY'), null, 20000);
  check('the loading screen goes away', !!gone);

  // spawn: standing on the park path, facing the fountain
  const grounded = await waitFor(page, () => window.__gv.player.body.grounded, null, 30000);
  const p0 = await page.evaluate(() => ({ x: window.__gv.player.body.x, y: window.__gv.player.body.y, z: window.__gv.player.body.z, yaw: window.__gv.input.yaw }));
  check('the player spawns on the park path', !!grounded && Math.abs(p0.x - 197) < 0.2 && Math.abs(p0.z - 209) < 0.2 && Math.abs(p0.y - 21) < 0.05, JSON.stringify(p0));
  await sleep(1500);
  await page.screenshot({ path: `${outDir}/1_spawn.png` });

  // walk toward the fountain
  await page.evaluate(() => window.__gv.input.keys.add('KeyW'));
  const walked = await waitFor(page, () => window.__gv.player.body.z < 205, null, 120000);
  await page.evaluate(() => window.__gv.input.keys.delete('KeyW'));
  const p1 = await page.evaluate(() => ({ y: window.__gv.player.body.y, g: window.__gv.player.body.grounded }));
  check('W walks along the path toward the fountain', !!walked && p1.g && Math.abs(p1.y - 21) < 0.06, JSON.stringify(p1));

  // edit the city: break a block, see it remesh
  await page.evaluate(() => {
    const p = window.__gv.player.body;
    Object.assign(p, { x: 197, y: 21.2, z: 215, vx: 0, vy: 0, vz: 0 });
    window.__gv.input.yaw = 0;
    window.__gv.input.pitch = -0.85;
  });
  await waitFor(page, () => window.__gv.player.body.grounded, null, 30000);
  let tgt = null;
  let prev = null;
  for (let i = 0; i < 60 && !tgt; i++) {
    const a = await page.evaluate(() => (window.__gv.target.valid && window.__gv.target.ny === 1 ? { x: window.__gv.target.x, y: window.__gv.target.y, z: window.__gv.target.z } : null));
    if (a && prev && a.x === prev.x && a.y === prev.y && a.z === prev.z) tgt = a;
    prev = a;
    await sleep(600);
  }
  check('the crosshair targets the path in the city', !!tgt, tgt ? JSON.stringify(tgt) : '');
  if (tgt) {
    await waitFor(page, () => window.__gv.stats.dirty === 0 && window.__gv.stats.inFlight === 0);
    const q0 = await page.evaluate(() => window.__gv.stats.quads);
    await page.evaluate(() => (window.__gv.input.breakHeld = true));
    const broke = await waitFor(page, (t) => window.__gv.world.getBlock(t.x, t.y, t.z) === 0, tgt, 30000);
    await page.evaluate(() => (window.__gv.input.breakHeld = false));
    await waitFor(page, () => window.__gv.stats.dirty === 0 && window.__gv.stats.inFlight === 0);
    const q1 = await page.evaluate(() => window.__gv.stats.quads);
    check('breaking a block in the generated city remeshes it', !!broke && q1 !== q0, `${q0} -> ${q1}`);
  }

  // nothing odd happened to the world while we were at it
  check('no console errors or warnings (worker path)', problems.length === 0, problems.slice(0, 3).join(' | '));
  await page.close();
}

// ======================= main-thread fallback =======================
{
  const { page, problems } = await open('workers=0');
  const ready = await waitFor(page, () => window.__gv && window.__gv.city.ready);
  const via = await page.evaluate(() => window.__gv.city.via);
  check('?workers=0 generates on the main thread and still gets ready', !!ready && via === 'main thread', via);
  const grounded = await waitFor(page, () => window.__gv.player.body.grounded, null, 30000);
  check('...and the player stands at the spawn', !!grounded);
  check('no console errors or warnings (main-thread path)', problems.length === 0, problems.slice(0, 3).join(' | '));
  await page.close();
}

// ======================= times of day =======================
for (const t of ['day', 'night']) {
  const { page, problems } = await open(`time=${t}`);
  const ready = await waitFor(page, () => window.__gv && window.__gv.city.ready);
  await sleep(1500);
  await page.screenshot({ path: `${outDir}/2_${t}.png` });
  check(`time=${t} loads and renders without errors`, !!ready && problems.length === 0, problems.slice(0, 2).join(' | '));
  await page.close();
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`screenshots in ${outDir}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
