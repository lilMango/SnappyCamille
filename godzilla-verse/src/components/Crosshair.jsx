import { useGame } from '../store';

// Screen-centre "+". `difference` blending keeps it visible on any background.
export default function Crosshair() {
  const freeCam = useGame((s) => s.freeCam);
  if (freeCam) return null;
  return (
    <div style={styles.wrap} aria-hidden="true">
      <span style={{ ...styles.bar, width: 16, height: 2 }} />
      <span style={{ ...styles.bar, width: 2, height: 16 }} />
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    zIndex: 39,
    pointerEvents: 'none',
    mixBlendMode: 'difference',
  },
  bar: { position: 'absolute', background: '#fff', transform: 'translate(-50%, -50%)' },
};
