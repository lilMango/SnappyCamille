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
 *              wantBeam,            fire the signature weapon (atomic breath / gravity lightning)
 *              wantMelee, wantGrab, wantRoar, wantDash,   (phase 7+: accepted, ignored for now)
 *              clashPressure }                           (phase 8: beam-clash mashing)
 *
 * Because both AI and player drive through this, abilities exist in exactly one place and
 * control can be swapped mid-fight with no state reconciliation.
 *
 * Yaw is the player's convention: forward = (-sin yaw, -cos yaw), so yaw 0 faces -z.
 * Pure: no THREE, no DOM — it runs in the unit tests.
 */

export const NEUTRAL_INTENT = Object.freeze({
  moveX: 0,
  moveZ: 0,
  faceYaw: null,
  wantBeam: false,
  wantMelee: false,
  wantGrab: false,
  wantRoar: false,
  wantDash: false,
  clashPressure: 0,
});

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
    };

    // signature weapon: idle -> charging -> firing -> cooldown -> idle
    this.weapon = { state: 'idle', t: 0, cooldown: this.weaponCfg.cooldown * 0.3, sweep: 0 };

    this._carveT = 0;
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

  /** World position of foot 0 (left) or 1 (right): used for stomp craters and effects. */
  foot(i, out = { x: 0, z: 0 }) {
    const lat = (i === 0 ? -1 : 1) * this.cfg.radius * 0.85;
    const rx = Math.cos(this.yaw); // right = (cos, -sin)
    const rz = -Math.sin(this.yaw);
    out.x = this.x + rx * lat;
    out.z = this.z + rz * lat;
    return out;
  }

  /**
   * Advance by dt with the given intent. Returns this frame's events:
   *   { type: 'footfall', foot, x, z }       a foot planted
   *   { type: 'carve', capsule: {...} }      time to carve the body volume (ahead of motion)
   *   { type: 'weapon', state }              the weapon changed state
   */
  step(intent, dt, events = []) {
    events.length = 0;
    this.time += dt;
    const cfg = this.cfg;
    const m = this.motion;

    // ---- weapon state machine ----
    const w = this.weapon;
    const wc = this.weaponCfg;
    if (w.state === 'idle') {
      w.cooldown = Math.max(0, w.cooldown - dt);
      if (intent.wantBeam && w.cooldown === 0) this._setWeapon('charging', events);
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
    // and a fixed downward pitch (the muzzle is ~60 blocks up, so level beams would pass over the roofs)
    const sweepRad = ((wc.sweepDeg || 0) * Math.PI) / 180;
    const aimTarget = w.state === 'firing' ? sweepYaw(w.t, wc.fireTime, sweepRad) : w.state === 'charging' ? -sweepRad : 0;
    m.aim += (aimTarget - m.aim) * (w.state === 'firing' ? 1 : 1 - Math.exp(-dt * 6));
    m.aimPitch = w.state === 'firing' || w.state === 'charging' ? -0.2 : 0;

    // ---- locomotion ----
    const want = Math.hypot(intent.moveX, intent.moveZ);
    const aiming = this.busy; // while charging or firing it plants its feet and turns slowly
    let targetYaw = this.yaw;
    if (intent.faceYaw !== null && intent.faceYaw !== undefined) targetYaw = intent.faceYaw;
    else if (want > 0.05) targetYaw = Math.atan2(-intent.moveX, -intent.moveZ);
    const err = wrap(targetYaw - this.yaw);
    const maxTurn = cfg.turnRate * dt * (aiming ? 0.3 : 1);
    const turn = clamp(err, -maxTurn, maxTurn);
    this.yaw = wrap(this.yaw + turn);
    m.turn = clamp(turn / Math.max(1e-6, cfg.turnRate * dt), -1, 1);

    // a heavy body: slow down when turning hard, and almost stop to fire
    const align = Math.max(0, Math.cos(err));
    const wantSpeed = Math.min(1, want) * cfg.speed * align * (aiming ? 0.1 : 1);
    this.speed += (wantSpeed - this.speed) * (1 - Math.exp(-dt / cfg.accel));
    this.x += this.fwdX * this.speed * dt;
    this.z += this.fwdZ * this.speed * dt;

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
      this.y = cfg.hoverY + m.bob;
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

    // ---- decaying one-shots ----
    m.hit = Math.max(0, m.hit - dt * 4);
    m.stagger = Math.max(0, m.stagger - dt);
    m.roar = intent.wantRoar ? Math.min(1, m.roar + dt * 4) : Math.max(0, m.roar - dt * 3);

    // ---- carve the body's volume ahead of its motion, a few times a second ----
    this._carveT += dt;
    if (this._carveT >= cfg.bodyCarveInterval) {
      // subtract rather than reset, so the average rate is exactly 1/interval whatever the frame rate
      this._carveT = Math.min(this._carveT - cfg.bodyCarveInterval, cfg.bodyCarveInterval);
      if (m.speed > 0.05 || this.flying) events.push({ type: 'carve', capsules: this.bodyCapsules() });
    }
    return events;
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
