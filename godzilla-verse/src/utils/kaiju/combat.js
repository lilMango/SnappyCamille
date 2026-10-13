/**
 * The phase-7 AI: it fights the other kaiju. Like every brain it speaks only the intent contract
 * (controller.js); everything it "does" — swiping, grabbing, breathing — is the controller turning
 * a want into an action, and `fight.js` deciding what lands.
 *
 *   const brain = new CombatBrain(rng);
 *   const intent = brain.think(controller, { foe, director, player, buildings }, dt);
 *
 * What it does, in rough order of preference:
 *   - helpless (held / thrown / downed / staggered): nothing, there is nothing to decide;
 *   - the foe is down: close in and stand over it (no kicking a downed kaiju: the fight is about the toss);
 *   - weapon ready, the Director agrees, the foe is in range and ahead: breathe / strike;
 *   - in reach: swipe, grab, or back off, at random;
 *   - otherwise close the distance, then circle (strafing keeps it facing the foe).
 * `force` ('melee' | 'grab' | 'beam') makes it do that next, whatever else it would do: for tests and scripted beats.
 */

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CombatBrain {
  constructor(rng = Math.random, opts = {}) {
    this.rng = rng;
    this.decideT = 0.8 + rng() * 0.8;
    this.retreatT = 0;
    this.strafe = rng() < 0.5 ? -1 : 1;
    this.strafeT = 2 + rng() * 3;
    this.force = null;
    this.forceBeam = false; // same hook as WanderBrain, for the checks
    this.beamChance = opts.beamChance ?? 0.5;
    this.state = 'approach'; // for debugging / the HUD: approach | circle | retreat | hold | helpless
    this.intent = {
      moveX: 0,
      moveZ: 0,
      faceYaw: null,
      aimPitch: undefined,
      wantBeam: false,
      wantMelee: false,
      wantGrab: false,
      wantRoar: false,
      wantDash: false,
      clashPressure: 0,
    };
  }

  /** @returns the shared intent object (valid until the next call) */
  think(c, ctx, dt) {
    const it = this.intent;
    it.moveX = it.moveZ = 0;
    it.faceYaw = null;
    it.aimPitch = undefined;
    it.wantBeam = it.wantMelee = it.wantGrab = false;
    if (this.forceBeam) {
      this.force = 'beam';
      this.forceBeam = false;
    }

    const foe = ctx.foe;
    if (!foe || !c.vulnerable) {
      this.state = 'helpless';
      return it;
    }
    const dx = foe.x - c.x;
    const dz = foe.z - c.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;
    const toFoe = Math.atan2(-dx, -dz);
    it.faceYaw = toFoe;
    const reach = c.cfg.meleeReach;
    const aimed = Math.abs(wrap(toFoe - c.yaw)) < 0.5;

    // pitch the weapon at the foe (the muzzle is high up; a level beam would pass over a low target)
    const muzzleY = c.flying ? c.y + 20 : c.y + 62;
    const foeY = foe.flying ? foe.y + 6 : foe.y + 30;
    it.aimPitch = Math.max(-0.4, Math.min(0.5, Math.atan2(foeY - muzzleY, dist)));

    // committed to something: stand and face the foe
    if (c.busy || c.action.kind === 'melee' || c.action.kind === 'grab' || c.action.kind === 'stagger') {
      this.state = 'hold';
      if (this.force && (c.busy || c.action.kind !== 'none')) this.force = null;
      return it;
    }

    this.decideT -= dt;
    this.retreatT -= dt;
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = -this.strafe;
      this.strafeT = 2 + this.rng() * 3;
    }

    // ---- scripted beats ----
    if (this.force) {
      if (this.force === 'beam') {
        c.weapon.cooldown = 0;
        it.wantBeam = true;
      } else if (this.force === 'melee') {
        c.cd.melee = 0;
        it.wantMelee = true;
      } else if (this.force === 'grab') {
        c.cd.grab = 0;
        it.wantGrab = true;
      }
      return it;
    }

    // ---- what to do ----
    const foeDown = !foe.vulnerable;
    if (!foeDown && this.decideT <= 0) {
      this.decideT = 0.4 + this.rng() * 0.6;
      const beamReady = c.weapon.state === 'idle' && c.weapon.cooldown === 0 && (!ctx.director || ctx.director.mayBeam(c));
      if (beamReady && dist > 38 && dist < c.weaponCfg.range - 10 && aimed && this.rng() < this.beamChance) {
        it.wantBeam = true;
      } else if (dist <= reach * 1.05) {
        const r = this.rng();
        if (r < 0.55 && c.cd.melee === 0) it.wantMelee = true;
        else if (r < 0.8 && c.cd.grab === 0) it.wantGrab = true;
        else this.retreatT = 1.5;
      }
    }

    // ---- where to go ----
    let mx = 0;
    let mz = 0;
    if (foeDown) {
      this.state = dist > 50 ? 'approach' : 'hold';
      if (dist > 50) {
        mx = nx;
        mz = nz;
      }
    } else if (this.retreatT > 0) {
      this.state = 'retreat';
      mx = -nx;
      mz = -nz;
    } else if (dist > reach * 0.85) {
      this.state = dist > 70 ? 'approach' : 'circle';
      mx = nx + -nz * this.strafe * (dist > 70 ? 0 : 0.5);
      mz = nz + nx * this.strafe * (dist > 70 ? 0 : 0.5);
    } else {
      this.state = 'circle';
      mx = -nz * this.strafe;
      mz = nx * this.strafe;
    }

    // the Director's leash: drift toward the player if the fight wandered off
    const pull = ctx.director && ctx.player ? ctx.director.pull(ctx.player) : null;
    if (pull && pull.w > 0) {
      const px = pull.x - c.x;
      const pz = pull.z - c.z;
      const pd = Math.hypot(px, pz) || 1;
      mx = mx * (1 - pull.w) + (px / pd) * pull.w;
      mz = mz * (1 - pull.w) + (pz / pd) * pull.w;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1e-3) {
      it.moveX = mx / len;
      it.moveZ = mz / len;
    }
    return it;
  }
}
