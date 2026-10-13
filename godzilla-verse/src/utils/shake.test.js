import { describe, test, expect } from 'bun:test';
import { addTrauma, addTraumaAt, tickShake, traumaNow, resetShake, SHAKE } from './shake';

const out = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 0 };
const magnitude = (o) => Math.abs(o.yaw) + Math.abs(o.pitch) + Math.abs(o.roll) + Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.z);

describe('shake', () => {
  test('no trauma means a perfectly still camera', () => {
    resetShake();
    tickShake(1 / 60, out);
    expect(magnitude(out)).toBe(0);
  });

  test('trauma is capped at 1 and decays to zero', () => {
    resetShake();
    addTrauma(0.8);
    addTrauma(0.8);
    expect(traumaNow()).toBe(1);
    for (let i = 0; i < 120; i++) tickShake(1 / 60, out);
    expect(traumaNow()).toBe(0);
    expect(magnitude(out)).toBe(0);
  });

  test('shake scales with trauma squared: half the trauma is well under half the shake', () => {
    const peak = (t) => {
      resetShake();
      addTrauma(t);
      let m = 0;
      for (let i = 0; i < 6; i++) m = Math.max(m, magnitude(tickShake(1 / 240, out)));
      return m;
    };
    expect(peak(0.5)).toBeLessThan(peak(1) * 0.45);
    expect(peak(1)).toBeGreaterThan(0.01);
  });

  test('stays inside its configured amplitude bounds', () => {
    resetShake();
    addTrauma(1);
    for (let i = 0; i < 40; i++) {
      tickShake(1 / 60, out);
      expect(Math.abs(out.yaw)).toBeLessThanOrEqual(SHAKE.maxYaw + 1e-9);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(SHAKE.maxOffset + 1e-9);
    }
  });

  test('a distant source shakes less than a near one', () => {
    resetShake();
    addTraumaAt(1, 0, 0, 0, 0, 0, 0);
    const near = traumaNow();
    resetShake();
    addTraumaAt(1, 100, 0, 0, 0, 0, 0);
    expect(traumaNow()).toBeLessThan(near * 0.3);
  });
});
