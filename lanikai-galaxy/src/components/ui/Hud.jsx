import { useGame } from '../../store';

/** Minimal on-screen controls: music toggle + current-zone label. */
export default function Hud() {
  const musicOn = useGame((s) => s.musicOn);
  const toggleMusic = useGame((s) => s.toggleMusic);
  const zone = useGame((s) => s.activeZone);

  return (
    <>
      {zone && <div style={styles.zone}>{zone}</div>}
      <div style={styles.wrap}>
        <button style={styles.btn} onClick={toggleMusic} aria-label="toggle music">
          {musicOn ? '♪' : '𝄽'}
        </button>
      </div>
    </>
  );
}

const styles = {
  zone: {
    position: 'fixed',
    top: 'max(16px, env(safe-area-inset-top))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    padding: '7px 16px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(6px)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: '#3a3128',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
  },
  wrap: { position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', right: 16, zIndex: 50, display: 'flex', gap: 10 },
  btn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: 'none',
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(6px)',
    fontSize: 20,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
  },
};
