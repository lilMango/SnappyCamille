import { Component } from 'react';

// WebGL can be unavailable (blocked, headless, out of contexts). Without a boundary
// the thrown renderer error unmounts the whole tree and the visitor sees a blank page.
export default class GlErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[godzilla-verse] 3D renderer failed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>3D unavailable</div>
          <div style={styles.body}>
            This game needs WebGL, and your browser couldn&apos;t start it. Try enabling hardware
            acceleration, or open the page in a recent Chrome, Safari or Firefox.
          </div>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#e6ecff',
  },
  card: {
    maxWidth: 420,
    padding: '20px 24px',
    borderRadius: 14,
    background: 'rgba(20, 28, 52, 0.85)',
    border: '1px solid rgba(120, 160, 255, 0.3)',
    textAlign: 'center',
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: 1 },
  body: { fontSize: 14, lineHeight: 1.5, color: '#b7c3e6' },
};
