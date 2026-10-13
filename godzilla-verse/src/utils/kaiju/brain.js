import { KAIJU_BOUNDS } from '../../constants/kaijuConfig';

/**
 * The phase-6 AI: it wanders the city, heading for buildings, and fires its weapon when one is
 * ahead. It speaks only the intent contract (see controller.js), so the phase-7 combat brain and
 * the phase-9 player controller are drop-in replacements.
 *
 *   const brain = new WanderBrain(rng);
 *   const intent = brain.think(controller, { buildings, player: {x, z} }, dt);
 */

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class WanderBrain {
  constructor(rng = Math.random, opts = {}) {
    this.rng = rng;
    this.target = null; // { x, z }
    this.retargetIn = 0;
    this.forceBeam = false;
    this.arriveDist = opts.arriveDist ?? 28;
    this.beamChance = opts.beamChance ?? 0.35; // per second, while a building is in the sights
    this.intent = {
      moveX: 0,
      moveZ: 0,
      faceYaw: null,
      wantBeam: false,
      wantMelee: false,
      wantGrab: false,
      wantRoar: false,
      wantDash: false,
      clashPressure: 0,
    };
  }

  _pickTarget(c, ctx) {
    const bs = ctx.buildings;
    const B = KAIJU_BOUNDS;
    for (let attempt = 0; attempt < 12; attempt++) {
      let x;
      let z;
      if (bs && bs.length && this.rng() < 0.85) {
        // a building, biased toward ones near the player so the show happens where they are
        const b = bs[Math.floor(this.rng() * bs.length)];
        x = (b.x0 + b.x1) / 2;
        z = (b.z0 + b.z1) / 2;
        if (ctx.player && this.rng() < 0.6) {
          const d = Math.hypot(x - ctx.player.x, z - ctx.player.z);
          if (d > 160) continue;
        }
      } else {
        x = B.x0 + this.rng() * (B.x1 - B.x0);
        z = B.z0 + this.rng() * (B.z1 - B.z0);
      }
      x = Math.max(B.x0, Math.min(B.x1, x));
      z = Math.max(B.z0, Math.min(B.z1, z));
      if (Math.hypot(x - c.x, z - c.z) > 45) return { x, z };
    }
    return { x: (B.x0 + B.x1) / 2, z: (B.z0 + B.z1) / 2 };
  }

  /** @returns the shared intent object (valid until the next call) */
  think(c, ctx, dt) {
    const it = this.intent;
    this.retargetIn -= dt;
    if (!this.target || this.retargetIn <= 0 || Math.hypot(this.target.x - c.x, this.target.z - c.z) < this.arriveDist) {
      this.target = this._pickTarget(c, ctx);
      this.retargetIn = 25 + this.rng() * 20;
    }

    const dx = this.target.x - c.x;
    const dz = this.target.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    it.moveX = dx / d;
    it.moveZ = dz / d;
    it.faceYaw = null;

    // fire when a building is in the sights and the weapon is ready
    it.wantBeam = false;
    if (c.weapon.state === 'idle' && c.weapon.cooldown === 0 && ctx.buildings && this.rng() < this.beamChance * dt) {
      const range = c.weaponCfg.range;
      for (const b of ctx.buildings) {
        const bx = (b.x0 + b.x1) / 2 - c.x;
        const bz = (b.z0 + b.z1) / 2 - c.z;
        const bd = Math.hypot(bx, bz);
        if (bd < 30 || bd > range) continue;
        const ang = Math.abs(wrap(Math.atan2(-bx, -bz) - c.yaw));
        if (ang < 0.35) {
          it.wantBeam = true;
          break;
        }
      }
    }
    // test / scripted hook: fire as soon as the weapon allows, then clear
    if (this.forceBeam) {
      if (c.weapon.state === 'idle') {
        c.weapon.cooldown = 0;
        it.wantBeam = true;
      } else {
        this.forceBeam = false;
      }
    }
    return it;
  }
}
