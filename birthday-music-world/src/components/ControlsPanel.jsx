import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export const ControlsPanel = ({ movePlayer, fridgeMenu }) => {
  const menuOpen = fridgeMenu && fridgeMenu.isOpen;

  return (
    <div className="rounded-2xl shadow-xl p-4 sm:p-6" style={{ backgroundColor: 'rgba(237, 205, 187, 0.7)', border: '1px solid rgba(191, 146, 112, 0.4)' }}>
      <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: '#BF9270' }}>Controls</h3>

      {menuOpen ? (
        <>
          {/* Menu mode controls */}
          <div className="flex flex-col items-center gap-1 mb-4" style={{ color: '#BF9270' }}>
            <button
              onClick={() => fridgeMenu.navigate('up')}
              className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
              style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
            >
              <ArrowUp className="w-6 h-6" />
            </button>
            <button
              onClick={() => fridgeMenu.navigate('down')}
              className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
              style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
            >
              <ArrowDown className="w-6 h-6" />
            </button>
            <button
              onClick={() => fridgeMenu.close()}
              className="mt-2 px-4 py-2 bg-red-500 bg-opacity-40 hover:bg-opacity-60 active:bg-opacity-80 rounded-lg text-white font-bold text-sm touch-manipulation"
            >
              Close Fridge
            </button>
          </div>
          <p className="text-xs text-center" style={{ color: '#BF9270' }}>
            Navigate fridge menu
          </p>
        </>
      ) : (
        <>
          {/* D-Pad for mobile - keyboard layout */}
          <div className="flex flex-col items-center gap-1 mb-4" style={{ color: '#BF9270' }}>
            <button
              onClick={() => movePlayer(0, -1)}
              className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
              style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
            >
              <ArrowUp className="w-6 h-6" />
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => movePlayer(-1, 0)}
                className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
                style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => movePlayer(0, 1)}
                className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
                style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
              >
                <ArrowDown className="w-6 h-6" />
              </button>
              <button
                onClick={() => movePlayer(1, 0)}
                className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation"
                style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <p className="text-xs text-center" style={{ color: '#BF9270' }}>
            Tap arrows or use keyboard to move
          </p>
        </>
      )}
    </div>
  );
};
