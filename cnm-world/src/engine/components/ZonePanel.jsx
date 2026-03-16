import React from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

export const ZonePanel = ({ currentZone, isPlaying, toggleMusic }) => {
  if (!currentZone) return null;
  return (
    <div
      className="rounded-2xl shadow-xl p-4 sm:p-6 border-2"
      style={{ backgroundColor: currentZone.color, borderColor: currentZone.color }}
    >
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-4">
        {currentZone.name}
      </h2>
      <button
        onClick={toggleMusic}
        className="w-full bg-white text-gray-900 font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl flex items-center justify-center gap-2 sm:gap-3 hover:bg-gray-100 transition-all shadow-lg text-sm sm:text-base"
      >
        {isPlaying ? (
          <>
            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
            Pause Music
          </>
        ) : (
          <>
            <Play className="w-5 h-5 sm:w-6 sm:h-6" />
            Play Music
          </>
        )}
      </button>
      {isPlaying && (
        <div className="mt-3 sm:mt-4 flex items-center gap-2 text-white">
          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          <span className="text-xs sm:text-sm">Music fades as you explore...</span>
        </div>
      )}
    </div>
  );
};
