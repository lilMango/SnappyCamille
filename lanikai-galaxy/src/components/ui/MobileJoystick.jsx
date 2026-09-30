import { useEffect, useRef, useState } from 'react';

/**
 * Touch joystick for phones. Vertical drag => forward/back, horizontal => turn.
 * Writes into the shared inputRef ({ forward, strafe, turn }). Hidden on
 * non-touch devices.
 */
export default function MobileJoystick({ inputRef }) {
  const [touch, setTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const baseRef = useRef(null);
  const originRef = useRef(null);
  const RADIUS = 55;

  useEffect(() => {
    setTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const backLatch = useRef(false); // so a single pull-back triggers one turn-around

  const reset = () => {
    inputRef.current.forward = 0;
    inputRef.current.turn = 0;
    backLatch.current = false;
    setKnob({ x: 0, y: 0 });
    originRef.current = null;
  };

  const handle = (clientX, clientY) => {
    if (!originRef.current) return;
    let dx = clientX - originRef.current.x;
    let dy = clientY - originRef.current.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const fwd = -dy / RADIUS; // up = forward
    inputRef.current.forward = Math.max(0, fwd); // no backward step
    inputRef.current.turn = -dx / RADIUS; // left = turn left (matches key mapping)
    // Pulling the stick firmly back = turn around (once per pull).
    if (fwd < -0.55 && !backLatch.current) {
      inputRef.current.turnAround = true;
      backLatch.current = true;
    } else if (fwd > -0.35) {
      backLatch.current = false;
    }
  };

  if (!touch) return null;

  return (
    <>
      <button
        style={styles.jump}
        onTouchStart={(e) => {
          e.preventDefault();
          inputRef.current.jump = true;
        }}
        aria-label="jump"
      >
        ⤒
      </button>
      <div
        ref={baseRef}
        style={styles.zone}
      onTouchStart={(e) => {
        const t = e.touches[0];
        originRef.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        handle(t.clientX, t.clientY);
      }}
      onTouchEnd={reset}
      onTouchCancel={reset}
    >
        <div style={{ ...styles.base, transform: originRef.current ? 'scale(1)' : 'scale(0.85)' }}>
          <div style={{ ...styles.knob, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      </div>
    </>
  );
}

const styles = {
  jump: {
    position: 'fixed',
    right: 'max(28px, env(safe-area-inset-right))',
    bottom: 'max(56px, env(safe-area-inset-bottom))',
    width: 74,
    height: 74,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.32)',
    color: '#2b3635',
    fontSize: 30,
    fontWeight: 700,
    zIndex: 41,
    touchAction: 'none',
  },
  zone: {
    position: 'fixed',
    left: 0,
    bottom: 0,
    width: '55%',
    height: '45%',
    zIndex: 40,
    touchAction: 'none',
  },
  base: {
    position: 'absolute',
    left: 'max(30px, env(safe-area-inset-left))',
    bottom: 'max(40px, env(safe-area-inset-bottom))',
    width: 130,
    height: 130,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.28)',
    border: '2px solid rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.12s',
  },
  knob: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.85)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
  },
};
