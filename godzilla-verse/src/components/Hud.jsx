import { useEffect, useRef, useState } from 'react';
import { player, odm, useGame } from '../store';
import { ODM } from '../constants/odmConfig';

// Gameplay HUD: HEALTH and GAS bars bottom-left, SCORE top-centre. Polls the mutable
// `player` / `odm` objects at 10 Hz — never a 60 Hz zustand field, so React doesn't re-render per frame.
export default function Hud() {
  const [s, setS] = useState({ health: 100, gas: 100, score: 0, roped: 0, hurt: false });
  const lastHealth = useRef(100);
  const hurtUntil = useRef(0);
  const freeCam = useGame((st) => st.freeCam);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      if (player.health < lastHealth.current - 0.5) hurtUntil.current = now + 350;
      lastHealth.current = player.health;
      setS({
        health: Math.max(0, player.health),
        gas: odm.gas,
        score: player.score,
        roped: (odm.anchors[0].active ? 1 : 0) + (odm.anchors[1].active ? 1 : 0),
        hurt: now < hurtUntil.current,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  if (freeCam) return null;
  const gasPct = Math.round((s.gas / ODM.gasMax) * 100);
  // on a narrow window the hotbar reaches the left edge, so lift the bars above it
  const narrow = typeof window !== 'undefined' && window.innerWidth < 1000;
  const low = gasPct < 20;

  return (
    <>
      {s.hurt && <div style={styles.vignette} />}
      <div style={styles.score}>
        <span style={styles.scoreLabel}>SCORE</span>
        <span style={styles.scoreValue}>{s.score.toLocaleString()}</span>
      </div>
      <div style={{ ...styles.bars, bottom: `calc(env(safe-area-inset-bottom, 0px) + ${narrow ? 78 : 14}px)` }}>
        <Bar label="HEALTH" pct={Math.round((s.health / ODM.maxHealth) * 100)} color="#e5484d" />
        <Bar label="GAS" pct={gasPct} color={low ? '#ff9f43' : '#4cc2ff'} flash={low} />
      </div>
    </>
  );
}

function Bar({ label, pct, color, flash }) {
  return (
    <div style={styles.barRow}>
      <span style={styles.barLabel}>{label}</span>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%`, background: color, animation: flash ? 'gvflash 0.5s linear infinite alternate' : 'none' }} />
      </div>
      <span style={styles.pct}>{pct}%</span>
      <style>{'@keyframes gvflash{from{opacity:1}to{opacity:.35}}'}</style>
    </div>
  );
}

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const styles = {
  score: {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 39,
    display: 'flex',
    gap: 10,
    alignItems: 'baseline',
    padding: '6px 16px',
    borderRadius: 8,
    background: 'rgba(8,12,24,0.55)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'none',
    font: `600 12px/1 ${mono}`,
    color: '#cdd6f4',
  },
  scoreLabel: { letterSpacing: 2, color: '#8d97c4', fontSize: 11 },
  scoreValue: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 1 },
  bars: {
    position: 'fixed',
    left: 'calc(env(safe-area-inset-left, 0px) + 14px)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
    zIndex: 39,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(8,12,24,0.55)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'none',
  },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, font: `700 10px/1 ${mono}`, color: '#cdd6f4' },
  barLabel: { width: 48, letterSpacing: 1 },
  track: { width: 120, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.1s linear' },
  pct: { width: 30, textAlign: 'right', color: '#9aa4bf' },
  vignette: {
    position: 'fixed',
    inset: 0,
    zIndex: 37,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse at center, rgba(229,72,77,0) 45%, rgba(229,72,77,0.45) 100%)',
  },
};
