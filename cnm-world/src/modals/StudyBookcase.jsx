import React, { useState } from 'react';

const BOOKS = [
  { title: 'Pachinko', author: 'Min Jin Lee', note: "A multigenerational saga of resilience. Camille's all-time fave." },
  { title: 'The Alchemist', author: 'Paulo Coelho', note: 'Follow your Personal Legend.' },
  { title: 'Norwegian Wood', author: 'Haruki Murakami', note: 'Melancholy and beautiful. Perfect for rainy days.' },
  { title: 'Atomic Habits', author: 'James Clear', note: '1% better every day. We keep meaning to finish this one.' },
  { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', note: '"It is only with the heart that one can see rightly."' },
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
  backgroundColor: '#1e293b',
  border: '4px solid #64748b',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '360px',
  width: '90%',
  fontFamily: 'monospace',
  color: 'white',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

export const StudyBookcase = ({ onClose }) => {
  const [selected, setSelected] = useState(null);

  return (
    <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
          📚 Bookcase
        </h2>
        {BOOKS.map((book, i) => (
          <button
            key={book.title}
            onClick={() => setSelected(i === selected ? null : i)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              marginBottom: '6px',
              backgroundColor: selected === i ? '#334155' : 'rgba(255,255,255,0.06)',
              border: selected === i ? '2px solid #64748b' : '2px solid transparent',
              borderRadius: '6px',
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: '#94a3b8' }}>{book.author}</span>
            {' — '}{book.title}
          </button>
        ))}
        {selected !== null && (
          <p style={{ marginTop: '10px', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
            {BOOKS[selected].note}
          </p>
        )}
        <button
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '14px',
            padding: '8px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            color: '#94a3b8',
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
