import React, { useState, useCallback, useEffect, useRef } from 'react';
import PlumeriaIntro from './components/PlumeriaIntro';
import { GameMap } from './components/GameMap';
import { ZonePanel } from './components/ZonePanel';
import { ControlsPanel } from './components/ControlsPanel';
import { FridgeMenu } from './components/FridgeMenu';
import { usePlayer } from './hooks/usePlayer';
import { useZone } from './hooks/useZone';
import { useAudio } from './hooks/useAudio';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { useFridgeMenu } from './hooks/useFridgeMenu';
import { SCALED_MAP_SIZE, FURNITURE_SCALE } from './constants/gameConfig';

// Fridge bounds for proximity check (from furnitureData: x:0.7, y:2, w:1.5, h:3, scale 2.25)
const FRIDGE_RIGHT = 0.7 + (1.5 * FURNITURE_SCALE);
const FRIDGE_BOTTOM = 2 + (3 * FURNITURE_SCALE);
const FRIDGE_PROXIMITY = 1; // tiles away from collision edge

function App() {
  const [showIntro, setShowIntro] = useState(false);
  const fridgeMenu = useFridgeMenu();
  const fridgeMenuRef = useRef(fridgeMenu);
  fridgeMenuRef.current = fridgeMenu;

  const handleFurnitureCollision = useCallback((item) => {
    if (item.id === 'fridge' && !fridgeMenuRef.current.isOpen) {
      fridgeMenuRef.current.showOpenPrompt();
    }
  }, []);

  const { playerPos, playerDirection, animationFrame, movePlayer } = usePlayer([16, 16], handleFurnitureCollision);
  const { currentZone } = useZone(playerPos);
  const { isPlaying, toggleMusic } = useAudio(playerPos);

  useKeyboardControls(movePlayer, toggleMusic, fridgeMenu);

  // Hide fridge prompt when player walks away
  useEffect(() => {
    if (!fridgeMenu.showPrompt || fridgeMenu.isOpen) return;
    const [px, py] = playerPos;
    const nearFridge = px < FRIDGE_RIGHT + FRIDGE_PROXIMITY && py < FRIDGE_BOTTOM + FRIDGE_PROXIMITY;
    if (!nearFridge) {
      fridgeMenu.hidePrompt();
    }
  }, [playerPos, fridgeMenu]);

  if (showIntro) {
    return <PlumeriaIntro onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4" style={{ background: 'linear-gradient(135deg, #FFEDDB 0%, #EDCDBB 35%, #E3B7A0 70%, #BF9270 100%)' }}>
      {/* Header */}
      <h1 className="text-xl sm:text-3xl font-bold mb-3 sm:mb-6 text-center px-2" style={{ color: '#BF9270' }}>
        🎂 Camille's Birthday Music World ☕
      </h1>

      {/* Main container */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-3 sm:gap-6 w-full max-w-6xl">
        {/* Game Map - scaled for mobile */}
        <div
          className="flex-shrink-0 rounded-2xl overflow-hidden"
          style={{
            width: SCALED_MAP_SIZE,
            height: SCALED_MAP_SIZE,
            position: 'relative',
            border: '4px solid #BF9270',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <GameMap
            playerPos={playerPos}
            playerDirection={playerDirection}
            animationFrame={animationFrame}
          />

          {/* Open Fridge prompt */}
          {fridgeMenu.showPrompt && !fridgeMenu.isOpen && (
            <button
              onClick={() => fridgeMenu.open()}
              style={{
                position: 'absolute',
                top: '30%',
                left: '8%',
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
                animation: 'fridgeOpen 0.2s ease-out',
              }}
            >
              Open Fridge [Enter]
            </button>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-80 space-y-3 sm:space-y-6" style={{ maxWidth: SCALED_MAP_SIZE }}>
          <ZonePanel
            currentZone={currentZone}
            isPlaying={isPlaying}
            toggleMusic={toggleMusic}
          />
          <ControlsPanel movePlayer={movePlayer} fridgeMenu={fridgeMenu} />
        </div>
      </div>

      {/* Fridge Menu Modal */}
      {fridgeMenu.isOpen && (
        <FridgeMenu
          items={fridgeMenu.items}
          selectedIndex={fridgeMenu.selectedIndex}
          activeMessage={fridgeMenu.activeMessage}
          onNavigate={fridgeMenu.navigate}
          onClose={fridgeMenu.close}
        />
      )}
    </div>
  );
}

export default App;
