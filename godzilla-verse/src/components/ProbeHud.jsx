import { useGame } from '../store';

// Phase 0 only: surfaces the deployment-pipeline probes so a glance at the live
// URL tells you whether subpath assets and module workers work on the FTP host.
export default function ProbeHud() {
  const probe = useGame((s) => s.probe);
  const row = (label, value) => {
    const bad = String(value).startsWith('FAILED');
    return (
      <div style={styles.row} key={label}>
        <span style={styles.label}>{label}</span>
        <span style={{ color: bad ? '#ff6b6b' : value === 'pending' ? '#9aa4bf' : '#7dffa8' }}>{value}</span>
      </div>
    );
  };
  return (
    <div style={styles.wrap}>
      <div style={styles.title}>GODZILLA-VERSE · phase 7</div>
      {row('base', probe.base)}
      {row('atlas', probe.atlas)}
      {row('module worker', probe.worker)}
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
    zIndex: 40,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(8, 12, 24, 0.72)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(120, 160, 255, 0.25)',
    color: '#e6ecff',
    font: '12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace',
    pointerEvents: 'none',
  },
  title: { letterSpacing: 1.5, color: '#7aa2ff', marginBottom: 4, fontWeight: 600 },
  row: { display: 'flex', gap: 10 },
  label: { color: '#9aa4bf', minWidth: 96 },
};
