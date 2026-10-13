// Touch-controls check: emulates a touch device and drives the on-screen joystick, look pad and
// buttons with real touch events (Chrome DevTools Protocol), asserting they reach the game.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/touch-check.mjs [outDir]
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);
const outDir = process.argv[2] || '/tmp/touch-check';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
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
async function waitFor(fn, arg, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    await sleep(250);
  }
  return null;
}
// Touch events are queued to a main thread that software GL keeps busy, so state changes a
// moment after the event is dispatched: poll for the expected state rather than reading once.
const eventually = async (fn, arg, ms = 8000) => !!(await waitFor(fn, arg, ms));
const touch = (type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
const read = () =>
  page.evaluate(() => {
    const g = window.__gv;
    return { mx: g.input.touchMx, mz: g.input.touchMz, sprint: g.input.touchSprint, jump: g.input.touchJump, brk: g.input.breakHeld, plc: g.input.placeHeld, yaw: g.input.yaw, pitch: g.input.pitch, z: g.player.body.z, y: g.player.body.y, grounded: g.player.body.grounded, mode: g.useGame.getState().cameraMode };
  });

await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/?world=test`);
await waitFor(() => window.__gv && window.__gv.stats.meshes > 20 && window.__gv.player.body.grounded);

const hasButtons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean));
check('touch controls are shown on a touch device', ['JUMP', 'BREAK', 'PLACE', 'CAM'].every((t) => hasButtons.includes(t)), hasButtons.join(','));
await page.screenshot({ path: `${outDir}/touch_idle.png` });

// ---- joystick: drag up in the left half -> walk forward ----
const z0 = (await read()).z;
await touch('touchStart', [[150, 300]]);
await touch('touchMove', [[150, 250]]); // 50px up of the 55px throw
let s;
check('joystick up = forward input', await eventually(() => window.__gv.input.touchMz > 0.8 && Math.abs(window.__gv.input.touchMx) < 0.1));
const moved = await waitFor((z0) => window.__gv.player.body.z < z0 - 2, z0, 90000);
check('...and the player walks forward', !!moved);
await page.screenshot({ path: `${outDir}/touch_walking.png` });
await touch('touchMove', [[150, 220]]); // 80px from the origin: beyond the ring
check('pushing past the ring sprints', await eventually(() => window.__gv.input.touchSprint === true));
await touch('touchEnd', []);
check(
  'releasing the stick zeroes the input',
  await eventually(() => {
    const i = window.__gv.input;
    return i.touchMx === 0 && i.touchMz === 0 && i.touchSprint === false;
  }),
);

// ---- look pad: drag in the right half rotates the view ----
const yaw0 = (await read()).yaw;
await touch('touchStart', [[600, 200]]);
for (let i = 1; i <= 5; i++) await touch('touchMove', [[600 + i * 20, 200 - i * 6]]);
await touch('touchEnd', []);
await waitFor(() => true);
await sleep(500);
s = await read();
check('dragging the right half turns the camera (yaw changed, drag right = look right)', s.yaw < yaw0 - 0.1, `yaw ${yaw0.toFixed(2)} -> ${s.yaw.toFixed(2)}`);

// ---- buttons ----
const btnCenter = (label) =>
  page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
    const r = b.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, label);

let [bx, by] = await btnCenter('JUMP');
await touch('touchStart', [[bx, by]]);
check('JUMP button sets the jump flag', await eventually(() => window.__gv.input.touchJump === true));
check('...and the player leaves the ground', await eventually(() => window.__gv.player.body.y > 21.5, null, 20000));
await touch('touchEnd', []);
check('...and releases it', await eventually(() => window.__gv.input.touchJump === false));

[bx, by] = await btnCenter('BREAK');
await touch('touchStart', [[bx, by]]);
check('BREAK button holds the break flag', await eventually(() => window.__gv.input.breakHeld === true));
await touch('touchEnd', []);
[bx, by] = await btnCenter('PLACE');
await touch('touchStart', [[bx, by]]);
check('PLACE button holds the place flag', await eventually(() => window.__gv.input.placeHeld === true));
await touch('touchEnd', []);
check('both release cleanly', await eventually(() => !window.__gv.input.breakHeld && !window.__gv.input.placeHeld));

const mode0 = (await read()).mode;
[bx, by] = await btnCenter('CAM');
await touch('touchStart', [[bx, by]]);
await touch('touchEnd', []);
check('CAM button cycles the camera mode', await eventually((m0) => window.__gv.useGame.getState().cameraMode === (m0 + 1) % 3, mode0));

// ---- two fingers at once: walk while looking ----
const yaw1 = (await read()).yaw;
await touch('touchStart', [[150, 300], [600, 200]]);
await touch('touchMove', [[150, 260], [680, 200]]);
check(
  'joystick and look pad work at the same time',
  await eventually((y1) => window.__gv.input.touchMz > 0.5 && window.__gv.input.yaw !== y1, yaw1),
);
await touch('touchEnd', []);

check('no console errors or warnings', problems.length === 0, problems.slice(0, 3).join(' | '));
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
