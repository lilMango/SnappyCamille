import { describe, test, expect } from 'bun:test';
import { KaijuController, NEUTRAL_INTENT } from './controller';
import { Fight } from './fight';
import { Director } from './director';
import { CombatBrain } from './combat';
import { KAIJU } from '../../constants/kaijuConfig';
import { BASE_Y } from '../../constants/cityConfig';
import { mulberry32 } from '../rng';

const F = KAIJU.fight;
const DT = 1 / 60;

// Godzilla at (100, 100) facing +z (yaw pi); Ghidorah `gap` blocks ahead of him
function duel(gap = 20, seed = 1) {
  const rng = mulberry32(seed);
  const g = new KaijuController('godzilla', rng);
  const d = new KaijuController('ghidorah', rng);
  g.x = 100;
  g.z = 100;
  g.yaw = Math.PI;
  d.x = 100;
  d.z = 100 + gap;
  d.yaw = 0; // facing back at Godzilla
  g.weapon.cooldown = 99;
  d.weapon.cooldown = 99;
  const fight = new Fight(g, d, rng);
  const ev = { g: [], d: [] };
  const frame = (ig = NEUTRAL_INTENT, id = NEUTRAL_INTENT, buildings = null) => {
    fight.begin();
    g.step(ig, DT, ev.g);
    d.step(id, DT, ev.d);
    fight.resolve(g, d, ev.g, buildings);
    fight.resolve(d, g, ev.d, buildings);
    fight.glue();
    return fight.effects;
  };
  return { g, d, fight, frame };
}

const seen = (list, type) => list.filter((e) => e.type === type);

describe('melee', () => {
  test('a swipe in reach and ahead lands: damage, a hit effect, knockback and a stagger', () => {
    const { g, d, frame } = duel(20);
    const hp0 = d.hp;
    const y0 = d.z;
    const fx = [];
    for (let i = 0; i < 90; i++) fx.push(...frame({ ...NEUTRAL_INTENT, wantMelee: true }));
    expect(d.hp).toBe(hp0 - KAIJU.godzilla.meleeDamage);
    expect(seen(fx, 'hit').length).toBe(1);
    expect(d.z).toBeGreaterThan(y0); // pushed away from Godzilla
    expect(d.motion.hit).toBeGreaterThanOrEqual(0);
    expect(g.cd.melee).toBeGreaterThan(0);
  });

  test('the hit staggers (damage >= staggerMin) and the target loses its weapon charge', () => {
    const { d, frame } = duel(20);
    d.weapon.cooldown = 0;
    // Ghidorah starts charging, then gets clawed
    let staggered = false;
    for (let i = 0; i < 120; i++) {
      frame({ ...NEUTRAL_INTENT, wantMelee: true }, { ...NEUTRAL_INTENT, wantBeam: i < 5 });
      if (d.action.kind === 'stagger') staggered = true;
    }
    expect(staggered).toBe(true);
    expect(d.weapon.state === 'cooldown' || d.weapon.state === 'idle').toBe(true);
  });

  test('a swipe out of reach, or at someone behind it, misses', () => {
    const far = duel(80);
    for (let i = 0; i < 90; i++) far.frame({ ...NEUTRAL_INTENT, wantMelee: true });
    expect(far.d.hp).toBe(far.d.maxHp);
    const behind = duel(20);
    behind.g.yaw = 0; // facing away from the foe
    for (let i = 0; i < 90; i++) behind.frame({ ...NEUTRAL_INTENT, wantMelee: true });
    expect(behind.d.hp).toBe(behind.d.maxHp);
  });

  test('the swipe has a windup, a short active window and a cooldown', () => {
    const { g, frame } = duel(20);
    const types = [];
    let t = 0;
    let hitT = null;
    for (let i = 0; i < 200; i++) {
      const fx = frame({ ...NEUTRAL_INTENT, wantMelee: i === 0 });
      t += DT;
      if (seen(fx, 'hit').length && hitT === null) hitT = t;
      types.push(g.action.kind);
    }
    expect(hitT).toBeGreaterThan(F.melee.windup - 0.05);
    expect(hitT).toBeLessThan(F.melee.windup + F.melee.active + 0.1);
    expect(types).toContain('melee');
    expect(g.action.kind).toBe('none');
  });
});

describe('grab and toss', () => {
  test('a grab in reach connects, holds the foe in front of the holder, then tosses it', () => {
    const { g, d, fight, frame } = duel(20);
    const effects = [];
    let heldSeen = false;
    for (let i = 0; i < 60 * 3; i++) {
      effects.push(...frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 }));
      if (d.action.kind === 'held') {
        heldSeen = true;
        // glued ~14 blocks ahead of the holder, facing it
        expect(Math.hypot(d.x - g.x, d.z - g.z)).toBeCloseTo(14, 0);
      }
    }
    expect(heldSeen).toBe(true);
    expect(seen(effects, 'grab').length).toBe(1);
    expect(seen(effects, 'toss').length).toBe(1);
    expect(fight.stats.tosses).toBe(1);
  });

  test('a grab out of reach whiffs and recovers', () => {
    const { g, d, frame } = duel(80);
    for (let i = 0; i < 60 * 3; i++) frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 });
    expect(d.action.kind).toBe('none');
    expect(g.action.kind).toBe('none');
    expect(g.holding).toBeNull();
  });

  test('the toss is a ballistic flight (52 m/s at 28 degrees) that ends in an impact, damage and a knock-down', () => {
    const { g, d, frame } = duel(20);
    const effects = [];
    let launchSpeed = 0;
    let apex = 0;
    for (let i = 0; i < 60 * 12; i++) {
      effects.push(...frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 }));
      if (d.action.kind === 'thrown' && !launchSpeed) launchSpeed = Math.hypot(d.vel.x, d.vel.y, d.vel.z);
      if (d.action.kind === 'thrown') apex = Math.max(apex, d.y);
    }
    expect(launchSpeed).toBeGreaterThan(F.launchSpeed - 3);
    expect(launchSpeed).toBeLessThan(F.launchSpeed + 1);
    expect(apex).toBeGreaterThan(BASE_Y + 38 + 5); // it rose above Godzilla's hand (launch 28 degrees up)
    const impact = seen(effects, 'impact');
    expect(impact.length).toBe(1);
    expect(impact[0].y).toBeCloseTo(BASE_Y + 8, 0); // Ghidorah lands on its belly
    expect(d.hp).toBe(d.maxHp - F.impactDamage);
    expect(seen(effects, 'flightCarve').length).toBeGreaterThan(3); // it tore through the city on the way
    void g;
  });

  test('it is aimed at the tallest building ahead, within range and the cone', () => {
    const { g, d, frame } = duel(20);
    // Godzilla faces +z: a tall tower 100 blocks ahead, a taller one behind him, a taller one too far
    const buildings = [
      { x0: 95, x1: 105, z0: 195, z1: 205, y1: 90 },
      { x0: 95, x1: 105, z0: 0, z1: 10, y1: 120 },
      { x0: 95, x1: 105, z0: 400, z1: 410, y1: 125 },
    ];
    for (let i = 0; i < 60 * 3; i++) {
      frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 }, NEUTRAL_INTENT, buildings);
      if (d.action.kind === 'thrown') break;
    }
    expect(d.action.kind).toBe('thrown');
    expect(d.vel.z).toBeGreaterThan(40); // straight at the tower ahead
    expect(Math.abs(d.vel.x)).toBeLessThan(3);
    void g;
  });

  test('a holder knocked out drops its victim (it falls, rather than hanging in the air)', () => {
    const { g, d, frame } = duel(20);
    for (let i = 0; i < 40; i++) {
      frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 });
      if (d.action.kind === 'held') break;
    }
    expect(d.action.kind).toBe('held');
    g.hurt(1e9);
    frame();
    expect(g.action.kind).toBe('downed');
    expect(d.action.kind).toBe('thrown');
    expect(d.vel.x + d.vel.y + d.vel.z).toBe(0 + d.vel.y); // dropped, not launched
  });

  test('a holder cannot be staggered out of the hold', () => {
    const { g, d, frame } = duel(20);
    for (let i = 0; i < 40; i++) {
      frame({ ...NEUTRAL_INTENT, wantGrab: i === 0 });
      if (d.action.kind === 'held') break;
    }
    g.hurt(F.staggerMin + 10);
    expect(g.action.kind).toBe('grab');
    expect(g.action.phase).toBe('hold');
  });
});

describe('health, knock-outs and getting back up', () => {
  test('zero health knocks it out: down for koDown seconds, then up with reviveFrac of its health', () => {
    const { d, fight, frame } = duel(60);
    const effects = [];
    d.hurt(d.hp);
    let t = 0;
    let revivedAt = null;
    for (let i = 0; i < 60 * (F.koDown + 3); i++) {
      effects.push(...frame());
      t += DT;
      if (seen(effects, 'revive').length && revivedAt === null) revivedAt = t;
    }
    expect(seen(effects, 'ko').length).toBe(1);
    expect(fight.stats.kos).toBe(1);
    expect(revivedAt).toBeGreaterThan(F.koDown - 0.2);
    expect(revivedAt).toBeLessThan(F.koDown + 0.3);
    expect(d.hp).toBeCloseTo(d.maxHp * F.reviveFrac, 5);
    expect(d.action.kind).toBe('none');
    expect(d.motion.lie).toBeLessThan(0.05);
  });

  test('a downed kaiju can not be hit again (no pile-on)', () => {
    const { d } = duel(60);
    d.hurt(d.hp);
    expect(d.action.kind).toBe('downed');
    expect(d.hurt(100)).toBe(0);
  });

  test('Ghidorah drops to the street when downed and climbs back to its hover height afterwards', () => {
    const { d, frame } = duel(60);
    d.hurt(d.hp);
    let low = 1e9;
    for (let i = 0; i < 60 * (F.koDown + 0.1); i++) {
      frame();
      low = Math.min(low, d.y);
    }
    expect(low).toBeLessThan(BASE_Y + 15);
    for (let i = 0; i < 60 * 8; i++) frame();
    expect(d.y).toBeGreaterThan(d.cfg.hoverY - 4);
  });
});

describe('weapons on the other kaiju', () => {
  test('a beam through the foe hurts it per second; one that misses does not', () => {
    const { g, d, fight } = duel(60);
    const dps = F.beamDps;
    g.weapon.state = 'firing';
    // along +z through Ghidorah's body height
    const y = d.y;
    const hit = fight.beam(g, d, 100, y, 100, 0, 0, 1, 140, 0.5);
    expect(hit).toBeCloseTo(dps * 0.5, 5);
    const miss = fight.beam(g, d, 100, y + 90, 100, 0, 0, 1, 140, 0.5); // passes far overhead
    expect(miss).toBe(0);
  });

  test('a lightning strike on the foe hurts it, one in the next street does not', () => {
    const { g, d, fight } = duel(60);
    expect(fight.strike(g, d, d.x + 2, d.y, d.z, 3)).toBe(F.lightningDamage);
    expect(fight.strike(g, d, d.x + 80, d.y, d.z, 3)).toBe(0);
  });
});

describe('the Director', () => {
  test('only one signature weapon at a time, with a gap after one ends', () => {
    const { g, d } = duel(60);
    const dir = new Director([g, d]);
    expect(dir.mayBeam(g)).toBe(true);
    expect(dir.mayBeam(d)).toBe(true);
    g.weapon.state = 'charging';
    dir.update(DT);
    expect(dir.mayBeam(d)).toBe(false); // Godzilla is busy
    expect(dir.mayBeam(g)).toBe(true); // asking about itself is fine
    g.weapon.state = 'cooldown';
    dir.update(DT);
    expect(dir.mayBeam(d)).toBe(false); // the gap
    for (let i = 0; i < 60 * F.beamGap + 5; i++) dir.update(DT);
    expect(dir.mayBeam(d)).toBe(true);
  });

  test('leash: no pull while the fight is near the player, a growing pull toward them when it drifts away', () => {
    const { g, d } = duel(60);
    const dir = new Director([g, d]);
    expect(dir.pull({ x: 100, z: 130 }).w).toBe(0);
    const far = dir.pull({ x: 100 + F.leash + 40, z: 130 });
    expect(far.w).toBeGreaterThan(0.3);
    expect(far.x).toBeGreaterThan(100); // toward the player
    expect(dir.pull({ x: 100 + F.leash + 200, z: 130 }).w).toBe(1);
  });
});

describe('the combat brain', () => {
  test('closes the distance, then fights: it swipes or grabs when in reach', () => {
    const rng = mulberry32(3);
    const { g, d, fight } = duel(110, 3);
    const gb = new CombatBrain(rng);
    const db = new CombatBrain(rng);
    const dir = new Director([g, d]);
    const ev = { g: [], d: [] };
    const kinds = new Set();
    let minDist = 1e9;
    for (let i = 0; i < 60 * 40; i++) {
      fight.begin();
      dir.update(DT);
      const ctx = (foe) => ({ foe, director: dir, player: { x: 100, z: 150 }, buildings: null });
      g.step(gb.think(g, ctx(d), DT), DT, ev.g);
      d.step(db.think(d, ctx(g), DT), DT, ev.d);
      fight.resolve(g, d, ev.g);
      fight.resolve(d, g, ev.d);
      fight.glue();
      kinds.add(g.action.kind);
      kinds.add(d.action.kind);
      minDist = Math.min(minDist, Math.hypot(g.x - d.x, g.z - d.z));
    }
    expect(minDist).toBeLessThan(KAIJU.godzilla.meleeReach);
    expect(kinds.has('melee') || kinds.has('grab')).toBe(true);
    expect(fight.stats.hits + fight.stats.grabs).toBeGreaterThan(0);
  });

  test('does nothing while helpless, and its intent is always well-formed', () => {
    const { g, d } = duel(20);
    const b = new CombatBrain(mulberry32(1));
    g.hurt(g.hp); // down
    const it = b.think(g, { foe: d, director: null, player: null }, DT);
    expect(it.moveX).toBe(0);
    expect(it.moveZ).toBe(0);
    expect(it.wantMelee || it.wantGrab || it.wantBeam).toBe(false);
    expect(b.state).toBe('helpless');
  });

  test('force makes it do that thing next (and then stops forcing)', () => {
    const { g, d, frame } = duel(20);
    const b = new CombatBrain(mulberry32(1));
    b.force = 'grab';
    let grabbed = false;
    for (let i = 0; i < 90; i++) {
      frame(b.think(g, { foe: d, director: null, player: null }, DT));
      if (g.action.kind === 'grab') grabbed = true;
    }
    expect(grabbed).toBe(true);
    expect(b.force).toBeNull();
  });

  test('a full duel (many seeds) always ends in somebody going down at some point, without ever hanging', () => {
    let totalKos = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed);
      const { g, d, fight } = duel(60, seed);
      const gb = new CombatBrain(rng);
      const db = new CombatBrain(rng);
      const dir = new Director([g, d]);
      const ev = { g: [], d: [] };
      let stuckT = 0;
      for (let i = 0; i < 60 * 240; i++) {
        fight.begin();
        dir.update(DT);
        const ctx = (foe) => ({ foe, director: dir, player: { x: 100, z: 130 }, buildings: null });
        g.step(gb.think(g, ctx(d), DT), DT, ev.g);
        d.step(db.think(d, ctx(g), DT), DT, ev.d);
        fight.resolve(g, d, ev.g);
        fight.resolve(d, g, ev.d);
        fight.glue();
        // beams: a straight shot at the foe when firing (no world in this sim)
        for (const [s, f] of [[g, d], [d, g]]) {
          if (s.weapon.state === 'firing') {
            const dx = f.x - s.x;
            const dz = f.z - s.z;
            const l = Math.hypot(dx, dz) || 1;
            fight.beam(s, f, s.x, s.y + 40, s.z, dx / l, 0, dz / l, 140, DT);
          }
        }
        // nobody may be held/thrown/downed forever
        const helpless = ['held', 'thrown', 'downed'].includes(g.action.kind) || ['held', 'thrown', 'downed'].includes(d.action.kind);
        stuckT = helpless ? stuckT + DT : 0;
        expect(stuckT).toBeLessThan(F.koDown + 8);
        expect(Number.isFinite(g.x + g.z + d.x + d.z + g.hp + d.hp)).toBe(true);
      }
      totalKos += fight.stats.kos;
      expect(fight.stats.hits + fight.stats.grabs).toBeGreaterThan(0);
    }
    expect(totalKos).toBeGreaterThan(0);
  });
});
