import React, { useState } from 'react';

const MEMORIES = [
  { icon: '🌸', title: 'Cherry Blossoms', caption: 'That perfect afternoon in the park. Time stood still.' },
  { icon: '🍜', title: 'Ramen Night', caption: 'Our first cold night, two bowls of tonkotsu between us.' },
  { icon: '🎵', title: 'Concert', caption: 'You knew every word. I pretended I did too.' },
  { icon: '🌅', title: 'Sunrise Hike', caption: 'Neither of us slept, but it was worth every second.' },
  { icon: '🐢', title: 'Turtle Beach', caption: "We found Cunty's ancestor here, we're sure of it." },
];

const modalStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 500,
};

const boxStyle = {
  backgroundColor: '#14532d',
  border: '4px solid #4ade80',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '340px',
  width: '90%',
  fontFamily: 'monospace',
  color: 'white',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  textAlign: 'center',
};

export const GardenAlbum = ({ onClose }) => {
  const [page, setPage] = useState(0);
  const memory = MEMORIES[page];

  return (
    <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          📷 Photo Album
        </h2>
        <div style={{ fontSize: '56px', marginBottom: '12px' }}>{memory.icon}</div>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#86efac' }}>
          {memory.title}
        </h3>
        <p style={{ fontSize: '13px', color: '#d1fae5', lineHeight: '1.6', marginBottom: '20px' }}>
          {memory.caption}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: page === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              color: page === 0 ? '#4ade8060' : 'white',
              fontFamily: 'monospace',
              cursor: page === 0 ? 'default' : 'pointer',
            }}
          >
            ← Prev
          </button>
          <span style={{ alignSelf: 'center', fontSize: '12px', color: '#86efac' }}>
            {page + 1}/{MEMORIES.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(MEMORIES.length - 1, p + 1))}
            disabled={page === MEMORIES.length - 1}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: page === MEMORIES.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              color: page === MEMORIES.length - 1 ? '#4ade8060' : 'white',
              fontFamily: 'monospace',
              cursor: page === MEMORIES.length - 1 ? 'default' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            color: '#86efac',
            fontFamily: 'monospace',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Close Album [Esc]
        </button>
      </div>
    </div>
  );
};
