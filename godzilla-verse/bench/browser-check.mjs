// Real-time browser check with software WebGL (SwiftShader). Loads a URL, waits until the
// mesh queue settles (DebugPanel "dirty / in flight" = 0 / 0), screenshots, and prints the
// panel readout and any console errors/warnings.
//
//   ~/.nvm/versions/node/v24.13.0/bin/node bench/browser-check.mjs <out.png> "<query>" [WxH] [maxWaitSec]
//   e.g.  ... bench/browser-check.mjs /tmp/city.png "world=city&rd=6" 960x600 300
//
// Needs Node >= 20 (Playwright) and playwright-core, taken from the gstack install unless
// PLAYWRIGHT_CORE points elsewhere. Serves from PORT (default 1340, the dev server; use
// `bun x vite preview --port 1341` + PORT=1341 to check the production build).
//
// Why not the gstack `browse` tool or chrome's --virtual-time-budget: the former cannot
// create a WebGL context, the latter freezes performance.now() so every timing reads ~0.
import { homedir } from 'node:os';

const corePath = process.env.PLAYWRIGHT_CORE || `${homedir()}/.claude/skills/gstack/node_modules/playwright-core/index.mjs`;
const { chromium } = await import(corePath);

const [out, query = '', size = '960x600', maxWait = '240'] = process.argv.slice(2);
if (!out) {
  console.error('usage: browser-check.mjs <out.png> "<query>" [WxH] [maxWaitSec]');
  process.exit(2);
}
const [w, h] = size.split('x').map(Number);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const problems = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(`http://localhost:${process.env.PORT || 1340}/godzilla-verse/?${query}`);
const t0 = Date.now();
let text = '';
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  text = await page.innerText('body');
  const m = text.match(/dirty \/ in flight\s+(\d+) \/ (\d+)/);
  const sec = (Date.now() - t0) / 1000;
  if (m && m[1] === '0' && m[2] === '0' && sec > 8) break; // streaming has settled
  if (sec > Number(maxWait)) {
    problems.push(`timed out after ${maxWait}s before the mesh queue settled`);
    break;
  }
}
await new Promise((r) => setTimeout(r, 2500)); // let a couple of frames draw the final state
await page.screenshot({ path: out });

console.log(`settled after ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`);
console.log(text.split('\n').filter((l) => l.trim()).join(' | '));
console.log('problems:', problems.length ? problems : 'none');
await browser.close();
process.exit(problems.length ? 1 : 0);
