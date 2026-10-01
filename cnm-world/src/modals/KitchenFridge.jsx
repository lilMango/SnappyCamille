import React, { useState } from 'react';

const FRIDGE_ITEMS = [
  { label: 'Coconut Yogurt', icon: '🥥', msg: "Trader Joe's finest!" },
  { label: 'Salad', icon: '🥗', msg: 'So fresh, so green!' },
  { label: 'Pizza', icon: '🍕', msg: 'A classic choice!' },
  { label: 'Matcha', icon: '🍵', msg: 'Zen in a cup!' },
  { label: 'Mochi', icon: '🍡', msg: 'Soft and delightful!' },
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
  backgroundColor: '#1565C0',
  border: '4px solid #90CAF9',
  borderRadius: '12px',
  padding: '24px',
  minWidth: '260px',
  fontFamily: 'monospace',
  color: 'white',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

export const KitchenFridge = ({ onClose }) => {
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('');

  const handleSelect = (idx) => {
    setSelected(idx);
    setMessage(FRIDGE_ITEMS[idx].msg);
  };

  return (
    <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
          🧊 The Fridge
        </h2>
        {FRIDGE_ITEMS.map((item, i) => (
          <button
            key={item.label}
            onClick={() => handleSelect(i)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              marginBottom: '6px',
              backgroundColor: selected === i ? '#42A5F5' : 'rgba(255,255,255,0.1)',
              border: selected === i ? '2px solid #90CAF9' : '2px solid transparent',
              borderRadius: '6px',
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {item.icon} {item.label}
          </button>
        ))}
        {message && (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#B3E5FC', textAlign: 'center' }}>
            {message}
          </p>
        )}
        <button
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '16px',
            padding: '8px',
            backgroundColor: 'rgba(255,100,100,0.4)',
            border: '2px solid rgba(255,100,100,0.7)',
            borderRadius: '6px',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Close Fridge [Esc]
        </button>
      </div>
    </div>
  );
};
