import { describe, test, expect } from 'bun:test';
import { KaijuController, NEUTRAL_INTENT } from './controller';
import { WanderBrain } from './brain';
import { KAIJU, KAIJU_BOUNDS } from '../../constants/kaijuConfig';
import { BASE_Y } from '../../constants/cityConfig';
import { mulberry32 } from '../rng';

const walk = (dx, dz) => ({ ...NEUTRAL_INTENT, moveX: dx, moveZ: dz });
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function run(c, intent, seconds, dt = 1 / 60, onStep) {
  const events = [];
  const all = [];
  for (let i = 0; i < seconds / dt; i++) {
    c.step(typeof intent === 'function' ? intent(c, i) : intent, dt, events);
    for (const e of events) all.push(e);
    if (onStep) onStep(c, events);
  }
  return all;
}

describe('Godzilla locomotion', () => {
  test('spawns where configured, standing on the street, full health', () => {
    const c = new KaijuController('godzilla');
    expect(c.x).toBe(KAIJU.godzilla.spawn.x);
    expect(c.z).toBe(KAIJU.godzilla.spawn.z);
    expect(c.y).toBe(BASE_Y);
    expect(c.hp).toBe(c.maxHp);
    expect(c.flying).toBe(false);
  });

  test('accelerates gradually toward full speed, turning to face where it walks', () => {
    const c = new KaijuController('godzilla'); // spawns facing +z
    c.x = 150;
    c.z = 345; // plenty of room to walk before the wall
    run(c, walk(0, -1), 0.5); // wants to go -z: must turn right round first
    expect(c.speed).toBeLessThan(KAIJU.godzilla.speed * 0.2); // still turning: barely moving
    run(c, walk(0, -1), 25);
    expect(Math.abs(wrap(c.yaw - 0))).toBeLessThan(0.05); // faces -z
    expect(c.speed).toBeGreaterThan(KAIJU.godzilla.speed * 0.9);
    expect(c.speed).toBeLessThanOrEqual(KAIJU.godzilla.speed + 1e-9);
  });

  test('never turns faster than its turn rate', () => {
    const c = new KaijuController('godzilla');
    let prev = c.yaw;
    let worst = 0;
    run(c, walk(1, 0), 10, 1 / 60, () => {
      worst = Math.max(worst, Math.abs(wrap(c.yaw - prev)));
      prev = c.yaw;
    });
    expect(worst).toBeLessThanOrEqual(KAIJU.godzilla.turnRate / 60 + 1e-9);
  });

  test('moves along the way it faces', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0; // faces -z
    c.x = 100;
    c.z = 300;
    run(c, walk(0, -1), 6);
    expect(c.z).toBeLessThan(300 - 10);
    expect(Math.abs(c.x - 100)).toBeLessThan(0.5);
  });

  test('stays inside the city walls', () => {
    const c = new KaijuController('godzilla');
    run(c, walk(-1, 0), 90);
    expect(c.x).toBeGreaterThanOrEqual(KAIJU_BOUNDS.x0);
    run(c, walk(1, 0), 120);
    expect(c.x).toBeLessThanOrEqual(KAIJU_BOUNDS.x1);
    run(c, walk(0, 1), 120);
    expect(c.z).toBeLessThanOrEqual(KAIJU_BOUNDS.z1);
    run(c, walk(0, -1), 160);
    expect(c.z).toBeGreaterThanOrEqual(KAIJU_BOUNDS.z0);
  });

  test('faceYaw overrides the walking direction', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0;
    run(c, { ...NEUTRAL_INTENT, moveX: 0, moveZ: -1, faceYaw: Math.PI / 2 }, 10);
    expect(Math.abs(wrap(c.yaw - Math.PI / 2))).toBeLessThan(0.1);
  });

  test('footfalls: alternate feet, a steady cadence at full stride, none when standing', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0;
    c.x = 150;
    c.z = 340;
    run(c, walk(0, -1), 6); // get up to speed first
    const ev = run(c, walk(0, -1), 12).filter((e) => e.type === 'footfall');
    // 2 footfalls per gait cycle: ~ 2 * stride * seconds
    expect(ev.length).toBeGreaterThan(2 * KAIJU.godzilla.stride * 12 * 0.8);
    expect(ev.length).toBeLessThan(2 * KAIJU.godzilla.stride * 12 * 1.15 + 1);
    for (let i = 1; i < ev.length; i++) expect(ev[i].foot).not.toBe(ev[i - 1].foot);
    // the feet are either side of the body
    const l = ev.find((e) => e.foot === 0);
    const r = ev.find((e) => e.foot === 1);
    expect(Math.hypot(l.x - r.x, l.z - r.z)).toBeGreaterThan(5);

    const still = new KaijuController('godzilla');
    expect(run(still, NEUTRAL_INTENT, 10).filter((e) => e.type === 'footfall').length).toBe(0);
  });
});

describe('atomic breath', () => {
  const cfg = KAIJU.beam;

  test('idle -> charging -> firing -> cooldown -> idle, on the configured timings', () => {
    const c = new KaijuController('godzilla');
    c.weapon.cooldown = 0;
    const fire = { ...NEUTRAL_INTENT, wantBeam: true };
    const states = [];
    run(c, (cc) => (cc.weapon.state === 'idle' && states.length === 0 ? fire : NEUTRAL_INTENT), cfg.chargeTime + cfg.fireTime + cfg.cooldown + 2, 1 / 60, (cc, ev) => {
      for (const e of ev) if (e.type === 'weapon') states.push([e.state, cc.time]);
    });
    expect(states.map((s) => s[0])).toEqual(['charging', 'firing', 'cooldown', 'idle']);
    const [c0, f0, k0, i0] = states.map((s) => s[1]);
    expect(f0 - c0).toBeCloseTo(cfg.chargeTime, 1);
    expect(k0 - f0).toBeCloseTo(cfg.fireTime, 1);
    expect(i0 - k0).toBeCloseTo(cfg.cooldown, 1);
  });

  test('charge ramps 0 -> 1 while charging, holds while firing, fades after', () => {
    const c = new KaijuController('godzilla');
    c.weapon.cooldown = 0;
    const fire = { ...NEUTRAL_INTENT, wantBeam: true };
    c.step(fire, 1 / 60, []);
    const samples = [];
    for (let i = 0; i < 60 * 2; i++) {
      c.step(NEUTRAL_INTENT, 1 / 60, []);
      samples.push([c.weapon.state, c.motion.charge]);
    }
    const charging = samples.filter((s) => s[0] === 'charging').map((s) => s[1]);
    for (let i = 1; i < charging.length; i++) expect(charging[i]).toBeGreaterThanOrEqual(charging[i - 1]);
    expect(charging[0]).toBeLessThan(0.1);
    expect(Math.max(...charging)).toBeGreaterThan(0.9);
    expect(samples.filter((s) => s[0] === 'firing').every((s) => s[1] === 1)).toBe(true);
    run(c, NEUTRAL_INTENT, cfg.fireTime + 1.5);
    expect(c.motion.charge).toBe(0);
  });

  test('cannot be re-triggered during the cooldown, and the first shot is delayed', () => {
    const c = new KaijuController('godzilla');
    const fire = { ...NEUTRAL_INTENT, wantBeam: true };
    c.step(fire, 1 / 60, []);
    expect(c.weapon.state).toBe('idle'); // spawn cooldown (30% of the real one)
    run(c, fire, cfg.cooldown * 0.3 + 0.3);
    expect(['charging', 'firing']).toContain(c.weapon.state);
    run(c, NEUTRAL_INTENT, cfg.chargeTime + cfg.fireTime + 0.5);
    expect(c.weapon.state).toBe('cooldown');
    c.step(fire, 1 / 60, []);
    expect(c.weapon.state).toBe('cooldown'); // wantBeam is ignored
  });

  test('it plants its feet to fire: speed collapses and it turns slowly', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0;
    c.x = 150;
    c.z = 340;
    c.weapon.cooldown = 0;
    run(c, walk(0, -1), 8);
    expect(c.speed).toBeGreaterThan(KAIJU.godzilla.speed * 0.8);
    run(c, { ...walk(0, -1), wantBeam: true }, 0.5);
    const early = c.speed;
    run(c, { ...walk(0, -1), wantBeam: true }, cfg.chargeTime + 1);
    expect(c.busy).toBe(true);
    expect(c.speed).toBeLessThan(early); // it keeps slowing: a heavy body needs a moment to stop
    expect(c.speed).toBeLessThan(KAIJU.godzilla.speed * 0.3);
  });

  test('the sweep runs 0 -> 1 across the fire time, monotonically', () => {
    const c = new KaijuController('godzilla');
    c.weapon.cooldown = 0;
    run(c, { ...NEUTRAL_INTENT, wantBeam: true }, cfg.chargeTime + 0.05);
    expect(c.weapon.state).toBe('firing');
    let last = -1;
    run(c, NEUTRAL_INTENT, cfg.fireTime - 0.1, 1 / 60, (cc) => {
      expect(cc.weapon.sweep).toBeGreaterThanOrEqual(last);
      last = cc.weapon.sweep;
    });
    expect(last).toBeGreaterThan(0.9);
  });

  test('the muzzle is in front of the jaw, ~60 blocks up', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0;
    c.x = 100;
    c.z = 200;
    const m = c.muzzle();
    expect(m.z).toBeLessThan(200); // ahead of a -z-facing kaiju
    expect(Math.abs(m.x - 100)).toBeLessThan(1e-9);
    expect(m.y).toBeGreaterThan(BASE_Y + 55);
    expect(m.y).toBeLessThan(BASE_Y + 70);
  });
});

describe('King Ghidorah', () => {
  test('hovers: bobs around its hover height and never touches the street', () => {
    const c = new KaijuController('ghidorah');
    expect(c.flying).toBe(true);
    let lo = 1e9;
    let hi = -1e9;
    run(c, walk(1, 0), 25, 1 / 60, (cc) => {
      lo = Math.min(lo, cc.y);
      hi = Math.max(hi, cc.y);
    });
    expect(lo).toBeGreaterThan(KAIJU.ghidorah.hoverY - KAIJU.ghidorah.bob - 0.01);
    expect(hi).toBeLessThan(KAIJU.ghidorah.hoverY + KAIJU.ghidorah.bob + 0.01);
    expect(hi - lo).toBeGreaterThan(KAIJU.ghidorah.bob); // it does bob
  });

  test('beats its wings (faster when moving) and takes no footfalls', () => {
    const c = new KaijuController('ghidorah');
    const idle = run(c, NEUTRAL_INTENT, 3);
    const p0 = c.motion.phase;
    expect(p0).toBeGreaterThan(5);
    expect(idle.filter((e) => e.type === 'footfall').length).toBe(0);
    c.motion.phase = 0;
    run(c, walk(1, 0), 3);
    run(c, walk(1, 0), 3);
    const flying = new KaijuController('ghidorah');
    run(flying, NEUTRAL_INTENT, 6);
    expect(c.motion.phase).toBeGreaterThan(flying.motion.phase * 1.1);
  });

  test('lightning uses the same weapon machine, with its own timings', () => {
    const c = new KaijuController('ghidorah');
    c.weapon.cooldown = 0;
    const states = [];
    run(c, (cc) => (cc.weapon.state === 'idle' && states.length === 0 ? { ...NEUTRAL_INTENT, wantBeam: true } : NEUTRAL_INTENT), KAIJU.lightning.chargeTime + KAIJU.lightning.fireTime + 0.5, 1 / 60, (cc, ev) => {
      for (const e of ev) if (e.type === 'weapon') states.push(e.state);
    });
    expect(states).toEqual(['charging', 'firing', 'cooldown']);
  });
});

describe('carving the body', () => {
  test('carve events fire at the configured interval while moving, with the right capsules', () => {
    const c = new KaijuController('godzilla');
    c.yaw = 0;
    c.x = 150;
    c.z = 340;
    run(c, walk(0, -1), 6);
    const ev = run(c, walk(0, -1), 5).filter((e) => e.type === 'carve');
    expect(ev.length).toBeGreaterThan(5 / KAIJU.godzilla.bodyCarveInterval - 3);
    expect(ev.length).toBeLessThan(5 / KAIJU.godzilla.bodyCarveInterval + 3);
    const [body, tail] = ev[0].capsules;
    expect(body.radius).toBe(KAIJU.godzilla.bodyCarveRadius);
    expect(body.ay).toBeGreaterThan(body.cy + 30); // a tall column
    expect(tail.cz).toBeGreaterThan(body.cz); // the tail trails behind a -z-walking kaiju
    expect(c.bodyCapsules().length).toBe(2);
  });

  test('standing still carves nothing (Godzilla), but Ghidorah always does (it is hovering through towers)', () => {
    const g = new KaijuController('godzilla');
    expect(run(g, NEUTRAL_INTENT, 3).filter((e) => e.type === 'carve').length).toBe(0);
    const h = new KaijuController('ghidorah');
    const ev = run(h, NEUTRAL_INTENT, 3).filter((e) => e.type === 'carve');
    expect(ev.length).toBeGreaterThan(10);
    expect(ev[0].capsules.length).toBe(1);
    expect(Math.abs(ev[0].capsules[0].cy - KAIJU.ghidorah.hoverY)).toBeLessThanOrEqual(KAIJU.ghidorah.bob + 0.1);
  });
});

describe('the intent contract', () => {
  test('wants it does not implement yet are accepted and ignored', () => {
    const c = new KaijuController('godzilla');
    expect(() => run(c, { ...NEUTRAL_INTENT, wantMelee: true, wantGrab: true, wantRoar: true, wantDash: true, clashPressure: 1 }, 2)).not.toThrow();
  });

  test('NEUTRAL_INTENT is frozen', () => {
    expect(Object.isFrozen(NEUTRAL_INTENT)).toBe(true);
  });

  test('is deterministic: the same intents give the same kaiju', () => {
    const a = new KaijuController('godzilla');
    const b = new KaijuController('godzilla');
    const intent = (c, i) => walk(Math.sin(i / 90), Math.cos(i / 90));
    run(a, intent, 20);
    run(b, intent, 20);
    expect([a.x, a.z, a.yaw, a.speed, a.motion.phase]).toEqual([b.x, b.z, b.yaw, b.speed, b.motion.phase]);
  });
});

describe('the wander brain', () => {
  const buildings = [
    { x0: 100, x1: 110, z0: 100, z1: 110 },
    { x0: 200, x1: 210, z0: 250, z1: 260 },
    { x0: 50, x1: 60, z0: 300, z1: 310 },
  ];

  test('picks a target inside the walls and heads for it', () => {
    const c = new KaijuController('godzilla');
    const brain = new WanderBrain(mulberry32(4));
    const it = brain.think(c, { buildings, player: { x: 197, z: 209 } }, 1 / 60);
    expect(brain.target.x).toBeGreaterThanOrEqual(KAIJU_BOUNDS.x0);
    expect(brain.target.x).toBeLessThanOrEqual(KAIJU_BOUNDS.x1);
    expect(brain.target.z).toBeGreaterThanOrEqual(KAIJU_BOUNDS.z0);
    expect(brain.target.z).toBeLessThanOrEqual(KAIJU_BOUNDS.z1);
    expect(Math.hypot(brain.target.x - c.x, brain.target.z - c.z)).toBeGreaterThan(45);
    expect(Math.hypot(it.moveX, it.moveZ)).toBeCloseTo(1, 6);
    // the intent points at the target
    const dx = brain.target.x - c.x;
    const dz = brain.target.z - c.z;
    expect(it.moveX * dx + it.moveZ * dz).toBeGreaterThan(0.99 * Math.hypot(dx, dz));
  });

  test('picks a new target when it arrives', () => {
    const c = new KaijuController('godzilla');
    const brain = new WanderBrain(mulberry32(9));
    brain.think(c, { buildings }, 1 / 60);
    const first = { ...brain.target };
    c.x = first.x;
    c.z = first.z;
    brain.think(c, { buildings }, 1 / 60);
    expect(brain.target).not.toEqual(first);
  });

  test('over a long walk it reaches many targets and stays inside the walls', () => {
    const c = new KaijuController('godzilla');
    const brain = new WanderBrain(mulberry32(21));
    const seen = new Set();
    for (let i = 0; i < 60 * 180; i++) {
      const it = brain.think(c, { buildings }, 1 / 60);
      c.step(it, 1 / 60, []);
      if (brain.target) seen.add(`${Math.round(brain.target.x)},${Math.round(brain.target.z)}`);
    }
    expect(seen.size).toBeGreaterThan(2);
    expect(c.x).toBeGreaterThanOrEqual(KAIJU_BOUNDS.x0);
    expect(c.x).toBeLessThanOrEqual(KAIJU_BOUNDS.x1);
    expect(c.z).toBeGreaterThanOrEqual(KAIJU_BOUNDS.z0);
    expect(c.z).toBeLessThanOrEqual(KAIJU_BOUNDS.z1);
  });

  test('fires only when a building is ahead, in range, and the weapon is ready', () => {
    const c = new KaijuController('godzilla');
    c.weapon.cooldown = 0;
    c.x = 105;
    c.z = 300;
    c.yaw = 0; // facing -z, toward the building at z ~105 (195 away: out of the 140 range)
    const alwaysFire = { ...mulberry32(1), call: 0 };
    const brain = new WanderBrain(() => 0, { beamChance: 1e9 }); // rng() = 0 and a huge chance => always fires if allowed
    expect(brain.think(c, { buildings }, 1).wantBeam).toBe(false); // too far
    c.z = 200; // 95 away
    expect(brain.think(c, { buildings }, 1).wantBeam).toBe(true);
    c.yaw = Math.PI; // facing away
    expect(brain.think(c, { buildings }, 1).wantBeam).toBe(false);
    c.yaw = 0;
    c.weapon.state = 'cooldown';
    expect(brain.think(c, { buildings }, 1).wantBeam).toBe(false);
    void alwaysFire;
  });

  test('is deterministic for a given seed', () => {
    const a = new WanderBrain(mulberry32(5));
    const b = new WanderBrain(mulberry32(5));
    const ca = new KaijuController('godzilla');
    const cb = new KaijuController('godzilla');
    for (let i = 0; i < 600; i++) {
      const ia = a.think(ca, { buildings }, 1 / 60);
      const ib = b.think(cb, { buildings }, 1 / 60);
      ca.step(ia, 1 / 60, []);
      cb.step(ib, 1 / 60, []);
    }
    expect([ca.x, ca.z, ca.yaw]).toEqual([cb.x, cb.z, cb.yaw]);
  });
});
