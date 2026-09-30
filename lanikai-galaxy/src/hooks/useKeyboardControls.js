import { useEffect, useRef } from 'react';

/**
 * Tracks movement input from the keyboard.
 * Returns a ref to { forward, strafe, turn } in [-1, 1].
 *   W/Up = forward, S/Down = back
 *   A/Left, D/Right = turn (rotate heading)
 *   Q / E = strafe left/right
 */
export function useKeyboardControls() {
  const input = useRef({ forward: 0, strafe: 0, turn: 0, jump: false, turnAround: false });

  useEffect(() => {
    const keys = new Set();

    const recompute = () => {
      const i = input.current;
      // Back (S / ↓) no longer steps backward — it triggers a turn-around below.
      i.forward = keys.has('w') || keys.has('arrowup') ? 1 : 0;
      i.turn = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
      i.strafe = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
    };

    const down = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      const fresh = !keys.has(k); // ignore auto-repeat for edge-triggered actions
      if (k === ' ' && fresh) input.current.jump = true;
      if ((k === 's' || k === 'arrowdown') && fresh) input.current.turnAround = true;
      keys.add(k);
      recompute();
    };
    const up = (e) => {
      keys.delete(e.key.toLowerCase());
      recompute();
    };
    const blur = () => {
      keys.clear();
      recompute();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  return input;
}
