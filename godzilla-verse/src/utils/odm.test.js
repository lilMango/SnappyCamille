import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { createBody, moveBody } from './physics';
import { createOdm, odmUpdate, odmConstraint, findAnchor, snapAnchor, attachedCount, odmReset } from './odm';
import { createHit } from './raycast';
import { ODM } from '../constants/odmConfig';
import { PLAYER } from '../constants/playerConfig';
import { B } from '../constants/blocks';

const CHEST = ODM.chestHeight;

function player(x, y, z) {
  return createBody({ x, y, z, halfWidth: PLAYER.halfWidth, height: PLAYER.height, stepHeight: PLAYER.stepHeight, gravity: PLAYER.gravity, terminal: PLAYER.terminalVelocity });
}

const NO_INPUT = () => ({
  hook: [false, false],
  ray: { ox: 0, oy: 0, oz: 0, dx: 0, dy: 1, dz: 0 },
  anchors: null,
  reel: false,
  boost: false,
  dash: false,
  fwd: 0,
  look: { x: 0, y: 0, z: -1 },
  move: { x: 0, z: 0 },
});

// put a rope straight onto an anchor point (the anchor block must exist for the rope to stay)
function attach(world, odm, side, x, y, z, len) {
  world.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), B.STEEL);
  const a = odm.anchors[side];
  Object.assign(a, { active: true, held: true, x, y, z, bx: Math.floor(x), by: Math.floor(y), bz: Math.floor(z), len, len0: len, age: 0 });
}

const dist = (b, a) => Math.hypot(b.x - a.x, b.y + CHEST - a.y, b.z - a.z);

// one frame: ODM update, then physics (the rope runs inside moveBody's substeps)
function frame(world, odm, b, io, dt = 1 / 60) {
  b.constraint = (bd) => odmConstraint(odm, bd);
  odmUpdate(world, odm, b, io, dt);
  moveBody(world, b, dt);
}

describe('rope constraint', () => {
  test('removes only the outward radial velocity and puts the body back on the sphere', () => {
    const odm = createOdm();
    const w = new VoxelWorld();
    attach(w, odm, 0, 0.5, 80, 0.5, 20);
    const b = player(25.5, 80 - CHEST, 0.5); // 25 from the anchor, rope is 20
    b.vx = 5; // outward
    b.vy = 3; // tangential
    odmConstraint(odm, b);
    expect(dist(b, odm.anchors[0])).toBeCloseTo(20, 3);
    expect(b.vx).toBeCloseTo(0, 6); // the outward part is gone...
    expect(b.vy).toBeCloseTo(3, 6); // ...the tangential part is exactly preserved
  });

  test('a slack rope does nothing (the constraint is one-sided)', () => {
    const odm = createOdm();
    const w = new VoxelWorld();
    attach(w, odm, 0, 0.5, 80, 0.5, 20);
    const b = player(5.5, 80 - CHEST - 5, 0.5);
    b.vx = 9;
    b.vy = -4;
    const before = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    odmConstraint(odm, b);
    expect(b.x).toBe(before.x);
    expect(b.y).toBe(before.y);
    expect(b.vx).toBe(before.vx);
    expect(b.vy).toBe(before.vy);
  });

  test('inward velocity is untouched, so reeling accelerates you', () => {
    const odm = createOdm();
    const w = new VoxelWorld();
    attach(w, odm, 0, 0.5, 80, 0.5, 10);
    const b = player(10.5, 80 - CHEST, 0.5);
    b.vx = -7; // toward the anchor
    odmConstraint(odm, b);
    expect(b.vx).toBeCloseTo(-7, 6);
  });
});

describe('swinging', () => {
  function swing(frames, startDrop = 8) {
    const w = new VoxelWorld();
    const odm = createOdm();
    attach(w, odm, 1, 0.5, 80, 0.5, 20);
    // start at rope length, `startDrop` above the bottom of the arc
    const bottomY = 80 - 20;
    const startY = bottomY + startDrop;
    const horiz = Math.sqrt(20 * 20 - (80 - startY) ** 2);
    const b = player(0.5 + horiz, startY - CHEST, 0.5);
    const io = NO_INPUT();
    io.hook = [false, true];
    const out = { maxDist: 0, maxSpeed: 0, minY: 1e9, maxFarY: -1e9, farSide: false };
    for (let i = 0; i < frames; i++) {
      frame(w, odm, b, io);
      out.maxDist = Math.max(out.maxDist, dist(b, odm.anchors[1]));
      out.maxSpeed = Math.max(out.maxSpeed, Math.hypot(b.vx, b.vy, b.vz));
      out.minY = Math.min(out.minY, b.y + CHEST);
      if (b.x < 0.5 - 4) {
        out.farSide = true;
        out.maxFarY = Math.max(out.maxFarY, b.y + CHEST);
      }
    }
    return { w, odm, b, ...out, startY };
  }

  test('the rope never stretches, even at the bottom of a fast swing', () => {
    const r = swing(600);
    expect(r.maxDist).toBeLessThan(20.03);
  });

  test('it is a real pendulum: peak speed matches sqrt(2 g h) and the far side is almost as high', () => {
    const r = swing(600, 8);
    const ideal = Math.sqrt(2 * PLAYER.gravity * 8); // ~21.2 m/s
    expect(r.maxSpeed).toBeGreaterThan(ideal * 0.9);
    expect(r.maxSpeed).toBeLessThan(ideal * 1.05);
    expect(r.farSide).toBe(true);
    expect(r.maxFarY).toBeGreaterThan(r.startY - 2.5); // drag costs a little, not a lot
  });

  test('swings stay in the plane they started in (no spurious sideways drift)', () => {
    const r = swing(600);
    expect(Math.abs(r.b.z - 0.5)).toBeLessThan(0.05);
  });

  test('the same swing at 30 fps and at 144 fps agrees', () => {
    const peak = (dt) => {
      const w = new VoxelWorld();
      const odm = createOdm();
      attach(w, odm, 1, 0.5, 80, 0.5, 20);
      const b = player(0.5 + Math.sqrt(400 - 144), 80 - 12 - CHEST, 0.5);
      const io = NO_INPUT();
      io.hook = [false, true];
      let m = 0;
      for (let i = 0; i < 3 / dt; i++) {
        frame(w, odm, b, io, dt);
        m = Math.max(m, Math.hypot(b.vx, b.vy, b.vz));
      }
      return m;
    };
    expect(peak(1 / 30)).toBeGreaterThan(peak(1 / 144) * 0.93);
    expect(peak(1 / 30)).toBeLessThan(peak(1 / 144) * 1.07);
  });

  test('two ropes at once: the body stays inside both lengths', () => {
    const w = new VoxelWorld();
    const odm = createOdm();
    attach(w, odm, 0, -9.5, 60, 0.5, 14);
    attach(w, odm, 1, 10.5, 60, 0.5, 14);
    const b = player(0.5, 60 - 13 - CHEST, 0.5);
    b.vx = 6;
    b.vz = 3;
    const io = NO_INPUT();
    io.hook = [true, true];
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      frame(w, odm, b, io);
      worst = Math.max(worst, dist(b, odm.anchors[0]) - 14, dist(b, odm.anchors[1]) - 14);
    }
    expect(worst).toBeLessThan(0.06);
  });

  test('swinging into a wall at 40 m/s stops at the wall instead of tunnelling through it', () => {
    const w = new VoxelWorld();
    w.fillBox(30, 0, -40, 30, 120, 40, B.CONCRETE);
    const odm = createOdm();
    const b = player(5.5, 60, 0.5);
    b.vx = 40;
    b.constraint = null;
    const io = NO_INPUT();
    for (let i = 0; i < 60; i++) frame(w, odm, b, io, 1 / 30);
    expect(b.x).toBeLessThan(30 - PLAYER.halfWidth + 1e-6);
  });
});

describe('reel, boost, dash', () => {
  function atBottom() {
    const w = new VoxelWorld();
    const odm = createOdm();
    attach(w, odm, 1, 0.5, 80, 0.5, 20);
    const b = player(0.5, 60 - CHEST, 0.5);
    b.vx = 18; // moving along the arc at the bottom
    const io = NO_INPUT();
    io.hook = [false, true];
    return { w, odm, b, io };
  }

  test('reeling in shortens the rope and speeds you up (angular momentum)', () => {
    const { w, odm, b, io } = atBottom();
    for (let i = 0; i < 4; i++) frame(w, odm, b, io);
    const v0 = Math.hypot(b.vx, b.vy, b.vz);
    io.reel = true;
    for (let i = 0; i < 30; i++) frame(w, odm, b, io);
    expect(odm.anchors[1].len).toBeLessThan(20 - 5);
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeGreaterThan(v0 * 1.25);
  });

  test('the rope never reels shorter than the minimum, and regrows when you let go', () => {
    const { w, odm, b, io } = atBottom();
    io.reel = true;
    for (let i = 0; i < 240; i++) frame(w, odm, b, io);
    expect(odm.anchors[1].len).toBeGreaterThanOrEqual(ODM.minLen - 1e-6);
    io.reel = false;
    const short = odm.anchors[1].len;
    for (let i = 0; i < 60; i++) frame(w, odm, b, io);
    expect(odm.anchors[1].len).toBeGreaterThan(short);
  });

  test('boost speeds you up, costs gas, and never exceeds the speed cap', () => {
    const { w, odm, b, io } = atBottom();
    io.boost = true;
    const gas0 = odm.gas;
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      frame(w, odm, b, io);
      peak = Math.max(peak, Math.hypot(b.vx, b.vy, b.vz));
    }
    expect(odm.gas).toBeLessThan(gas0 - 10);
    expect(peak).toBeLessThanOrEqual(ODM.maxSpeed + 1e-6);
    expect(peak).toBeGreaterThan(24);
  });

  test('with no gas there is no boost, no reel and no new hook', () => {
    const { w, odm, b, io } = atBottom();
    odm.gas = 0;
    odm.gasIdle = 0;
    io.boost = true;
    io.reel = true;
    const v0 = Math.hypot(b.vx, b.vy, b.vz);
    for (let i = 0; i < 10; i++) frame(w, odm, b, io, 1 / 60);
    expect(odm.boosting).toBe(false);
    expect(odm.reeling).toBe(false);
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeLessThan(v0 * 1.05);
    // and a fresh hook can't be fired
    const odm2 = createOdm();
    odm2.gas = 5;
    const w2 = new VoxelWorld();
    w2.fillBox(0, 0, -30, 0, 80, 30, B.CONCRETE);
    const b2 = player(10.5, 21, 0.5);
    const io2 = NO_INPUT();
    io2.hook = [true, false];
    io2.ray = { ox: 10.5, oy: 22, oz: 0.5, dx: -1, dy: 0.2, dz: 0 };
    frame(w2, odm2, b2, io2);
    expect(attachedCount(odm2)).toBe(0);
    expect(odm2.events.some((e) => e.type === 'empty')).toBe(true);
  });

  test('air dash: once per airtime, costs gas, impulses along the look direction, brief zero-g', () => {
    const w = new VoxelWorld();
    const odm = createOdm();
    const b = player(0.5, 60, 0.5);
    const io = NO_INPUT();
    io.dash = true;
    io.look = { x: 0, y: 0, z: -1 };
    const gas0 = odm.gas;
    frame(w, odm, b, io);
    expect(b.vz).toBeLessThan(-ODM.dashSpeed + 3);
    expect(odm.gas).toBeCloseTo(gas0 - ODM.dashCost, 0);
    expect(b.gravityScale).toBe(0);
    const vz1 = b.vz;
    frame(w, odm, b, io); // second press in the same airtime
    expect(b.vz).toBeGreaterThan(vz1 - 1); // no second impulse
    for (let i = 0; i < 12; i++) frame(w, odm, b, { ...NO_INPUT() });
    expect(b.gravityScale).toBe(1); // zero-g window over
  });

  test('the dash recharges on landing', () => {
    const w = new VoxelWorld();
    w.fillBox(-90, 0, -90, 90, 19, 90, B.STONE); // big enough that the dash doesn't fly off it
    const odm = createOdm();
    const b = player(0.5, 24, 0.5);
    const io = NO_INPUT();
    io.dash = true;
    frame(w, odm, b, io);
    expect(odm.dashUsed).toBe(true);
    for (let i = 0; i < 240; i++) frame(w, odm, b, NO_INPUT());
    expect(b.grounded).toBe(true);
    expect(odm.dashUsed).toBe(false);
  });
});

describe('release pop', () => {
  function swingUntil(cond) {
    const w = new VoxelWorld();
    const odm = createOdm();
    attach(w, odm, 1, 0.5, 80, 0.5, 20);
    const b = player(0.5 + Math.sqrt(400 - 144), 68 - CHEST, 0.5);
    const io = NO_INPUT();
    io.hook = [false, true];
    for (let i = 0; i < 400; i++) {
      frame(w, odm, b, io);
      if (cond(b, odm)) break;
    }
    return { w, odm, b, io };
  }

  test('letting go just after the bottom of the arc flings you', () => {
    const { w, odm, b, io } = swingUntil((bd, o) => o.time - o.bottomT < 0.05 && o.bottomT > 0 && bd.vy > 0);
    const hSpeed = Math.hypot(b.vx, b.vz);
    const vy = b.vy;
    io.hook = [false, false];
    odmUpdate(w, odm, b, io, 1 / 60);
    expect(odm.events.some((e) => e.type === 'pop')).toBe(true);
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(hSpeed * 1.05);
    expect(b.vy).toBeGreaterThan(vy);
  });

  test('letting go on the way down gives no pop', () => {
    const { w, odm, b, io } = swingUntil((bd) => bd.vy < -3);
    io.hook = [false, false];
    odmUpdate(w, odm, b, io, 1 / 60);
    expect(odm.events.some((e) => e.type === 'pop')).toBe(false);
    expect(odm.events.some((e) => e.type === 'detach')).toBe(true);
  });
});

describe('anchors', () => {
  function wallWorld() {
    const w = new VoxelWorld();
    w.fillBox(20, 0, -60, 20, 90, 60, B.CONCRETE); // a wall 20 m east
    return w;
  }

  test('the crosshair ray sticks where it points', () => {
    const w = wallWorld();
    const out = createHit();
    expect(findAnchor(w, 5, 30, 0.5, 1, 0.2, 0, out)).toBe(true);
    expect(out.x).toBeCloseTo(20, 3); // the wall's near face
    expect(out.bx).toBe(20);
  });

  test('out of range finds nothing', () => {
    const w = new VoxelWorld();
    w.fillBox(200, 0, -60, 200, 90, 60, B.CONCRETE);
    expect(findAnchor(w, 5, 30, 0.5, 1, 0, 0, createHit())).toBe(false);
  });

  test('the assist cone rescues a near miss on a thin pillar, but not a wild one', () => {
    const w = new VoxelWorld();
    w.fillBox(30, 0, 0, 30, 90, 0, B.STEEL); // a 1x1 pillar 25 m away
    const out = createHit();
    const aim = (deg) => [Math.cos((deg * Math.PI) / 180), 0, Math.sin((deg * Math.PI) / 180)];
    // the pillar is at z = 0..1; aiming from z = 0.5, +-2.3 degrees is well inside the cone but off the pillar
    const near = aim(2.5);
    expect(findAnchor(w, 5.5, 30, 0.5 + 0.0, near[0], near[1], near[2], out)).toBe(true);
    expect(out.bx).toBe(30);
    const wild = aim(25);
    expect(findAnchor(w, 5.5, 30, 0.5, wild[0], wild[1], wild[2], createHit())).toBe(false);
  });

  test('snap assist picks a roof corner inside the cone, prefers higher ones, and rejects far/near/off-cone', () => {
    const w = new VoxelWorld();
    // the first two lie on the same line of sight (equally aligned); the second is higher
    for (const [x, y, z] of [[38, 48, 0], [55, 60, 0], [5, 70, 0], [300, 70, 0], [40, 70, 60]]) w.setBlock(x, y, z, B.CONCRETE);
    const anchors = Int16Array.from([38, 48, 0, 55, 60, 0, 5, 70, 0, 300, 70, 0, 40, 70, 60]);
    const out = createHit();
    const sky = [1, 0.7, 0]; // aiming up at the sky, toward the first two
    expect(snapAnchor(w, anchors, 5.5, 25, 0.5, sky[0], sky[1], sky[2], 25, out)).toBe(true);
    expect([out.bx, out.by, out.bz]).toEqual([55, 60, 0]); // the higher of two equally-aligned corners
    expect(snapAnchor(w, anchors, 5.5, 25, 0.5, -1, 0, 0, 25, out)).toBe(false); // behind you
    expect(snapAnchor(w, null, 5.5, 25, 0.5, 1, 0.7, 0, 25, out)).toBe(false); // no anchors (test world)
  });

  test('firing a hook attaches, costs gas, and refreshes the dash', () => {
    const w = wallWorld();
    const odm = createOdm();
    odm.dashUsed = true;
    const b = player(10.5, 20, 0.5);
    const io = NO_INPUT();
    io.hook = [true, false];
    io.ray = { ox: 10.5, oy: 21.6, oz: 0.5, dx: 1, dy: 0.5, dz: 0 };
    odmUpdate(w, odm, b, io, 1 / 60);
    expect(attachedCount(odm)).toBe(1);
    expect(odm.anchors[0].len).toBeGreaterThan(8);
    expect(odm.gas).toBeLessThan(ODM.gasMax);
    expect(odm.dashUsed).toBe(false);
    expect(odm.events[0].type).toBe('attach');
  });

  test('destroying the anchor block drops the rope (without a pop)', () => {
    const w = new VoxelWorld();
    const odm = createOdm();
    attach(w, odm, 0, 0.5, 80, 0.5, 20);
    const b = player(10.5, 70 - CHEST, 0.5);
    const io = NO_INPUT();
    io.hook = [true, false];
    frame(w, odm, b, io);
    expect(attachedCount(odm)).toBe(1);
    w.setBlock(0, 80, 0, B.AIR);
    frame(w, odm, b, io);
    expect(attachedCount(odm)).toBe(0);
    expect(odm.events.some((e) => e.type === 'pop')).toBe(false);
  });
});

describe('gas', () => {
  test('refills on the ground after a pause, barely in the air, never goes negative or over', () => {
    const w = new VoxelWorld();
    w.fillBox(-5, 0, -5, 5, 19, 5, B.STONE);
    const odm = createOdm();
    odm.gas = 40;
    const b = player(0.5, 20, 0.5);
    for (let i = 0; i < 20; i++) frame(w, odm, b, NO_INPUT()); // 0.33 s: still within the delay
    expect(odm.gas).toBe(40);
    for (let i = 0; i < 60; i++) frame(w, odm, b, NO_INPUT());
    expect(odm.gas).toBeGreaterThan(40 + 10);
    for (let i = 0; i < 600; i++) frame(w, odm, b, NO_INPUT());
    expect(odm.gas).toBe(ODM.gasMax);

    const air = createOdm();
    air.gas = 40;
    const ba = player(0.5, 200, 0.5);
    for (let i = 0; i < 60; i++) frame(new VoxelWorld(), air, ba, NO_INPUT());
    expect(air.gas).toBe(40); // within the 1.5 s air delay
    air.gas = 0;
    for (let i = 0; i < 30; i++) frame(new VoxelWorld(), air, ba, NO_INPUT());
    expect(air.gas).toBeGreaterThanOrEqual(0);
  });

  test('reset drops the ropes and refills', () => {
    const odm = createOdm();
    odm.anchors[0].active = true;
    odm.gas = 3;
    odmReset(odm);
    expect(attachedCount(odm)).toBe(0);
    expect(odm.gas).toBe(ODM.gasMax);
  });

  test('the speed cap holds even if something shoves you', () => {
    const w = new VoxelWorld();
    const odm = createOdm();
    const b = player(0.5, 100, 0.5);
    b.vx = 200;
    odmUpdate(w, odm, b, NO_INPUT(), 1 / 60);
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeLessThanOrEqual(ODM.maxSpeed + 1e-6);
  });
});
