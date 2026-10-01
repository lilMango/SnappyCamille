import React from 'react';

export const InteractPrompt = ({ interactable, onInteract }) => (
  <button
    onClick={onInteract}
    style={{
      position: 'absolute',
      top: '22%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#FFEDDB',
      border: '2px solid #BF9270',
      borderRadius: '8px',
      padding: '6px 14px',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#BF9270',
      cursor: 'pointer',
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      whiteSpace: 'nowrap',
    }}
  >
    {interactable.promptText} [Enter]
  </button>
);
