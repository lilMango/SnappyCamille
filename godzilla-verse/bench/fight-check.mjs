// The fight end to end in the real city (real browser, software WebGL): melee lands and staggers, a grab holds
// the other kaiju and the toss flings it into the skyline (carving the flight path, a big landing blast, fall
// damage), a knockout lies down and then gets back up, the Director never lets both breathe at once, the leash
// pulls a far-off fight back toward the player, the title cards and health bars show, and ?fight=0 turns it off.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/fight-check.mjs [outDir]
//   (dev server on :1340, or PORT=1341 for a production preview)
//
// Software GL is slow and the game clamps dt, so every wait polls for a condition.
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);
const outDir = process.argv[2] || '/tmp/fight-check';
mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${process.env.PORT || 1340}/godzilla-verse/`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
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
async function waitFor(fn, arg, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    await sleep(200);
  }
  return null;
}

// the camera starts above the roofs (free camera) so the screenshots can see the fight
await page.goto(`${BASE}?cam=197,150,330,0,-16&debug=0`);
await waitFor(() => window.__gv && window.__gv.city.ready);
await waitFor(() => window.__gv.kaiju.list.length === 2 && window.__gv.kaiju.fight && window.__gv.kaiju.destruction);

await gv(() => {
  const g = window.__gv;
  const T = (window.__t = {});
  const neutral = () => ({ moveX: 0, moveZ: 0, faceYaw: null, aimPitch: undefined, wantBeam: false, wantMelee: false, wantGrab: false, wantRoar: false, wantDash: false, clashPressure: 0 });
  T.idle = (i) => {
    g.kaiju.list[i].brain.think = neutral;
  };
  // Godzilla (0) and Ghidorah (1) facing each other `gap` blocks apart, centred on (cx, cz), north-south
  T.duel = (cx, cz, gap) => {
    const a = g.kaiju.list[0].ctl;
    const b = g.kaiju.list[1].ctl;
    Object.assign(a, { x: cx, z: cz - gap / 2, yaw: Math.PI, speed: 0 }); // faces +z
    Object.assign(b, { x: cx, z: cz + gap / 2, yaw: 0, speed: 0 }); // faces -z
    for (const c of [a, b]) {
      c.weapon.cooldown = 99;
      c.cd.melee = 0;
      c.cd.grab = 0;
    }
    b.y = b.cfg.hoverY;
  };
  // a far-off player so the free camera is the only view (and the leash has something to pull toward)
  g.player.invulnerable = 99;
});

// ============ it is wired up ============
const wired = await gv(() => ({
  brains: window.__gv.kaiju.list.map((k) => typeof k.brain.state),
  fight: !!window.__gv.kaiju.fight,
  director: !!window.__gv.kaiju.director,
}));
check('the kaiju are driven by the combat brain, with a Fight and a Director', wired.brains.every((b) => b === 'string') && wired.fight && wired.director, JSON.stringify(wired));

// ============ melee ============
await gv(() => {
  window.__t.idle(1);
  window.__t.idle(0);
  window.__t.duel(197, 200, 22);
  window.__gv.kaiju.list[0].brain.think = () => ({ moveX: 0, moveZ: 0, faceYaw: Math.PI, aimPitch: undefined, wantBeam: false, wantMelee: window.__swipe === true, wantGrab: false, wantRoar: false, wantDash: false, clashPressure: 0 });
  window.__swipe = true;
});
const hp0 = await gv(() => window.__gv.kaiju.list[1].ctl.hp);
const hit = await waitFor(() => window.__gv.kaiju.fight.stats.hits >= 1, null, 120000);
await gv(() => (window.__swipe = false));
const hp1 = await gv(() => window.__gv.kaiju.list[1].ctl.hp);
check('a claw swipe lands on the other kaiju', !!hit, `Ghidorah ${hp0} -> ${hp1}`);
check('...for the configured damage', Math.abs(hp0 - hp1 - 70) < 1.5, `${(hp0 - hp1).toFixed(1)} damage`);
const staggered = await gv(() => window.__gv.kaiju.list[1].ctl.motion.stagger > 0 || window.__gv.kaiju.list[1].ctl.action.kind === 'stagger' || window.__gv.kaiju.fight.stats.hits >= 1);
check('...and it staggers', !!staggered);

// ============ grab and toss ============
await gv(() => {
  window.__t.duel(197, 200, 20);
  window.__t.idle(1);
  window.__gv.kaiju.list[0].brain.think = () => ({ moveX: 0, moveZ: 0, faceYaw: Math.PI, aimPitch: undefined, wantBeam: false, wantMelee: false, wantGrab: window.__grab === true, wantRoar: false, wantDash: false, clashPressure: 0 });
  window.__grab = true;
});
const removed0 = await gv(() => window.__gv.kaiju.destruction.stats.removed);
const hpToss0 = await gv(() => window.__gv.kaiju.list[1].ctl.hp);
const held = await waitFor(() => window.__gv.kaiju.list[1].ctl.action.kind === 'held', null, 120000);
await gv(() => (window.__grab = false));
check('a grab connects: the other kaiju is held in the air', !!held);
const heldPos = await gv(() => {
  const a = window.__gv.kaiju.list[0].ctl;
  const b = window.__gv.kaiju.list[1].ctl;
  return { d: Math.hypot(a.x - b.x, a.z - b.z), y: b.y };
});
check('...in front of the holder, off the ground', Math.abs(heldPos.d - 14) < 3 && heldPos.y > 40, `${heldPos.d.toFixed(1)} blocks ahead, y=${heldPos.y.toFixed(0)}`);
const card = await gv(() => window.__gv.kaiju.announce.text);
check('a title card announces the grab', /GRABS/.test(card), card);
await page.screenshot({ path: `${outDir}/1_held.png` });

const thrown = await waitFor(() => window.__gv.kaiju.list[1].ctl.action.kind === 'thrown', null, 120000);
check('after the hold it is thrown', !!thrown);
await sleep(300);
await page.screenshot({ path: `${outDir}/2_thrown.png` });
const landed = await waitFor(() => window.__gv.kaiju.fight.stats.impacts >= 1, null, 180000);
check('it lands: an impact', !!landed);
await sleep(500);
await page.screenshot({ path: `${outDir}/3_impact.png` });
const after = await gv(() => ({
  removed: window.__gv.kaiju.destruction.stats.removed,
  hp: window.__gv.kaiju.list[1].ctl.hp,
  kind: window.__gv.kaiju.list[1].ctl.action.kind,
  collapsed: window.__gv.kaiju.destruction.stats.collapsed,
  toss: window.__gv.kaiju.announce.text,
}));
check('the fall hurts (220)', Math.abs(hpToss0 - after.hp - 220) < 1.5, `${hpToss0} -> ${after.hp}`);
check('it is knocked down for a few seconds', after.kind === 'downed', after.kind);
await waitFor(() => window.__gv.kaiju.destruction.pendingCells < 200, null, 240000);
const done = await gv(() => ({ removed: window.__gv.kaiju.destruction.stats.removed, collapsed: window.__gv.kaiju.destruction.stats.collapsed }));
check('the flight path and the landing blast tore a hole in the skyline', done.removed - removed0 > 4000, `+${done.removed - removed0} voxels, ${done.collapsed} building(s) collapsed`);
await page.screenshot({ path: `${outDir}/4_aftermath.png` });
const gotUp = await waitFor(() => window.__gv.kaiju.list[1].ctl.action.kind === 'none', null, 240000);
check('it gets back up after the knock-down', !!gotUp);

// ============ knockout and revival ============
await gv(() => {
  window.__t.duel(197, 200, 20);
  const b = window.__gv.kaiju.list[1].ctl;
  b.hp = 30;
  window.__swipe = true;
  window.__gv.kaiju.list[0].brain.think = () => ({ moveX: 0, moveZ: 0, faceYaw: Math.PI, aimPitch: undefined, wantBeam: false, wantMelee: window.__swipe === true, wantGrab: false, wantRoar: false, wantDash: false, clashPressure: 0 });
});
const bonus0 = await gv(() => window.__gv.player.bonus);
const ko = await waitFor(() => window.__gv.kaiju.list[1].ctl.hp === 0 && window.__gv.kaiju.list[1].ctl.action.kind === 'downed', null, 120000);
await gv(() => (window.__swipe = false));
check('zero health knocks it out', !!ko);
const koInfo = await gv(() => ({ card: window.__gv.kaiju.announce.text, ko: window.__gv.kaiju.fight.stats.kos, lie: window.__gv.kaiju.list[1].ctl.motion.lie }));
check('...with a title card', /DOWN/.test(koInfo.card), koInfo.card);
await waitFor(() => window.__gv.kaiju.list[1].ctl.motion.lie > 0.9, null, 60000);
await page.screenshot({ path: `${outDir}/5_knockout.png` });
const revived = await waitFor(() => window.__gv.kaiju.list[1].ctl.action.kind === 'none' && window.__gv.kaiju.list[1].ctl.hp > 0, null, 300000);
const hpUp = await gv(() => window.__gv.kaiju.list[1].ctl.hp);
check('it gets back up with 40% health', !!revived && Math.abs(hpUp - 1400 * 0.4) < 2, `${hpUp}`);
const bonus1 = await gv(() => window.__gv.player.bonus);
check('spectacle points go to a player who is watching (hits, the landing, the knockout)', bonus1 > bonus0, `score bonus ${bonus0} -> ${bonus1}`);

// ============ the Director: never two beams at once ============
await gv(() => {
  const g = window.__gv;
  // back to the real AI, both of them
  window.__both = 0;
  window.__beams = 0;
  const tick = () => {
    const [a, b] = g.kaiju.list.map((k) => k.ctl);
    if (a.busy && b.busy) window.__both++;
    if (a.weapon.state === 'firing' || b.weapon.state === 'firing') window.__beams++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__t.duel(197, 200, 110);
  for (const k of g.kaiju.list) {
    delete k.brain.think; // the prototype's CombatBrain.think again
    k.brain.forceBeam = false;
    k.ctl.weapon.cooldown = 0;
    k.ctl.hp = k.ctl.maxHp;
  }
  // put the player near so the leash is quiet
  Object.assign(g.player.body, { x: 197.5, y: 22, z: 215.5 });
});
const fought = await waitFor(() => window.__beams > 20 && window.__gv.kaiju.fight.stats.hits + window.__gv.kaiju.fight.stats.grabs > 0, null, 420000);
const dir = await gv(() => ({ both: window.__both, beams: window.__beams }));
check('the AI fights on its own: breath and close combat', !!fought, JSON.stringify(dir));
check('the Director never lets both kaiju use their signature weapon at the same moment', dir.both === 0, `${dir.both} frames`);
await page.screenshot({ path: `${outDir}/6_ai_fight.png` });

// ============ the leash ============
await gv(() => {
  const g = window.__gv;
  const [a, b] = g.kaiju.list.map((k) => k.ctl);
  for (const c of [a, b]) {
    c.action.kind = 'none';
    c.weapon.state = 'idle';
    c.weapon.cooldown = 99;
    c.cd.melee = 99;
    c.cd.grab = 99;
  }
  Object.assign(a, { x: 320, z: 360 });
  Object.assign(b, { x: 300, z: 340 });
  Object.assign(g.player.body, { x: 60.5, y: 22, z: 60.5 });
  window.__d0 = Math.hypot((a.x + b.x) / 2 - 60, (a.z + b.z) / 2 - 60);
});
const d0 = await gv(() => window.__d0);
const pulled = await waitFor((d) => {
  const [a, b] = window.__gv.kaiju.list.map((k) => k.ctl);
  return Math.hypot((a.x + b.x) / 2 - 60, (a.z + b.z) / 2 - 60) < d - 25;
}, d0, 300000);
const d1 = await gv(() => {
  const [a, b] = window.__gv.kaiju.list.map((k) => k.ctl);
  return Math.hypot((a.x + b.x) / 2 - 60, (a.z + b.z) / 2 - 60);
});
check('the leash pulls a fight that wandered far from the player back toward them', !!pulled, `${d0.toFixed(0)} -> ${d1.toFixed(0)} blocks`);

check('no console errors or warnings', problems.length === 0, problems.slice(0, 4).join(' | '));

// ============ the HUD (not in free-camera mode) ============
await page.goto(BASE);
await waitFor(() => window.__gv && window.__gv.city.ready);
await waitFor(() => window.__gv.kaiju.list.length === 2);
await gv(() => {
  window.__gv.kaiju.announce = { text: 'TEST CARD', until: performance.now() + 20000, id: 99 };
});
const hudOk = await waitFor(() => /GODZILLA/.test(document.body.innerText) && /KING GHIDORAH/.test(document.body.innerText) && /TEST CARD/.test(document.body.innerText), null, 20000);
check('the HUD shows both health bars and the title card', !!hudOk);
await page.screenshot({ path: `${outDir}/7_hud.png` });

// ============ ?fight=0 ============
await page.goto(`${BASE}?fight=0`);
await waitFor(() => window.__gv && window.__gv.city.ready);
await waitFor(() => window.__gv.kaiju.list.length === 2);
await sleep(3000);
const off = await gv(() => ({ brain: typeof window.__gv.kaiju.list[0].brain.state, hits: window.__gv.kaiju.fight.stats.hits }));
check('?fight=0 brings back the wandering AI (no combat brain)', off.brain === 'undefined' && off.hits === 0, JSON.stringify(off));

await browser.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
console.log(`screenshots in ${outDir}`);
process.exit(failures === 0 ? 0 : 1);
