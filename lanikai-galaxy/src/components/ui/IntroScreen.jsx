import { useGame } from '../../store';

/**
 * Title / entry overlay. Tapping "Enter" is the required user gesture that
 * unlocks the AudioContext (iOS) before the world's music can play.
 */
export default function IntroScreen() {
  const start = useGame((s) => s.start);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.kicker}>a little island planet, made for you</div>
        <h1 style={styles.title}>Lanikai Galaxy</h1>
        <p style={styles.sub}>
          Stroll the sand, wander up into the valley, and follow the music around the island.
        </p>
        <button style={styles.btn} onClick={start}>
          Enter ✦
        </button>
        <div style={styles.hint}>
          <b>W</b> walk · <b>A D</b> turn · <b>S</b> turn around · <b>Space</b> jump · on phone, joystick + ⤒
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 30%, rgba(170,225,255,0.55), rgba(40,110,170,0.85))',
    backdropFilter: 'blur(3px)',
    zIndex: 100,
  },
  card: {
    textAlign: 'center',
    padding: '2.4rem 2rem',
    maxWidth: 440,
    color: '#33403f',
  },
  kicker: { textTransform: 'uppercase', letterSpacing: 3, fontSize: 12, opacity: 0.7, marginBottom: 10 },
  title: { fontSize: 'clamp(2.2rem, 7vw, 3.4rem)', fontWeight: 800, letterSpacing: -1, marginBottom: 12, color: '#2b3635' },
  sub: { fontSize: 15, lineHeight: 1.6, opacity: 0.85, marginBottom: 28 },
  btn: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(180deg, #2ec4c9, #1d8fc0)',
    border: 'none',
    borderRadius: 999,
    padding: '0.85rem 2.6rem',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(20,90,140,0.35)',
  },
  hint: { marginTop: 26, fontSize: 12.5, opacity: 0.7 },
};
