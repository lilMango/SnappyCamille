import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { createBody, moveBody, sweep, bodyOverlapsCell } from './physics';
import { PLAYER } from '../constants/playerConfig';
import { B } from '../constants/blocks';

const FLOOR_TOP = 20; // floor fills y 0..19, so a body stands at y = 20

function flatWorld(extent = 80) {
  const w = new VoxelWorld();
  w.fillBox(0, 0, 0, extent, FLOOR_TOP - 1, extent, B.STONE);
  return w;
}

function player(x, y, z) {
  return createBody({
    x, y, z,
    halfWidth: PLAYER.halfWidth,
    height: PLAYER.height,
    stepHeight: PLAYER.stepHeight,
    gravity: PLAYER.gravity,
    terminal: PLAYER.terminalVelocity,
  });
}

// run `frames` frames; `drive(b, i)` sets the wanted velocity each frame like the controller does
function run(world, b, frames, dt = 1 / 60, drive) {
  for (let i = 0; i < frames; i++) {
    if (drive) drive(b, i);
    moveBody(world, b, dt);
  }
}

describe('landing and standing', () => {
  test('falls from above a section border and lands on the floor', () => {
    const w = flatWorld();
    const b = player(10.5, 60, 10.5); // crosses the y=32 section border on the way down
    run(w, b, 240);
    expect(b.y).toBeCloseTo(FLOOR_TOP, 2);
    expect(b.grounded).toBe(true);
    expect(b.vy).toBe(0);
  });

  test('stays grounded and does not jitter while standing still', () => {
    const w = flatWorld();
    const b = player(10.5, FLOOR_TOP, 10.5);
    run(w, b, 5);
    const y0 = b.y;
    for (let i = 0; i < 300; i++) {
      moveBody(w, b, 1 / 60);
      expect(b.grounded).toBe(true);
      expect(Math.abs(b.y - y0)).toBeLessThan(1e-3);
    }
  });

  test('landing is identical at 30 fps and 144 fps', () => {
    const land = (dt) => {
      const w = flatWorld();
      const b = player(10.5, 40, 10.5);
      run(w, b, Math.round(3 / dt), dt);
      return b.y;
    };
    expect(land(1 / 30)).toBeCloseTo(land(1 / 144), 2);
  });

  test('a very fast fall lands on the floor instead of tunnelling through it', () => {
    const w = flatWorld();
    const b = player(10.5, 100, 10.5);
    b.vy = -500; // clamped to terminal velocity, then substepped
    run(w, b, 600, 1 / 30);
    expect(b.y).toBeCloseTo(FLOOR_TOP, 2);
  });
});

describe('walking', () => {
  test('moves at the commanded speed on flat ground and across a column border', () => {
    const w = flatWorld();
    const b = player(1.5, FLOOR_TOP, 10.5);
    run(w, b, 60, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed)); // x = 1.5 -> ~7.5 (crosses nothing yet)
    run(w, b, 120, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed)); // crosses x = 16 and x = 32
    expect(b.x).toBeCloseTo(1.5 + 3 * PLAYER.walkSpeed, 1);
    expect(b.y).toBeCloseTo(FLOOR_TOP, 2);
    expect(b.hitWall).toBe(false);
  });

  test('is stopped by a 2-block wall and rests against it', () => {
    const w = flatWorld();
    w.fillBox(10, FLOOR_TOP, 0, 10, FLOOR_TOP + 1, 20, B.BRICK);
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 120, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed));
    expect(b.x).toBeCloseTo(10 - PLAYER.halfWidth, 2);
    expect(b.x).toBeLessThan(10 - PLAYER.halfWidth + 1e-6);
    expect(b.y).toBeCloseTo(FLOOR_TOP, 2);
  });

  test('steps up a one-block curb without jumping', () => {
    const w = flatWorld();
    w.fillBox(10, FLOOR_TOP, 0, 30, FLOOR_TOP, 20, B.SIDEWALK); // 1-block high ledge
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 120, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed));
    expect(b.x).toBeGreaterThan(12);
    expect(b.y).toBeCloseTo(FLOOR_TOP + 1, 2);
    expect(b.grounded).toBe(true);
  });

  test('steps up repeatedly: a staircase', () => {
    const w = flatWorld();
    // four risers, each one block higher and two blocks further along
    for (let i = 1; i <= 4; i++) w.fillBox(8 + i * 2, FLOOR_TOP, 0, 30, FLOOR_TOP + i - 1, 20, B.CONCRETE);
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 240, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed));
    expect(b.y).toBeCloseTo(FLOOR_TOP + 4, 2);
    expect(b.x).toBeGreaterThan(18);
  });

  test('cannot step up when a low ceiling leaves no headroom', () => {
    const w = flatWorld();
    w.fillBox(10, FLOOR_TOP, 0, 30, FLOOR_TOP, 20, B.SIDEWALK); // step
    w.fillBox(8, FLOOR_TOP + 2, 0, 30, FLOOR_TOP + 2, 20, B.CONCRETE); // ceiling 2 above the floor
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 120, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed));
    expect(b.x).toBeLessThan(10); // got as far as the step and stopped
    expect(b.y).toBeCloseTo(FLOOR_TOP, 2);
  });

  test('slides along a wall instead of sticking to it', () => {
    const w = flatWorld();
    w.fillBox(10, FLOOR_TOP, 0, 10, FLOOR_TOP + 3, 60, B.BRICK);
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 60, 1 / 60, (bd) => {
      bd.vx = 6;
      bd.vz = 6;
    });
    expect(b.x).toBeCloseTo(10 - PLAYER.halfWidth, 2);
    expect(b.z).toBeGreaterThan(10.5 + 4); // kept moving along the wall
  });
});

describe('tunnelling', () => {
  test('a body moving 80 m/s cannot pass through a one-block-thick wall (at 30 fps)', () => {
    const w = flatWorld();
    w.fillBox(20, FLOOR_TOP, 0, 20, FLOOR_TOP + 4, 40, B.STEEL);
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 60, 1 / 30, (bd) => (bd.vx = 80));
    expect(b.x).toBeLessThan(20);
    expect(b.x).toBeCloseTo(20 - PLAYER.halfWidth, 2);
  });

  test('...nor at 20 fps with a diagonal velocity', () => {
    const w = flatWorld();
    w.fillBox(20, FLOOR_TOP, 0, 20, FLOOR_TOP + 4, 70, B.STEEL);
    w.fillBox(0, FLOOR_TOP, 40, 70, FLOOR_TOP + 4, 40, B.STEEL);
    const b = player(5.5, FLOOR_TOP, 10.5);
    run(w, b, 120, 1 / 20, (bd) => {
      bd.vx = 70;
      bd.vz = 50;
    });
    expect(b.x).toBeLessThan(20);
    expect(b.z).toBeLessThan(40);
  });
});

describe('jumping', () => {
  test('apex is about 1.3 blocks', () => {
    const w = flatWorld();
    const b = player(10.5, FLOOR_TOP, 10.5);
    run(w, b, 5);
    b.vy = PLAYER.jumpSpeed;
    let top = b.y;
    for (let i = 0; i < 90; i++) {
      moveBody(w, b, 1 / 60);
      top = Math.max(top, b.y);
    }
    expect(top - FLOOR_TOP).toBeGreaterThan(1.2);
    expect(top - FLOOR_TOP).toBeLessThan(1.45);
    expect(b.grounded).toBe(true); // and lands again
  });

  test('cannot jump over a 2-block wall', () => {
    const w = flatWorld();
    w.fillBox(10, FLOOR_TOP, 0, 10, FLOOR_TOP + 1, 30, B.BRICK);
    const b = player(7.5, FLOOR_TOP, 10.5);
    run(w, b, 5);
    b.vy = PLAYER.jumpSpeed;
    run(w, b, 90, 1 / 60, (bd) => (bd.vx = PLAYER.walkSpeed));
    expect(b.x).toBeLessThan(10);
  });

  test('bumps its head on a ceiling and stops rising', () => {
    const w = flatWorld();
    w.fillBox(0, FLOOR_TOP + 2, 0, 30, FLOOR_TOP + 2, 30, B.CONCRETE); // 0.2 above the head
    const b = player(10.5, FLOOR_TOP, 10.5);
    run(w, b, 5);
    b.vy = PLAYER.jumpSpeed;
    let bumped = false;
    for (let i = 0; i < 30; i++) {
      moveBody(w, b, 1 / 60);
      if (b.hitCeiling) bumped = true;
      expect(b.y + PLAYER.height).toBeLessThanOrEqual(FLOOR_TOP + 2 + 1e-6);
    }
    expect(bumped).toBe(true);
  });
});

describe('helpers', () => {
  test('sweep returns the full distance in open space and the gap to a wall otherwise', () => {
    const w = flatWorld();
    w.fillBox(8, FLOOR_TOP, 0, 8, FLOOR_TOP + 3, 20, B.BRICK);
    const b = player(5, FLOOR_TOP, 10.5);
    expect(sweep(w, b, 0, -2)).toBe(-2); // away from the wall
    const allowed = sweep(w, b, 0, 10); // toward it: face at 5.3, wall at 8
    expect(allowed).toBeGreaterThan(2.69);
    expect(allowed).toBeLessThan(2.7);
    expect(sweep(w, b, 0, 0)).toBe(0);
  });

  test('bodyOverlapsCell', () => {
    const b = player(10.5, 20, 10.5);
    expect(bodyOverlapsCell(b, 10, 20, 10)).toBe(true); // the cell it stands in
    expect(bodyOverlapsCell(b, 10, 21, 10)).toBe(true); // head height
    expect(bodyOverlapsCell(b, 10, 19, 10)).toBe(false); // the floor under it
    expect(bodyOverlapsCell(b, 12, 20, 10)).toBe(false); // a cell away
    expect(bodyOverlapsCell(b, 11, 20, 10)).toBe(false); // adjacent: 10.8 < 11, no overlap
  });
});
