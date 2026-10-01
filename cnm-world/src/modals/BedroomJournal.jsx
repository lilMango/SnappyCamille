import React, { useState } from 'react';

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
  backgroundColor: '#2d1b69',
  border: '4px solid #a78bfa',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '340px',
  fontFamily: 'monospace',
  color: 'white',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  textAlign: 'center',
};

export const BedroomJournal = ({ onClose, unlockRoom }) => {
  const [page, setPage] = useState(0);

  const pages = [
    {
      title: "Miguel's Journal",
      body: 'Dear Camille,\n\nThis house holds all the things I love most.\nLook for the hidden door — it leads somewhere just for us. 🌸',
      button: 'Turn the page...',
    },
    {
      title: '✨ A Secret',
      body: 'The wallpaper to the east shimmers.\nIf you look closely, you might find\na door that was never there before.',
      button: 'I found it!',
    },
  ];

  const handleNext = () => {
    if (page < pages.length - 1) {
      setPage((p) => p + 1);
    } else {
      unlockRoom('secret-room');
      onClose();
    }
  };

  const current = pages[page];

  return (
    <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
          📓 {current.title}
        </h2>
        <p style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-line', marginBottom: '24px', color: '#ddd6fe' }}>
          {current.body}
        </p>
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#7c3aed',
            border: '2px solid #a78bfa',
            borderRadius: '8px',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          {current.button}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            color: '#c4b5fd',
            fontFamily: 'monospace',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Close [Esc]
        </button>
      </div>
    </div>
  );
};
