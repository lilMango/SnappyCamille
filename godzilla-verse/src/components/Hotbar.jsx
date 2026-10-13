import { useGame } from '../store';
import { HOTBAR } from '../constants/playerConfig';
import { BLOCK_COLOR, BLOCK_DEFS } from '../constants/blocks';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// Nine slots, bottom centre. Slots are clickable/tappable (wheel and 1-9 also select).
export default function Hotbar() {
  const selected = useGame((s) => s.hotbarIndex);
  const select = useGame((s) => s.selectHotbar);
  const freeCam = useGame((s) => s.freeCam);
  if (freeCam) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.name}>{BLOCK_DEFS[HOTBAR[selected]].name.replace('_', ' ')}</div>
      <div style={styles.row}>
        {HOTBAR.map((id, i) => (
          <button
            key={i}
            type="button"
            aria-label={`slot ${i + 1}: ${BLOCK_DEFS[id].name}`}
            onClick={() => select(i)}
            onTouchStart={() => select(i)}
            style={{ ...styles.slot, ...(i === selected ? styles.slotOn : null) }}
          >
            <span style={{ ...styles.swatch, background: hex(BLOCK_COLOR[id]) }} />
            <span style={styles.num}>{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
    transform: 'translateX(-50%)',
    zIndex: 41,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    pointerEvents: 'none',
  },
  name: {
    color: '#fff',
    font: '600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  row: { display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: 'rgba(8,12,24,0.55)', backdropFilter: 'blur(4px)' },
  slot: {
    position: 'relative',
    width: 42,
    height: 42,
    padding: 0,
    borderRadius: 5,
    border: '2px solid rgba(255,255,255,0.25)',
    background: 'rgba(0,0,0,0.35)',
    cursor: 'pointer',
    pointerEvents: 'auto',
    touchAction: 'manipulation',
  },
  slotOn: { border: '2px solid #fff', boxShadow: '0 0 0 2px rgba(255,255,255,0.35)', transform: 'translateY(-3px)' },
  swatch: { position: 'absolute', inset: 6, borderRadius: 3, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.45)' },
  num: {
    position: 'absolute',
    top: 1,
    left: 4,
    color: '#fff',
    font: '700 10px/1 ui-monospace, monospace',
    textShadow: '0 1px 2px #000',
  },
};
