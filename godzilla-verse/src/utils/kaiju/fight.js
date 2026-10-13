import { KAIJU } from '../../constants/kaijuConfig';
import { distToSegment } from './weapons';

/**
 * The fight (phase 7): the one place that sees both kaiju. A controller times its own actions and
 * raises events (a swipe's active frame, a grab reaching, a toss, a landing); this decides what
 * they hit, glues a held kaiju to its holder, launches the toss, and applies the damage.
 *
 *   fight.resolve(self, foe, events, buildings)   after self.step(): turn its events into hits
 *   fight.glue()                                  after both stepped: position held kaiju
 *   fight.beam(...) / fight.strike(...)           weapon damage on the other kaiju
 *   fight.effects                                 what happened this frame, for the effects layer
 *                                                 (hit | grab | toss | impact | flightCarve | ko | revive)
 *
 * Pure: no THREE, no DOM, no world (the destruction side of a toss is the caller's, from the effects).
 */

const F = KAIJU.fight;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _seg = {};

export class Fight {
  constructor(a, b, rng = Math.random) {
    this.kaiju = [a, b];
    this.rng = rng;
    this.effects = [];
    this.stats = { hits: 0, grabs: 0, tosses: 0, impacts: 0, kos: 0 };
  }

  foeOf(k) {
    return this.kaiju[0] === k ? this.kaiju[1] : this.kaiju[0];
  }

  /** Call once per frame before resolving, to clear last frame's effects. */
  begin() {
    this.effects.length = 0;
  }

  /** Turn `self`'s events into hits on `foe`. `buildings` (optional) are the toss targets. */
  resolve(self, foe, events, buildings = null) {
    for (const e of events) {
      switch (e.type) {
        case 'melee':
          this._melee(self, foe, e);
          break;
        case 'grab':
          this._grab(self, foe, e);
          break;
        case 'toss':
          this._toss(self, foe, buildings);
          break;
        case 'impact':
          // `self` is the one that landed (the controller already applied the fall damage)
          this.stats.impacts++;
          this.effects.push({ type: 'impact', who: self, x: e.x, y: e.y, z: e.z, power: Math.min(1, e.speed / 50) });
          break;
        case 'flightCarve':
          this.effects.push({ type: 'flightCarve', who: self, x: e.x, y: e.y, z: e.z, radius: e.radius });
          break;
        case 'ko':
          this.stats.kos++;
          this.effects.push({ type: 'ko', who: self });
          break;
        case 'revive':
          this.effects.push({ type: 'revive', who: self });
          break;
        default:
          break;
      }
    }
  }

  _inFront(self, foe, reach, cone) {
    const dx = foe.x - self.x;
    const dz = foe.z - self.z;
    const d = Math.hypot(dx, dz);
    if (d > reach) return null;
    if (Math.abs(wrap(Math.atan2(-dx, -dz) - self.yaw)) > cone) return null;
    return { dx, dz, d };
  }

  _melee(self, foe, e) {
    if (!foe.vulnerable) return;
    const r = this._inFront(self, foe, e.reach, 0.9);
    if (!r) return;
    const k = F.melee.knockback / (r.d || 1);
    const dealt = foe.hurt(e.damage, r.dx * k, r.dz * k);
    if (dealt > 0) {
      this.stats.hits++;
      this.effects.push({ type: 'hit', who: foe, by: self, x: foe.x, y: foe.y + foe.comHeight, z: foe.z, damage: dealt });
    }
  }

  _grab(self, foe, e) {
    const r = foe.vulnerable && foe.action.kind !== 'held' ? this._inFront(self, foe, e.reach, 0.9) : null;
    if (!r) {
      self.failGrab();
      return;
    }
    self.beginHold(foe);
    foe.beginHeld(self);
    this.stats.grabs++;
    this.effects.push({ type: 'grab', who: foe, by: self, x: foe.x, y: foe.y + foe.comHeight, z: foe.z });
    this.glue();
  }

  /** Launch the held kaiju: aimed at the tallest building ahead of the thrower, else straight ahead. */
  _toss(self, foe, buildings) {
    const victim = self.holding;
    self.holding = null;
    if (!victim || victim.action.kind !== 'held') return;
    let yaw = self.yaw;
    if (buildings && buildings.length) {
      const cone = (F.throwConeDeg * Math.PI) / 180;
      let best = null;
      for (const b of buildings) {
        const bx = (b.x0 + b.x1) / 2 - self.x;
        const bz = (b.z0 + b.z1) / 2 - self.z;
        const d = Math.hypot(bx, bz);
        if (d < F.throwMinRange || d > F.throwMaxRange) continue;
        const ang = wrap(Math.atan2(-bx, -bz) - self.yaw);
        if (Math.abs(ang) > cone) continue;
        const score = b.y1 - d * 0.05;
        if (!best || score > best.score) best = { score, yaw: Math.atan2(-bx, -bz) };
      }
      if (best) yaw = best.yaw;
    }
    const up = (F.launchDeg * Math.PI) / 180;
    const h = Math.cos(up) * F.launchSpeed;
    victim.beginThrow(-Math.sin(yaw) * h, Math.sin(up) * F.launchSpeed, -Math.cos(yaw) * h, victim.flying ? -4 : -3.2);
    this.stats.tosses++;
    this.effects.push({ type: 'toss', who: victim, by: self, x: victim.x, y: victim.y, z: victim.z });
  }

  /** Keep each held kaiju in its holder's grip; release anything whose holder can no longer hold. */
  glue() {
    for (const holder of this.kaiju) {
      const v = holder.holding;
      if (!v) continue;
      const holding = holder.action.kind === 'grab' && holder.action.phase === 'hold';
      if (!holding && holder.action.kind !== 'grab') {
        // the holder was knocked out or interrupted: the victim drops
        if (v.action.kind === 'held') v.beginThrow(0, 0, 0, 0);
        holder.holding = null;
        continue;
      }
      if (v.action.kind !== 'held') continue;
      const fx = holder.fwdX;
      const fz = holder.fwdZ;
      v.x = holder.x + fx * 14;
      v.z = holder.z + fz * 14;
      const handY = holder.y + (holder.flying ? -10 : 38);
      v.y = handY - (v.flying ? 0 : 28);
      v.yaw = wrap(holder.yaw + Math.PI);
    }
  }

  // ---- weapons on the other kaiju ------------------------------------------------------------

  /**
   * Atomic breath along (ox,oy,oz) + t*(dx,dy,dz), 0 <= t <= len, on `foe`: damage per second while it
   * passes through the body. Returns the damage dealt.
   */
  beam(self, foe, ox, oy, oz, dx, dy, dz, len, dt) {
    if (!foe.vulnerable) return 0;
    foe.hitSegment(_seg);
    const steps = Math.max(4, Math.ceil(len / 8));
    for (let i = 0; i <= steps; i++) {
      const t = (len * i) / steps;
      const d = distToSegment(ox + dx * t, oy + dy * t, oz + dz * t, _seg.ax, _seg.ay, _seg.az, _seg.bx, _seg.by, _seg.bz);
      if (d < _seg.r) {
        const dealt = foe.hurt(F.beamDps * dt);
        if (dealt > 0) this.effects.push({ type: 'hit', who: foe, by: self, x: foe.x, y: foe.y + foe.comHeight, z: foe.z, damage: dealt, beam: true });
        return dealt;
      }
    }
    return 0;
  }

  /** A lightning strike landing at (x,y,z) with blast radius `r`: damage if it is on the foe. */
  strike(self, foe, x, y, z, r) {
    if (!foe.vulnerable) return 0;
    foe.hitSegment(_seg);
    const d = distToSegment(x, y, z, _seg.ax, _seg.ay, _seg.az, _seg.bx, _seg.by, _seg.bz);
    if (d >= _seg.r + r) return 0;
    const dealt = foe.hurt(F.lightningDamage);
    if (dealt > 0) this.effects.push({ type: 'hit', who: foe, by: self, x, y, z, damage: dealt });
    return dealt;
  }
}
