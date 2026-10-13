import { useEffect, useState } from 'react';
import { stats } from '../store';

// Polls the mutable `stats` object at ~4 Hz. React never re-renders per frame.
export default function DebugPanel() {
  const [s, setS] = useState({ ...stats });
  useEffect(() => {
    const id = setInterval(() => setS({ ...stats }), 250);
    return () => clearInterval(id);
  }, []);

  const rows = [
    ['world', `${s.world} (${s.genMs.toFixed(0)} ms)`],
    ['fps', s.fps.toFixed(0)],
    ['draw calls', s.calls],
    ['triangles', s.triangles.toLocaleString()],
    ['geometries', s.geometries],
    ['sections', `${s.meshes} meshed / ${s.sections} filled`],
    ['active columns', s.activeCols],
    ['quads', s.quads.toLocaleString()],
    ['GPU geometry', `${s.gpuMB.toFixed(1)} MB`],
    ['dirty / in flight', `${s.dirty} / ${s.inFlight}`],
    ['workers', s.workers || 'off (main thread)'],
    ['remesh latency', `${s.latAvg.toFixed(1)} avg · ${s.latMax.toFixed(0)} max ms`],
    ['mesh mgr ms/frame', s.meshMs.toFixed(2)],
    ['pos', `${s.x.toFixed(0)}, ${s.y.toFixed(0)}, ${s.z.toFixed(0)}`],
    ['fly speed', `${s.speed.toFixed(0)} m/s`],
  ];

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>ENGINE</div>
      {rows.map(([label, value]) => (
        <div style={styles.row} key={label}>
          <span style={styles.label}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <div style={styles.hint}>
        {s.locked
          ? 'WASD move · Space/E up · C/Q down · Shift fast · wheel speed · G wireframe · Esc release'
          : 'Click the scene to look around'}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
    zIndex: 40,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(8, 12, 24, 0.72)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(120, 160, 255, 0.25)',
    color: '#e6ecff',
    font: '12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace',
    pointerEvents: 'none',
    maxWidth: 340,
  },
  title: { letterSpacing: 1.5, color: '#7aa2ff', marginBottom: 4, fontWeight: 600 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 14 },
  label: { color: '#9aa4bf' },
  hint: { marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(120,160,255,0.2)', color: '#9aa4bf', fontSize: 11 },
};
