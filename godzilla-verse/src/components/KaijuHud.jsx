import { useEffect, useState } from 'react';
import { kaiju, useGame } from '../store';

// The fight's HUD: a health bar for each kaiju under the score, and the title cards ("GODZILLA GRABS
// KING GHIDORAH!", "... IS DOWN!"). Polls the mutable `kaiju` state at 10 Hz, never a zustand field.

const COLORS = { godzilla: '#4cc7ff', ghidorah: '#ffc83d' };
const NAMES = { godzilla: 'GODZILLA', ghidorah: 'KING GHIDORAH' };

export default function KaijuHud() {
  const [s, setS] = useState({ bars: [], card: '', alpha: 0, cardId: 0 });
  const freeCam = useGame((st) => st.freeCam);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const a = kaiju.announce;
      const left = a.until - now;
      setS({
        bars: kaiju.list.map((k) => ({
          kind: k.ctl.kind,
          pct: Math.max(0, k.ctl.hp / k.ctl.maxHp),
          down: k.ctl.action.kind === 'downed' && k.ctl.action.ko,
        })),
        card: left > 0 ? a.text : '',
        alpha: left > 0 ? Math.min(1, left / 600) : 0,
        cardId: a.id,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  if (freeCam || !s.bars.length) return null;
  return (
    <>
      <div style={styles.bars}>
        {s.bars.map((b) => (
          <div key={b.kind} style={styles.barWrap}>
            <div style={{ ...styles.name, color: COLORS[b.kind] }}>{NAMES[b.kind]}{b.down ? '  — K.O.' : ''}</div>
            <div style={styles.track}>
              <div style={{ ...styles.fill, width: `${Math.round(b.pct * 100)}%`, background: b.pct < 0.25 ? '#ff5a4a' : COLORS[b.kind] }} />
            </div>
          </div>
        ))}
      </div>
      {s.card && (
        <div key={s.cardId} style={{ ...styles.card, opacity: s.alpha }}>
          {s.card}
        </div>
      )}
    </>
  );
}

const styles = {
  bars: {
    position: 'fixed',
    top: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 22,
    pointerEvents: 'none',
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  barWrap: { width: 210 },
  name: { fontSize: 11, letterSpacing: 2, marginBottom: 3, textShadow: '0 1px 3px #000' },
  track: { height: 9, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', transition: 'width 0.25s linear' },
  card: {
    position: 'fixed',
    top: '22%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 26px',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: 22,
    letterSpacing: 5,
    textShadow: '0 2px 6px #000',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
};
