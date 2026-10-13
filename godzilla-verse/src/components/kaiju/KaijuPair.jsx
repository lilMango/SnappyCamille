import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { kaiju, city, player } from '../../store';
import { world } from '../../utils/voxelWorld';
import { Destruction } from '../../utils/destruction';
import { KaijuController } from '../../utils/kaiju/controller';
import { WanderBrain } from '../../utils/kaiju/brain';
import { aimDir, beamEnd, distToSegment, lightningBolt } from '../../utils/kaiju/weapons';
import { fx, nextBolt, BOLT_LEVELS } from '../../utils/kaiju/fx';
import { mulberry32 } from '../../utils/rng';
import { KAIJU } from '../../constants/kaijuConfig';
import { GROUND_Y } from '../../constants/worldConfig';
import { addTraumaAt } from '../../utils/shake';
import { hurt } from '../Player';
import KaijuRig from './KaijuRig';
import Beams from './Beams';
import Debris, { spawnDebris } from './Debris';
import Dust, { emitDust } from './Dust';

// The simulation + effects driver for both kaiju. Per frame: each brain produces intent, its
// controller turns that into motion / abilities / events, and this component turns the events into
// world effects (stomp craters, body carving, beam bores, lightning strikes, player damage, shake,
// dust) through the one Destruction seam, then lets Destruction work through its budgeted queue and
// throws the removed voxels as debris. Rigs, beams, debris and dust are drawn by sibling components.

const ctx = { buildings: null, player: { x: 0, z: 0 } };
const _dir = { x: 0, y: 0, z: 1 };
const _end = { len: 0, hit: false, x: 0, y: 0, z: 0 };
const _mz = { x: 0, y: 0, z: 0 };
const _drain = [];

function makeEntry(kind, rng) {
  const ctl = new KaijuController(kind, rng);
  ctl.view = { valid: false, muzzle: { x: 0, y: 0, z: 0 }, heads: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  return { ctl, brain: new WanderBrain(rng), events: [], bore: 0, strike: 0, rng };
}

export default function KaijuPair() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const rng = mulberry32(6150);
    const list = [makeEntry('godzilla', rng), makeEntry('ghidorah', rng)];
    kaiju.list = list;
    setEntries(list);
    return () => {
      kaiju.list = [];
      kaiju.destruction = null;
    };
  }, []);

  useFrame(({ camera }, rawDt) => {
    if (!kaiju.list.length || !city.ready) return;
    const dt = Math.min(rawDt, 1 / 30);
    const cam = camera.position;
    if (!kaiju.destruction) kaiju.destruction = new Destruction(world, city.lotMap ? city : null);
    const d = kaiju.destruction;

    ctx.buildings = city.buildings;
    ctx.player.x = player.body.x;
    ctx.player.z = player.body.z;

    for (const k of kaiju.list) {
      const ctl = k.ctl;
      const intent = k.brain.think(ctl, ctx, dt);
      const events = ctl.step(intent, dt, k.events);
      for (const e of events) {
        if (e.type === 'footfall') stomp(d, e, cam);
        else if (e.type === 'carve') for (const c of e.capsules) d.applyDamage({ shape: 'capsule', ...c, source: ctl.kind });
      }
      if (ctl.flying) lightning(k, d, dt, cam);
      else atomicBreath(k, d, dt, cam);
    }

    // work through the destruction queue under its budget, then throw what came off as debris
    d.update(dt);
    throwDebris(d);
    d.drainEvents(_drain);
    for (const e of _drain) {
      if (e.type === 'collapse') {
        addTraumaAt(0.7, e.x, e.y, e.z, cam.x, cam.y, cam.z);
        emitDust(e.x, GROUND_Y + 3, e.z, 28, 16, 16, 6);
        emitDust(e.x, GROUND_Y + e.height * 0.5, e.z, 16, 10, 12, 4);
      }
    }
    _drain.length = 0;
  });

  return (
    <>
      {entries.map((k) => (
        <KaijuRig key={k.ctl.kind} ctl={k.ctl} />
      ))}
      <Beams />
      <Debris />
      <Dust />
    </>
  );
}

// ---- footfalls ----------------------------------------------------------------------

function stomp(d, e, cam) {
  const S = KAIJU.stomp;
  d.applyDamage({ shape: 'sphere', cx: e.x, cy: GROUND_Y + 3, cz: e.z, radius: S.radius, source: 'stomp', seed: (e.x * 7 + e.z * 13) | 0 });
  kaiju.stats.stomps++;
  addTraumaAt(0.45, e.x, GROUND_Y, e.z, cam.x, cam.y, cam.z);
  emitDust(e.x, GROUND_Y + 2, e.z, 9, 6, 8, 3);
  if (Math.hypot(player.body.x - e.x, player.body.z - e.z) < S.playerRadius && player.body.y < GROUND_Y + 8) {
    hurt(S.playerDamage);
    kaiju.stats.playerHits++;
  }
}

// ---- Godzilla's atomic breath ---------------------------------------------------------

function atomicBreath(k, d, dt, cam) {
  const ctl = k.ctl;
  const w = ctl.weapon;
  const m = ctl.motion;
  const b = fx.beam;
  const B = KAIJU.beam;
  const mz = ctl.view.valid ? ctl.view.muzzle : ctl.muzzle(_mz);
  const j = fx.jaw[0];
  j.x = mz.x;
  j.y = mz.y;
  j.z = mz.z;
  j.charge = m.charge;

  if (w.state === 'firing') {
    b.on = true;
    b.power = Math.min(1, b.power + dt * 8);
    aimDir(ctl.yaw + m.aim, m.aimPitch, _dir);
    beamEnd(world, mz.x, mz.y, mz.z, _dir.x, _dir.y, _dir.z, B.range, _end);
    b.ox = mz.x;
    b.oy = mz.y;
    b.oz = mz.z;
    b.dx = _dir.x;
    b.dy = _dir.y;
    b.dz = _dir.z;
    b.len = _end.len;
    b.hit = _end.hit;
    b.ex = _end.x;
    b.ey = _end.y;
    b.ez = _end.z;

    // the head sweeps, so the bore sweeps: one carve every boreInterval at the point the beam hits
    k.bore += dt;
    if (_end.hit && k.bore >= B.boreInterval) {
      k.bore -= B.boreInterval;
      d.applyDamage({
        shape: 'cylinder',
        cx: _end.x - _dir.x * 0.4,
        cy: _end.y - _dir.y * 0.4,
        cz: _end.z - _dir.z * 0.4,
        dx: _dir.x,
        dy: _dir.y,
        dz: _dir.z,
        length: B.boreDepth,
        radius: B.boreRadius,
        source: 'beam',
        seed: (k.strike++ * 31) | 0,
      });
      kaiju.stats.bores++;
      emitDust(_end.x, _end.y, _end.z, 2, 3, 7, 4);
      addTraumaAt(0.1, _end.x, _end.y, _end.z, cam.x, cam.y, cam.z);
    }

    // the player in the beam
    if (distToSegment(player.eyeX, player.eyeY - 0.5, player.eyeZ, mz.x, mz.y, mz.z, _end.x, _end.y, _end.z) < B.playerRadius) {
      hurt((B.playerDamage * dt) / B.fireTime);
      kaiju.stats.playerHits++;
    }
  } else {
    b.power = Math.max(0, b.power - dt * 5);
    if (b.power <= 0) b.on = false;
    k.bore = 0;
  }
}

// ---- Ghidorah's gravity lightning ------------------------------------------------------

function lightning(k, d, dt, cam) {
  const ctl = k.ctl;
  const w = ctl.weapon;
  const L = KAIJU.lightning;
  const m = ctl.motion;
  fx.jaw[1].charge = m.charge;
  if (w.state !== 'firing') {
    k.strike = 0;
    return;
  }
  k.strike += dt;
  while (k.strike >= L.strikeInterval) {
    k.strike -= L.strikeInterval;
    for (let h = 0; h < L.heads; h++) strike(k, d, h, cam);
  }
}

function strike(k, d, h, cam) {
  const ctl = k.ctl;
  const L = KAIJU.lightning;
  const rng = k.rng;
  const hp = ctl.view.heads[h];
  const have = hp[1] > 0; // the rig has reported this head's position
  const hx = have ? hp[0] : ctl.x;
  const hy = have ? hp[1] : ctl.y + 20;
  const hz = have ? hp[2] : ctl.z;

  // mostly the city ahead; sometimes the player, if they are in range
  let tx;
  let tz;
  const px = player.body.x;
  const pz = player.body.z;
  if (rng() < 0.22 && Math.hypot(px - ctl.x, pz - ctl.z) < L.range) {
    tx = px + (rng() - 0.5) * 8;
    tz = pz + (rng() - 0.5) * 8;
  } else {
    const ang = ctl.yaw + (h - 1) * 0.5 + (rng() - 0.5) * 0.9;
    const dist = 25 + rng() * (L.range - 25);
    tx = ctl.x - Math.sin(ang) * dist;
    tz = ctl.z - Math.cos(ang) * dist;
  }
  const ty = Math.max(GROUND_Y + 1, world.topY(Math.floor(tx), Math.floor(tz)) + 1);

  const bolt = nextBolt();
  lightningBolt(hx, hy, hz, tx, ty, tz, BOLT_LEVELS, Math.hypot(tx - hx, ty - hy, tz - hz) * 0.06, rng, bolt.pts);
  bolt.ttl = bolt.life = 0.22;

  d.applyDamage({ shape: 'sphere', cx: tx, cy: ty, cz: tz, radius: L.strikeRadius, source: 'lightning', seed: (tx * 5 + tz * 3) | 0 });
  kaiju.stats.strikes++;
  emitDust(tx, ty, tz, 4, 4, 7, 4);
  addTraumaAt(0.2, tx, ty, tz, cam.x, cam.y, cam.z);
  if (Math.hypot(px - tx, pz - tz) < L.playerRadius && Math.abs(player.body.y - ty) < 8) {
    hurt(L.playerDamage / 4);
    kaiju.stats.playerHits++;
  }
}

// ---- debris ---------------------------------------------------------------------------

function throwDebris(d) {
  const n = d.removedCount;
  if (!n) return;
  const stride = Math.max(1, Math.ceil(n / KAIJU.destruction.debrisPerFrame));
  for (let i = 0; i < n; i += stride) {
    const x = d.rx[i];
    const y = d.ry[i];
    const z = d.rz[i];
    // pushed away from whichever kaiju is nearest
    let fx0 = x;
    let fz0 = z;
    let best = Infinity;
    for (const k of kaiju.list) {
      const dd = (k.ctl.x - x) ** 2 + (k.ctl.z - z) ** 2;
      if (dd < best) {
        best = dd;
        fx0 = k.ctl.x;
        fz0 = k.ctl.z;
      }
    }
    spawnDebris(x, y, z, d.rid[i], fx0, fz0, 1);
    kaiju.stats.debris++;
  }
  // a thin trickle of dust off the removed voxels
  const x = d.rx[0];
  const y = d.ry[0];
  const z = d.rz[0];
  if (n > 40) emitDust(x, y, z, 1, 4, 9, 3);
}
