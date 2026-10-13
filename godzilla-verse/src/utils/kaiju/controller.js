import { KAIJU, KAIJU_BOUNDS } from '../../constants/kaijuConfig';
import { BASE_Y } from '../../constants/cityConfig';
import { sweepYaw } from './weapons';

/**
 * KaijuController: the single place a kaiju's body, abilities and animation state live.
 *
 * THE INTENT CONTRACT. A brain (the AI now, the player in phase 9) produces *intent* and never
 * actions; the controller turns intent into locomotion, abilities and effects:
 *
 *   intent = { moveX, moveZ,        world-space direction to walk, magnitude 0..1
 *              faceYaw,             yaw to face, or null to face the way it walks
 *              aimPitch,            (optional) pitch of the weapon while aiming; default -0.2
 *              wantBeam,            fire the signature weapon (atomic breath / gravity lightning)
 *              wantMelee,           a claw swipe (Godzilla) / neck lunge (Ghidorah)
 *              wantGrab,            grab the other kaiju; the fight resolves it and tosses
 *              wantRoar, wantDash,  (phase 9)
 *              clashPressure }      (phase 8: beam-clash mashing)
 *
 * Because both AI and player drive through this, abilities exist in exactly one place and
 * control can be swapped mid-fight with no state reconciliation.
 *
 * ACTIONS (phase 7). Besides the weapon machine (idle -> charging -> firing -> cooldown) a kaiju
 * is in exactly one action: none | melee | grab | stagger | held | thrown | downed. The controller
 * owns the timings and emits events; `fight.js` decides what they hit (it sees both kaiju).
 *
 * Yaw is the player's convention: forward = (-sin yaw, -cos yaw), so yaw 0 faces -z.
 * Pure: no THREE, no DOM — it runs in the unit tests.
 */

export const NEUTRAL_INTENT = Object.freeze({
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
});

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const F = KAIJU.fight;

export class KaijuController {
  /** @param kind 'godzilla' | 'ghidorah' */
  constructor(kind, rng = Math.random) {
    this.kind = kind;
    this.cfg = KAIJU[kind];
    this.flying = kind === 'ghidorah';
    this.weaponCfg = this.flying ? KAIJU.lightning : KAIJU.beam;
    this.rng = rng;

    const s = this.cfg.spawn;
    this.x = s.x;
    this.z = s.z;
    this.yaw = s.yaw;
    this.y = this.flying ? this.cfg.hoverY : BASE_Y; // feet (Godzilla) or body (Ghidorah) height
    this.speed = 0; // forward speed
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.time = 0;
    this.blocked = false; // pushed against the world bounds this frame

    // animation state the rig reads (it never touches the controller directly)
    this.motion = {
      speed: 0, // 0..1 of full speed
      turn: 0, // -1..1 turning
      phase: 0, // gait / flap phase (radians)
      charge: 0, // 0..1 weapon charge (drives every glow)
      firing: false,
      roar: 0,
      stagger: 0,
      hit: 0,
      bob: 0,
      aim: 0, // head yaw offset from the body while a weapon is out (radians)
      aimPitch: 0,
      attack: 0, // melee: -1..0 winding up, +1 striking, decaying back to 0
      grab: 0, // 0..1 reaching / holding
      lie: 0, // 0 upright .. 1 lying down (downed)
      pitch: 0, // tumble about the centre of mass while thrown (radians)
      roll: 0,
    };

    // signature weapon: idle -> charging -> firing -> cooldown -> idle
    this.weapon = { state: 'idle', t: 0, cooldown: this.weaponCfg.cooldown * 0.3, sweep: 0 };

    // body actions: none | melee | grab | stagger | held | thrown | downed
    this.action = { kind: 'none', phase: '', t: 0, dur: 0, by: null, ko: false, struck: false };
    this.cd = { melee: 0, grab: 0 };
    this.holding = null; // the kaiju this one is holding (set by beginHold, cleared by the fight at the toss)
    this.vel = { x: 0, y: 0, z: 0 }; // while thrown
    this.spin = 0; // tumble rate while thrown
    this.kos = 0;
    this.pending = []; // events raised outside step() (a KO from a hit), flushed by the next step

    this._carveT = 0;
    this._flightT = 0;
    this._footIndex = 0;
    this._stepsTaken = 0;
  }

  get fwdX() {
    return -Math.sin(this.yaw);
  }
  get fwdZ() {
    return -Math.cos(this.yaw);
  }

  get busy() {
    return this.weapon.state === 'charging' || this.weapon.state === 'firing';
  }

  /** Free to start something: standing, not mid-action (a stagger or a held/thrown/downed body is not). */
  get free() {
    return this.action.kind === 'none';
  }

  /** Can be hit / grabbed: not already thrown, held or lying down. */
  get vulnerable() {
    const k = this.action.kind;
    return k !== 'held' && k !== 'thrown' && k !== 'downed';
  }

  get comHeight() {
    return this.flying ? 0 : this.cfg.com;
  }

  /** The vertical-ish segment a beam / bolt must pass through to hit this kaiju: { ax,ay,az, bx,by,bz, r }. */
  hitSegment(out = {}) {
    out.ax = out.bx = this.x;
    out.az = out.bz = this.z;
    if (this.flying) {
      out.ay = this.y - 6;
      out.by = this.y + 22;
      out.r = 14;
    } else {
      out.ay = this.y + 4;
      out.by = this.y + 62;
      out.r = 9;
    }
    return out;
  }

  /** World position of foot 0 (left) or 1 (right): used for stomp craters and effects. */
  foot(i, out = { x: 0, z: 0 }) {
    const lat = (i === 0 ? -1 : 1) * this.cfg.radius * 0.85;
    const rx = Math.cos(this.yaw); // right = (cos, -sin)
    const rz = -Math.sin(this.yaw);
    out.x = this.x + rx * lat;
    out.z = this.z + rz * lat;
    return out;
  }

  // ---- being hurt -----------------------------------------------------------------------

  /**
   * Take damage. A hit of `staggerMin` or more interrupts melee/grab/weapon and staggers; hitting
   * zero health knocks it out (it lies there, then gets up with `reviveFrac` of its health).
   * `kx,kz` is a knockback in blocks. Returns the damage actually taken (0 if it can't be hit).
   */
  hurt(amount, kx = 0, kz = 0) {
    if (!this.vulnerable || amount <= 0) return 0;
    const m = this.motion;
    this.hp = Math.max(0, this.hp - amount);
    m.hit = 1;
    if (this.action.kind !== 'held') {
      this.x += kx;
      this.z += kz;
    }
    if (this.hp === 0) {
      this._startDowned(true);
    } else if (amount >= F.staggerMin && (this.action.kind === 'none' || this.action.kind === 'melee' || (this.action.kind === 'grab' && this.action.phase !== 'hold'))) {
      this._cancelWeapon();
      this._setAction('stagger', '', F.stagger);
      m.stagger = F.stagger;
    }
    return amount;
  }

  // ---- actions ---------------------------------------------------------------------------

  _setAction(kind, phase = '', dur = 0, extra = null) {
    const a = this.action;
    a.kind = kind;
    a.phase = phase;
    a.t = 0;
    a.dur = dur;
    a.by = null;
    a.ko = false;
    a.struck = false;
    if (extra) Object.assign(a, extra);
  }

  _cancelWeapon() {
    const w = this.weapon;
    if (w.state === 'charging' || w.state === 'firing') {
      w.state = 'cooldown';
      w.t = 0;
      w.sweep = 0;
    }
  }

  /** Called by the fight when this kaiju's grab connected: it now holds `victim`. */
  beginHold(victim) {
    this._setAction('grab', 'hold', F.grab.hold);
    this.holding = victim;
  }

  /** The grab missed: recover. */
  failGrab() {
    this._setAction('grab', 'release', F.grab.release);
    this.cd.grab = F.grab.cooldown * 0.5;
  }

  /** Called by the fight when the toss happens: this (held) kaiju becomes a ballistic body. */
  beginThrow(vx, vy, vz, spin) {
    this._setAction('thrown');
    this.motion.lie = 0;
    this.vel.x = vx;
    this.vel.y = vy;
    this.vel.z = vz;
    this.spin = spin;
    this._flightT = 0;
    this.speed = 0;
  }

  /** Called by the fight when a grab connects: this kaiju is held by `holder`. */
  beginHeld(holder) {
    this._cancelWeapon();
    this._setAction('held');
    this.action.by = holder;
    this.speed = 0;
  }

  _startDowned(ko) {
    this._cancelWeapon();
    this._setAction('downed', '', ko ? F.koDown : F.downTime, { ko });
    this.speed = 0;
    this.vel.x = this.vel.y = this.vel.z = 0;
    if (ko) {
      this.kos++;
      this.pending.push({ type: 'ko' });
    }
  }

  // ---- stepping ---------------------------------------------------------------------------

  /**
   * Advance by dt with the given intent. Returns this frame's events:
   *   { type: 'footfall', foot, x, z }       a foot planted
   *   { type: 'carve', capsules: [...] }     time to carve the body volume (ahead of motion)
   *   { type: 'weapon', state }              the weapon changed state
   *   { type: 'melee', reach, damage }       a swipe's active frame
   *   { type: 'grab', reach }                the grab reached out: the fight says whether it connected
   *   { type: 'toss' }                       the hold ended: the fight launches the held kaiju
   *   { type: 'flightCarve', x, y, z, radius }   a tossed kaiju is tearing through the city
   *   { type: 'impact', x, y, z, speed }     a tossed kaiju landed
   *   { type: 'ko' } / { type: 'revive' }
   */
  step(intent, dt, events = []) {
    events.length = 0;
    this.time += dt;
    for (const p of this.pending) events.push(p);
    this.pending.length = 0;

    const cfg = this.cfg;
    const m = this.motion;
    this.cd.melee = Math.max(0, this.cd.melee - dt);
    this.cd.grab = Math.max(0, this.cd.grab - dt);

    // one-shots that always decay
    m.hit = Math.max(0, m.hit - dt * 4);
    m.stagger = Math.max(0, m.stagger - dt);
    m.roar = intent.wantRoar ? Math.min(1, m.roar + dt * 4) : Math.max(0, m.roar - dt * 3);

    const a = this.action;
    if (a.kind === 'held' || a.kind === 'thrown' || a.kind === 'downed') {
      this._stepHelpless(dt, events);
      return events;
    }

    // ---- weapon state machine ----
    const w = this.weapon;
    const wc = this.weaponCfg;
    if (w.state === 'idle') {
      w.cooldown = Math.max(0, w.cooldown - dt);
      if (intent.wantBeam && w.cooldown === 0 && a.kind === 'none') this._setWeapon('charging', events);
    } else if (w.state === 'charging') {
      w.t += dt;
      m.charge = clamp(w.t / wc.chargeTime, 0, 1);
      if (w.t >= wc.chargeTime) this._setWeapon('firing', events);
    } else if (w.state === 'firing') {
      w.t += dt;
      m.charge = 1;
      w.sweep = clamp(w.t / wc.fireTime, 0, 1);
      if (w.t >= wc.fireTime) this._setWeapon('cooldown', events);
    } else {
      // cooldown: the glow fades fast, the weapon is unavailable for a while
      w.t += dt;
      m.charge = Math.max(0, m.charge - dt / 0.6);
      if (w.t >= wc.cooldown) {
        this._setWeapon('idle', events);
        w.cooldown = 0;
      }
    }
    m.firing = w.state === 'firing';
    // where the head points while the weapon is out: a yaw offset sweeping across the fire time,
    // and a pitch (the muzzle is ~60 blocks up, so a level beam would pass over the roofs)
    const sweepRad = ((wc.sweepDeg || 0) * Math.PI) / 180;
    const aimTarget = w.state === 'firing' ? sweepYaw(w.t, wc.fireTime, sweepRad) : w.state === 'charging' ? -sweepRad : 0;
    m.aim += (aimTarget - m.aim) * (w.state === 'firing' ? 1 : 1 - Math.exp(-dt * 6));
    const pitchTarget = this.busy ? (intent.aimPitch === undefined ? -0.2 : intent.aimPitch) : 0;
    m.aimPitch += (pitchTarget - m.aimPitch) * (this.busy ? 1 - Math.exp(-dt * 8) : 1);

    // ---- melee / grab ----
    this._stepAction(intent, dt, events);

    // ---- locomotion ----
    const want = Math.hypot(intent.moveX, intent.moveZ);
    const k = this.action.kind;
    const planted = this.busy || k === 'melee' || k === 'grab' || k === 'stagger';
    let targetYaw = this.yaw;
    if (intent.faceYaw !== null && intent.faceYaw !== undefined) targetYaw = intent.faceYaw;
    else if (want > 0.05) targetYaw = Math.atan2(-intent.moveX, -intent.moveZ);
    const err = wrap(targetYaw - this.yaw);
    const maxTurn = cfg.turnRate * dt * (this.busy ? 0.3 : k === 'melee' || k === 'grab' ? 0.5 : k === 'stagger' ? 0.1 : 1);
    const turn = clamp(err, -maxTurn, maxTurn);
    this.yaw = wrap(this.yaw + turn);
    m.turn = clamp(turn / Math.max(1e-6, cfg.turnRate * dt), -1, 1);

    // a heavy body: slow down when turning hard, and almost stop to fire / strike
    const align = Math.max(0, Math.cos(err));
    const strafing = intent.faceYaw !== null && intent.faceYaw !== undefined && want > 0.05;
    const wantSpeed = Math.min(1, want) * cfg.speed * (strafing ? 0.7 : align) * (planted ? (k === 'stagger' ? 0 : 0.1) : 1);
    // while strafing the body slides along its desired direction rather than its heading
    this.speed += (wantSpeed - this.speed) * (1 - Math.exp(-dt / cfg.accel));
    if (strafing) {
      const d = Math.hypot(intent.moveX, intent.moveZ) || 1;
      this.x += (intent.moveX / d) * this.speed * dt;
      this.z += (intent.moveZ / d) * this.speed * dt;
    } else {
      this.x += this.fwdX * this.speed * dt;
      this.z += this.fwdZ * this.speed * dt;
    }

    // keep inside the walls
    const B = KAIJU_BOUNDS;
    const cx = clamp(this.x, B.x0, B.x1);
    const cz = clamp(this.z, B.z0, B.z1);
    this.blocked = cx !== this.x || cz !== this.z;
    if (this.blocked) this.speed *= 0.5;
    this.x = cx;
    this.z = cz;

    m.speed = clamp(this.speed / cfg.speed, 0, 1);

    // ---- gait / flap ----
    if (this.flying) {
      m.phase += dt * (3.2 + m.speed * 2.2); // wing beats, faster when moving
      m.bob = Math.sin(this.time * 0.9) * cfg.bob;
      const target = cfg.hoverY + m.bob;
      // eased, so it glides back up after being dropped
      this.y += (target - this.y) * (1 - Math.exp(-dt * 2));
    } else {
      const prev = m.phase;
      m.phase += dt * Math.PI * 2 * cfg.stride * m.speed;
      // a footfall each time the phase crosses a multiple of pi, alternating feet
      if (m.speed > 0.2 && Math.floor(m.phase / Math.PI) > Math.floor(prev / Math.PI)) {
        const i = this._footIndex++ & 1;
        const f = this.foot(i);
        events.push({ type: 'footfall', foot: i, x: f.x, z: f.z });
        this._stepsTaken++;
      }
    }

    // posture eases back upright
    m.lie = Math.max(0, m.lie - dt * 1.5);
    m.pitch *= Math.exp(-dt * 8);
    m.roll *= Math.exp(-dt * 8);

    // ---- carve the body's volume ahead of its motion, a few times a second ----
    this._carveT += dt;
    if (this._carveT >= cfg.bodyCarveInterval) {
      // subtract rather than reset, so the average rate is exactly 1/interval whatever the frame rate
      this._carveT = Math.min(this._carveT - cfg.bodyCarveInterval, cfg.bodyCarveInterval);
      if (m.speed > 0.05 || this.flying) events.push({ type: 'carve', capsules: this.bodyCapsules() });
    }
    return events;
  }

  // melee, grab and stagger timings
  _stepAction(intent, dt, events) {
    const a = this.action;
    const m = this.motion;
    const M = F.melee;
    const G = F.grab;
    if (a.kind === 'none') {
      m.attack += (0 - m.attack) * (1 - Math.exp(-dt * 10));
      m.grab += (0 - m.grab) * (1 - Math.exp(-dt * 6));
      if (!this.busy) {
        if (intent.wantMelee && this.cd.melee === 0) this._setAction('melee', 'windup', M.windup + M.active + M.recover);
        else if (intent.wantGrab && this.cd.grab === 0) this._setAction('grab', 'reach', G.reach);
      }
      return;
    }
    a.t += dt;
    if (a.kind === 'stagger') {
      m.attack += (0 - m.attack) * (1 - Math.exp(-dt * 10));
      m.grab += (0 - m.grab) * (1 - Math.exp(-dt * 6));
      if (a.t >= a.dur) this._setAction('none');
    } else if (a.kind === 'melee') {
      if (a.t < M.windup) {
        m.attack = -(a.t / M.windup); // rearing back: 0 -> -1
      } else if (a.t < M.windup + M.active) {
        m.attack = 1;
        if (!a.struck) {
          a.struck = true;
          events.push({ type: 'melee', reach: this.cfg.meleeReach, damage: this.cfg.meleeDamage });
        }
      } else {
        m.attack = Math.max(0, 1 - (a.t - M.windup - M.active) / M.recover);
      }
      if (a.t >= a.dur) {
        this._setAction('none');
        this.cd.melee = M.cooldown;
      }
    } else if (a.kind === 'grab') {
      m.grab = Math.min(1, m.grab + dt * 3);
      if (a.phase === 'reach') {
        if (a.t >= a.dur) {
          a.phase = 'wait'; // the fight answers (beginHold / failGrab) within this frame
          events.push({ type: 'grab', reach: this.cfg.grabReach });
        }
      } else if (a.phase === 'hold') {
        if (a.t >= a.dur) {
          events.push({ type: 'toss' });
          this._setAction('grab', 'release', G.release);
          this.cd.grab = G.cooldown;
        }
      } else if (a.phase === 'release') {
        m.grab = Math.max(0, m.grab - dt * 4);
        if (a.t >= a.dur) this._setAction('none');
      } else if (a.phase === 'wait') {
        // nobody answered (no fight running): recover rather than hang
        if (a.t >= 0.3) this.failGrab();
      }
    }
  }

  // held / thrown / downed: the body is not under its own control
  _stepHelpless(dt, events) {
    const a = this.action;
    const m = this.motion;
    const cfg = this.cfg;
    a.t += dt;
    m.firing = false;
    m.charge = Math.max(0, m.charge - dt / 0.6);
    m.attack += (0 - m.attack) * (1 - Math.exp(-dt * 10));
    m.grab += (0 - m.grab) * (1 - Math.exp(-dt * 6));
    m.speed = Math.max(0, m.speed - dt * 4);
    this.speed = 0;
    if (this.flying) m.phase += dt * 5; // still flapping in a panic

    if (a.kind === 'held') {
      // the fight glues the position; the body hangs limp, leaning back
      m.pitch += (-0.35 - m.pitch) * (1 - Math.exp(-dt * 6));
      m.lie = Math.max(0, m.lie - dt * 2);
    } else if (a.kind === 'thrown') {
      const v = this.vel;
      v.y -= F.gravity * dt;
      this.x += v.x * dt;
      this.y += v.y * dt;
      this.z += v.z * dt;
      m.pitch += this.spin * dt; // tumbling about the centre of mass
      this._flightT += dt;
      const B = KAIJU_BOUNDS;
      const cx = clamp(this.x, B.x0, B.x1);
      const cz = clamp(this.z, B.z0, B.z1);
      if (cx !== this.x || cz !== this.z) {
        v.x = v.z = 0;
        this.x = cx;
        this.z = cz;
      }
      // it tears through whatever it passes through
      this._carveT += dt;
      if (this._carveT >= F.throwCarveInterval) {
        this._carveT = 0;
        events.push({ type: 'flightCarve', x: this.x, y: this.y + this.comHeight, z: this.z, radius: F.throwCarveRadius });
      }
      const ground = this.flying ? BASE_Y + 8 : BASE_Y;
      if (this.y <= ground && v.y < 0) {
        this.y = ground;
        events.push({ type: 'impact', x: this.x, y: this.y, z: this.z, speed: Math.hypot(v.x, v.y, v.z) });
        // the fall hurts (taken here, before it is "downed", which can't be hit); zero health = knocked out
        this.hp = Math.max(0, this.hp - F.impactDamage);
        m.hit = 1;
        this._startDowned(this.hp === 0);
        this.motion.pitch = 0;
      }
    } else {
      // downed: falls over, lies there, then gets up
      const rising = a.t > a.dur - 0.9;
      m.lie = clamp(m.lie + dt * (rising ? -1.1 : 1.6), 0, 1);
      m.pitch *= Math.exp(-dt * 6);
      if (this.flying) {
        const ground = BASE_Y + 8;
        const target = rising ? cfg.hoverY : ground;
        this.y += (target - this.y) * (1 - Math.exp(-dt * (rising ? 1.5 : 4)));
      }
      if (a.t >= a.dur) {
        if (a.ko) {
          this.hp = this.maxHp * F.reviveFrac;
          events.push({ type: 'revive' });
        }
        this._setAction('none');
        this.weapon.state = 'cooldown';
        this.weapon.t = 0;
        this.weapon.cooldown = 0;
        this.cd.melee = 1;
      }
    }
  }

  _setWeapon(state, events) {
    this.weapon.state = state;
    this.weapon.t = 0;
    if (state === 'charging') this.motion.charge = 0;
    events.push({ type: 'weapon', state });
  }

  /**
   * The volume this kaiju occupies, as capsules for the destruction system:
   *   Godzilla: the legs/torso column, plus a low tail sweeping behind him.
   *   Ghidorah: a horizontal body capsule at his hover height.
   */
  bodyCapsules() {
    const c = this.cfg;
    const fx = this.fwdX;
    const fz = this.fwdZ;
    if (this.flying) {
      return [{ cx: this.x - fx * 9, cy: this.y, cz: this.z - fz * 9, ax: this.x + fx * 9, ay: this.y, az: this.z + fz * 9, radius: c.bodyCarveRadius }];
    }
    const feet = this.y;
    return [
      { cx: this.x, cy: feet + 2, cz: this.z, ax: this.x, ay: feet + c.bodyCarveHeight, az: this.z, radius: c.bodyCarveRadius },
      // the tail: low, trailing behind, thinner
      { cx: this.x - fx * 8, cy: feet + 4, cz: this.z - fz * 8, ax: this.x - fx * 50, ay: feet + 12, az: this.z - fz * 50, radius: 3.0 },
    ];
  }

  /** The weapon's muzzle (Godzilla's jaw) in world space. */
  muzzle(out = { x: 0, y: 0, z: 0 }) {
    const g = KAIJU.godzilla.muzzle;
    const s = KAIJU.scale;
    out.x = this.x + this.fwdX * g.fwd * s;
    out.y = this.y + g.y * s;
    out.z = this.z + this.fwdZ * g.fwd * s;
    return out;
  }
}
