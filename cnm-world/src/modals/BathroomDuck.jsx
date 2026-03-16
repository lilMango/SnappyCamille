import React from 'react';

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
  backgroundColor: '#0c4a6e',
  border: '4px solid #38bdf8',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '300px',
  fontFamily: 'monospace',
  color: 'white',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  textAlign: 'center',
};

export const BathroomDuck = ({ onClose }) => (
  <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div style={boxStyle}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🦆</div>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
        Mr. Quackers
      </h2>
      <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#bae6fd', marginBottom: '20px' }}>
        This little rubber duck has been here since the very beginning.
        <br /><br />
        He has seen things. He will not speak of them.
        <br /><br />
        <em style={{ color: '#7dd3fc' }}>...quack.</em>
      </p>
      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#0284c7',
          border: '2px solid #38bdf8',
          borderRadius: '8px',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        Put duck down [Esc]
      </button>
    </div>
  </div>
);
