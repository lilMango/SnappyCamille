import { KAIJU } from '../../constants/kaijuConfig';

/**
 * The Director: rules about the fight as a whole, so two AIs can't spoil it.
 *   - at most one signature weapon at a time (the beam clash, phase 8, is the scripted exception),
 *     with a short gap after one ends so it reads as turns, not a stream;
 *   - a leash: when the fight's centre drifts too far from the player, both kaiju are pulled back
 *     toward the player so the show happens where they are.
 */

const F = KAIJU.fight;

export class Director {
  constructor(kaiju) {
    this.kaiju = kaiju;
    this.gap = 0;
    this._wasBusy = false;
    this._pull = { x: 0, z: 0, w: 0 };
  }

  update(dt) {
    const busy = this.kaiju.some((k) => k.busy);
    if (this._wasBusy && !busy) this.gap = F.beamGap;
    this._wasBusy = busy;
    this.gap = Math.max(0, this.gap - dt);
  }

  /** May this kaiju start its signature weapon right now? */
  mayBeam(c) {
    return this.gap === 0 && !this.kaiju.some((k) => k !== c && k.busy);
  }

  /** The leash. { x, z, w }: head toward (x, z) with weight w in 0..1 (0 = no pull). */
  pull(player) {
    const p = this._pull;
    let mx = 0;
    let mz = 0;
    for (const k of this.kaiju) {
      mx += k.x;
      mz += k.z;
    }
    mx /= this.kaiju.length;
    mz /= this.kaiju.length;
    const d = Math.hypot(mx - player.x, mz - player.z);
    if (d <= F.leash) {
      p.w = 0;
      return p;
    }
    p.x = player.x + ((mx - player.x) / d) * F.leash * 0.5;
    p.z = player.z + ((mz - player.z) / d) * F.leash * 0.5;
    p.w = Math.min(1, (d - F.leash) / 80);
    return p;
  }
}
