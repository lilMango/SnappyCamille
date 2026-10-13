import { useRef } from 'react';
import { input } from '../utils/input';
import { useGame } from '../store';
import { CAMERA } from '../constants/playerConfig';

// Touch controls, writing into the same `input` object as the keyboard:
//   left half  : floating joystick (push past the ring to sprint)
//   right half : drag to look
//   buttons    : jump, break, place, camera
// Only mounted on touch devices.

const RADIUS = 55; // joystick throw in px
const LOOK_SCALE = CAMERA.touchLookSpeed / CAMERA.lookSpeed; // InputController applies lookSpeed

export default function MobileControls() {
  const freeCam = useGame((s) => s.freeCam);
  const stick = useRef({ id: null, ox: 0, oy: 0 });
  const look = useRef({ id: null, x: 0, y: 0 });
  const baseEl = useRef();
  const knobEl = useRef();

  if (freeCam) return null;

  const stickStart = (e) => {
    const t = e.changedTouches[0];
    stick.current = { id: t.identifier, ox: t.clientX, oy: t.clientY };
    baseEl.current.style.display = 'block';
    baseEl.current.style.left = `${t.clientX}px`;
    baseEl.current.style.top = `${t.clientY}px`;
    knobEl.current.style.transform = 'translate(-50%, -50%)';
  };
  const stickMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== stick.current.id) continue;
      const dx = t.clientX - stick.current.ox;
      const dy = t.clientY - stick.current.oy;
      const len = Math.hypot(dx, dy);
      const k = len > RADIUS ? RADIUS / len : 1; // knob stays inside the ring
      input.touchMx = (dx * k) / RADIUS;
      input.touchMz = (-dy * k) / RADIUS;
      input.touchSprint = len > RADIUS * 1.35;
      knobEl.current.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    }
  };
  const stickEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== stick.current.id) continue;
      stick.current.id = null;
      input.touchMx = 0;
      input.touchMz = 0;
      input.touchSprint = false;
      baseEl.current.style.display = 'none';
    }
  };

  const lookStart = (e) => {
    const t = e.changedTouches[0];
    look.current = { id: t.identifier, x: t.clientX, y: t.clientY };
  };
  const lookMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== look.current.id) continue;
      input.lastLookT = performance.now() / 1000;
      input.lookDX += (t.clientX - look.current.x) * LOOK_SCALE;
      input.lookDY += (t.clientY - look.current.y) * LOOK_SCALE;
      look.current.x = t.clientX;
      look.current.y = t.clientY;
    }
  };
  const lookEnd = (e) => {
    for (const t of e.changedTouches) if (t.identifier === look.current.id) look.current.id = null;
  };

  // press/release a button that sets a flag in `input`
  const hold = (key) => ({
    onTouchStart: (e) => {
      e.stopPropagation();
      input[key] = true;
    },
    onTouchEnd: () => {
      input[key] = false;
    },
    onTouchCancel: () => {
      input[key] = false;
    },
  });

  return (
    <div style={styles.root} onContextMenu={(e) => e.preventDefault()}>
      <div style={styles.leftZone} onTouchStart={stickStart} onTouchMove={stickMove} onTouchEnd={stickEnd} onTouchCancel={stickEnd} />
      <div style={styles.rightZone} onTouchStart={lookStart} onTouchMove={lookMove} onTouchEnd={lookEnd} onTouchCancel={lookEnd} />

      <div ref={baseEl} style={styles.stickBase}>
        <div ref={knobEl} style={styles.stickKnob} />
      </div>

      <button type="button" style={{ ...styles.btn, right: 22, bottom: 110, width: 76, height: 76 }} {...hold('touchJump')}>
        JUMP
      </button>
      <button type="button" style={{ ...styles.btn, right: 112, bottom: 70, ...styles.small }} {...hold('breakHeld')}>
        BREAK
      </button>
      <button type="button" style={{ ...styles.btn, right: 112, bottom: 150, ...styles.small }} {...hold('placeHeld')}>
        PLACE
      </button>
      {/* ODM gear: hold a hook button to fire and stay attached; release to let go */}
      <button type="button" style={{ ...styles.btn, right: 196, bottom: 150, ...styles.mid }} {...hold('touchHookL')}>
        L HOOK
      </button>
      <button type="button" style={{ ...styles.btn, right: 196, bottom: 78, ...styles.mid }} {...hold('touchHookR')}>
        R HOOK
      </button>
      <button type="button" style={{ ...styles.btn, right: 268, bottom: 114, ...styles.mid }} {...hold('touchReel')}>
        REEL
      </button>
      <button
        type="button"
        style={{ ...styles.btn, right: 22, bottom: 196, ...styles.mid }}
        onTouchStart={(e) => {
          e.stopPropagation();
          input.dashPressed = true;
        }}
      >
        DASH
      </button>
      <button
        type="button"
        style={{ ...styles.btn, right: 12, top: 'calc(env(safe-area-inset-top, 0px) + 12px)', ...styles.tiny }}
        onTouchStart={(e) => {
          e.stopPropagation();
          useGame.getState().cycleCamera();
        }}
      >
        CAM
      </button>
    </div>
  );
}

const btn = {
  position: 'absolute',
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.55)',
  background: 'rgba(20,28,52,0.5)',
  color: '#fff',
  font: '700 12px/1 ui-monospace, monospace',
  letterSpacing: 1,
  pointerEvents: 'auto',
  touchAction: 'none',
  backdropFilter: 'blur(4px)',
};

const styles = {
  root: { position: 'fixed', inset: 0, zIndex: 38, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' },
  leftZone: { position: 'absolute', left: 0, top: 0, width: '45%', height: '100%', pointerEvents: 'auto', touchAction: 'none' },
  rightZone: { position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', pointerEvents: 'auto', touchAction: 'none' },
  stickBase: {
    display: 'none',
    position: 'absolute',
    width: RADIUS * 2,
    height: RADIUS * 2,
    marginLeft: -RADIUS,
    marginTop: -RADIUS,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.08)',
    pointerEvents: 'none',
  },
  stickKnob: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 46,
    height: 46,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.45)',
    transform: 'translate(-50%, -50%)',
  },
  btn,
  small: { width: 62, height: 62 },
  mid: { width: 56, height: 56, font: '700 10px/1 ui-monospace, monospace' },
  tiny: { width: 46, height: 46, font: '700 10px/1 ui-monospace, monospace' },
};
