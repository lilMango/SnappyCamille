import { UNLIMITED_GAS } from '../utils/worldSelect';

// ODM gear tuning (Attack-on-Titan style 3D manoeuvre gear). 1 block = 1 m.
//
// The rope is a hard distance constraint, not a spring: it removes only the *outward*
// radial velocity, so tangential speed is preserved exactly — which is what makes a swing a
// clean pendulum that gains speed as it falls, instead of a rubbery bounce.

export const ODM = {
  // ---- gas ----
  unlimitedGas: UNLIMITED_GAS, // nothing costs gas (the bar stays full); ?gas=limited turns the costs back on
  gasMax: 100,
  shotCost: 10, // per hook fired
  upkeep: 4, // per second, per attached rope
  reelCost: 10, // per second while reeling
  boostCost: 20, // per second while boosting
  dashCost: 18,
  refillGround: 25, // per second on the ground...
  refillGroundDelay: 0.4, // ...after this long without spending gas
  refillAir: 6, // a trickle while airborne...
  refillAirDelay: 1.5, // ...after this long without spending gas

  // ---- hooks ----
  range: 90, // metres
  assistDeg: 7, // aim-assist cone half-angle for the crosshair ray
  snapDeg: 25, // if the ray finds nothing, snap to a roof corner inside this cone
  snapMin: 12,
  snapMax: 85,
  chestHeight: 1.0, // the rope attaches here, above the feet

  // ---- rope ----
  reelSpeed: 18, // m/s the rope shortens
  minLen: 3,
  regrow: 3, // m/s the rope lengthens back toward its fired length once you stop reeling
  zipAccel: 20, // extra pull toward the anchor while reeling
  reelSpinMax: 1.25, // per-frame cap on the angular-momentum speed-up while reeling
  iterations: 3, // Gauss-Seidel passes, so two ropes at once converge

  // ---- movement ----
  boostAccel: 40,
  maxSpeed: 55,
  pump: 14, // forward input on the downswing adds speed along the arc
  drag: 0.0025, // quadratic air drag
  dashSpeed: 22,
  dashNoGravity: 0.12, // s of zero gravity after a dash
  releaseWindow: 0.25, // release this soon after the bottom of the arc for the pop
  releasePop: 1.1, // horizontal speed multiplier
  releaseLift: 1.5, // m/s added upward with the pop

  // ---- health ----
  fallSafeSpeed: 28, // landing faster than this hurts
  fallDamage: 2.5, // per m/s over (a terminal-velocity landing hurts a lot but doesn't kill from full health)
  wallSafeSpeed: 25,
  wallDamage: 3,
  maxHealth: 100,
};
