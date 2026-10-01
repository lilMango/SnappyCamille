import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap } from 'lucide-react';

export const ControlsPanel = ({ movePlayer, onInteract, hasInteraction, isModalOpen }) => (
  <div className="rounded-2xl shadow-xl p-4 sm:p-6" style={{ backgroundColor: 'rgba(237, 205, 187, 0.7)', border: '1px solid rgba(191, 146, 112, 0.4)' }}>
    <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: '#BF9270' }}>Controls</h3>

    <div className="flex flex-col items-center gap-1 mb-4" style={{ color: '#BF9270' }}>
      <button
        onClick={() => movePlayer(0, -1)}
        disabled={isModalOpen}
        className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation disabled:opacity-30"
        style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
      >
        <ArrowUp className="w-6 h-6" />
      </button>
      <div className="flex gap-1">
        <button
          onClick={() => movePlayer(-1, 0)}
          disabled={isModalOpen}
          className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation disabled:opacity-30"
          style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => movePlayer(0, 1)}
          disabled={isModalOpen}
          className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation disabled:opacity-30"
          style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          onClick={() => movePlayer(1, 0)}
          disabled={isModalOpen}
          className="w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation disabled:opacity-30"
          style={{ backgroundColor: 'rgba(191, 146, 112, 0.2)', border: '1px solid rgba(191, 146, 112, 0.3)' }}
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>

    {(hasInteraction || isModalOpen) && (
      <button
        onClick={onInteract}
        className="w-full mt-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 touch-manipulation"
        style={{ backgroundColor: '#E3B7A0', border: '1px solid #BF9270', color: '#BF9270' }}
      >
        <Zap className="w-4 h-4" />
        {isModalOpen ? 'Close [Esc]' : 'Enter / Interact'}
      </button>
    )}

    <p className="text-xs text-center mt-3" style={{ color: '#BF9270' }}>
      Tap arrows or use keyboard (WASD / arrows)
    </p>
  </div>
);
