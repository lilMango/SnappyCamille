import { useEffect, useRef, useState } from 'react';
import { city, stats } from '../store';
import { WORLD_KIND } from '../utils/worldSelect';

const LABELS = {
  ground: 'Laying foundations',
  roads: 'Paving the streets',
  blocks: 'Raising the sidewalks',
  park: 'Planting the park',
  bay: 'Filling the bay',
  wall: 'Raising the wall',
  buildings: 'Constructing towers',
  lights: 'Lighting the streets',
  finishing: 'Finishing touches',
  streaming: 'Delivering the city',
};

// Covers the screen while the city generates (in a worker) and the first view is meshed.
// Polls the mutable `city` / `stats` objects at 10 Hz; React never re-renders per frame.
export default function LoadingScreen() {
  const [s, setS] = useState({ pct: 0, label: 'Starting', ready: false, error: '' });
  const [gone, setGone] = useState(false);
  const peak = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      let pct;
      let label;
      if (!city.generated) {
        pct = city.pct * 0.86;
        label = LABELS[city.label] || 'Generating the city';
      } else {
        const queue = stats.dirty + stats.inFlight;
        peak.current = Math.max(peak.current, queue, 1);
        pct = 0.86 + 0.14 * (1 - queue / peak.current);
        label = 'Building the skyline';
      }
      setS({ pct: city.ready ? 1 : pct, label, ready: city.ready, error: city.error });
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!s.ready) return undefined;
    const t = setTimeout(() => setGone(true), 700); // let the fade finish
    return () => clearTimeout(t);
  }, [s.ready]);

  if (WORLD_KIND !== 'city' || gone) return null;

  return (
    <div style={{ ...styles.wrap, opacity: s.ready ? 0 : 1, pointerEvents: s.ready ? 'none' : 'auto' }}>
      <div style={styles.title}>GODZILLA-VERSE</div>
      <div style={styles.sub}>dusk over the harbour city</div>
      <div style={styles.bar}>
        <div style={{ ...styles.fill, width: `${Math.round(s.pct * 100)}%` }} />
      </div>
      <div style={styles.label}>
        {s.error ? `Something went wrong: ${s.error}` : `${s.label.toUpperCase()} — ${Math.round(s.pct * 100)}%`}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    background: 'radial-gradient(ellipse at 50% 60%, #2a2547 0%, #0b1020 70%)',
    color: '#e6ecff',
    transition: 'opacity 0.6s ease',
    font: '14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  title: { fontSize: 'clamp(26px, 6vw, 54px)', fontWeight: 800, letterSpacing: '0.28em', color: '#9fc2ff', textShadow: '0 0 24px rgba(120,160,255,0.45)' },
  sub: { color: '#a59ccb', letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase' },
  bar: { width: 'min(360px, 70vw)', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', background: 'linear-gradient(90deg, #5aa0ff, #b99cff)', transition: 'width 0.15s linear' },
  label: { fontSize: 11, letterSpacing: '0.18em', color: '#8d97c4' },
};
