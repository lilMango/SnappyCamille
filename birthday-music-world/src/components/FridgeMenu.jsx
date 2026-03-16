import React from 'react';

// 8x8 pixel art grids as SVG
const PixelIcon = ({ grid, size = 32 }) => {
  const cellSize = size / 8;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: 'pixelated' }}>
      {grid.map((row, y) =>
        row.map((color, x) =>
          color ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
};

const N = null; // transparent
const W = '#FFFFFF'; // white
const B = '#4A90D9'; // TJ's blue
const C = '#F5E6D3'; // cream/coconut
const G = '#4CAF50'; // green
const DG = '#2E7D32'; // dark green
const LG = '#81C784'; // light green
const R = '#E53935'; // red
const Y = '#FDD835'; // yellow
const O = '#FF9800'; // orange
const BR = '#795548'; // brown
const MG = '#66BB6A'; // matcha green
const DMG = '#388E3C'; // dark matcha
const GR = '#9E9E9E'; // grey
const DR = '#D32F2F'; // dark red
const P = '#E8D5B7'; // pale/dough

const ICONS = {
  yogurt: [
    [N, N, C, C, C, C, N, N],
    [N, B, W, W, W, W, B, N],
    [N, B, C, C, C, C, B, N],
    [N, B, W, C, C, W, B, N],
    [N, B, W, W, W, W, B, N],
    [N, B, W, W, W, W, B, N],
    [N, N, B, B, B, B, N, N],
    [N, N, N, B, B, N, N, N],
  ],
  salad: [
    [N, N, G, LG, G, LG, N, N],
    [N, G, DG, G, LG, G, LG, N],
    [G, LG, G, DG, G, LG, G, N],
    [G, DG, LG, R, G, DG, LG, G],
    [N, G, DG, G, LG, G, G, N],
    [N, N, G, LG, DG, G, N, N],
    [N, BR, BR, BR, BR, BR, BR, N],
    [N, N, BR, BR, BR, BR, N, N],
  ],
  pizza: [
    [N, N, N, Y, N, N, N, N],
    [N, N, Y, Y, Y, N, N, N],
    [N, Y, R, Y, R, Y, N, N],
    [N, Y, Y, Y, Y, Y, N, N],
    [Y, Y, R, Y, Y, R, Y, N],
    [Y, O, Y, Y, Y, Y, Y, N],
    [P, P, P, P, P, P, P, P],
    [N, P, P, P, P, P, P, N],
  ],
  matcha: [
    [N, N, MG, DMG, MG, N, N, N],
    [N, MG, DMG, MG, DMG, MG, N, N],
    [N, W, W, W, W, W, N, N],
    [N, W, MG, MG, MG, W, W, N],
    [N, W, MG, MG, MG, W, N, N],
    [N, W, W, W, W, W, N, N],
    [N, N, GR, GR, GR, N, N, N],
    [N, N, GR, GR, GR, N, N, N],
  ],
  close: [
    [N, N, N, N, N, N, N, N],
    [N, DR, N, N, N, N, DR, N],
    [N, N, DR, N, N, DR, N, N],
    [N, N, N, DR, DR, N, N, N],
    [N, N, N, DR, DR, N, N, N],
    [N, N, DR, N, N, DR, N, N],
    [N, DR, N, N, N, N, DR, N],
    [N, N, N, N, N, N, N, N],
  ],
};

export const FridgeMenu = ({ items, selectedIndex, activeMessage, onNavigate, onClose }) => {
  return (
    <>
      <style>{`
        @keyframes fridgeOpen {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{
            animation: 'fridgeOpen 0.25s ease-out',
            backgroundColor: '#FFEDDB',
            border: '4px solid #E3B7A0',
            borderRadius: '12px',
            padding: '20px',
            minWidth: '280px',
            maxWidth: '340px',
            fontFamily: 'monospace',
            boxShadow: '0 0 0 2px #BF9270, 0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Title */}
          <div style={{
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#BF9270',
            marginBottom: '16px',
            borderBottom: '2px solid #E3B7A0',
            paddingBottom: '8px',
          }}>
            What's in the fridge?
          </div>

          {/* Food items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((item, i) => (
              <div key={item.id}>
                <div
                  onClick={() => {
                    if (i !== selectedIndex) {
                      // Navigate to this item first
                      const diff = i - selectedIndex;
                      for (let d = 0; d < Math.abs(diff); d++) {
                        onNavigate(diff > 0 ? 'down' : 'up');
                      }
                    }
                    onNavigate('select');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: i === selectedIndex ? '#E3B7A0' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Selection cursor */}
                  <span style={{
                    color: '#BF9270',
                    fontWeight: 'bold',
                    width: '16px',
                    fontSize: '14px',
                  }}>
                    {i === selectedIndex ? '\u25B6' : ''}
                  </span>

                  {/* Pixel art icon */}
                  <PixelIcon grid={ICONS[item.id]} />

                  {/* Item name */}
                  <span style={{
                    color: item.id === 'close' ? '#C62828' : '#5c3d2e',
                    fontWeight: i === selectedIndex ? 'bold' : 'normal',
                    fontSize: '14px',
                  }}>
                    {item.name}
                  </span>
                </div>

                {/* Inline message */}
                {i === selectedIndex && activeMessage && item.id !== 'close' && (
                  <div style={{
                    marginLeft: '56px',
                    fontSize: '12px',
                    color: '#BF9270',
                    fontStyle: 'italic',
                    padding: '2px 8px 4px',
                    animation: 'fridgeOpen 0.2s ease-out',
                  }}>
                    {activeMessage}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Keyboard hint */}
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            color: '#BF9270',
            marginTop: '12px',
            borderTop: '1px solid #E3B7A0',
            paddingTop: '8px',
          }}>
            Arrow keys to navigate / Enter to select / Esc to close
          </div>

          {/* Mobile nav buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '12px',
          }}>
            <button
              onClick={() => onNavigate('up')}
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#EDCDBB',
                border: '2px solid #E3B7A0',
                borderRadius: '8px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#9650;
            </button>
            <button
              onClick={() => onNavigate('select')}
              style={{
                height: '48px',
                padding: '0 16px',
                backgroundColor: '#E3B7A0',
                border: '2px solid #BF9270',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#BF9270',
                cursor: 'pointer',
              }}
            >
              Select
            </button>
            <button
              onClick={() => onNavigate('down')}
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#EDCDBB',
                border: '2px solid #E3B7A0',
                borderRadius: '8px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#9660;
            </button>
            <button
              onClick={onClose}
              style={{
                height: '48px',
                padding: '0 16px',
                backgroundColor: '#FFCDD2',
                border: '2px solid #C62828',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#C62828',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
