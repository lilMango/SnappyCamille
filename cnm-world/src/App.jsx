import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { RoomEngine } from './engine/RoomEngine';
import { RoomTransition } from './engine/components/RoomTransition';
import { roomRegistry } from './rooms';
import { cnmHouse } from './worlds/cnm-house';
import { TRANSITION_DURATION } from './engine/constants/engineConfig';

function App() {
  const [currentRoomId, setCurrentRoomId] = useState(cnmHouse.entryRoomId);
  const [spawnPoint, setSpawnPoint] = useState(null);
  const [transitionState, setTransitionState] = useState('none');
  const [pendingRoom, setPendingRoom] = useState(null);
  const [unlockedRooms, setUnlockedRooms] = useState(new Set());
  // Shared AudioContext persists across room transitions (iOS Web Audio pattern)
  const audioContextRef = useRef(null);

  const currentRoomConfig = useMemo(
    () => roomRegistry[currentRoomId],
    [currentRoomId]
  );

  const handleDoorEnter = useCallback(
    (targetRoomId, targetSpawnPoint) => {
      if (transitionState !== 'none') return;
      setPendingRoom({ roomId: targetRoomId, spawnPoint: targetSpawnPoint });
      setTransitionState('fading-out');
    },
    [transitionState]
  );

  // State machine: fading-out → swap room → fading-in → none
  useEffect(() => {
    if (transitionState === 'fading-out' && pendingRoom) {
      const timer = setTimeout(() => {
        setCurrentRoomId(pendingRoom.roomId);
        setSpawnPoint(pendingRoom.spawnPoint);
        setPendingRoom(null);
        setTransitionState('fading-in');
      }, TRANSITION_DURATION);
      return () => clearTimeout(timer);
    }
    if (transitionState === 'fading-in') {
      const timer = setTimeout(
        () => setTransitionState('none'),
        TRANSITION_DURATION
      );
      return () => clearTimeout(timer);
    }
  }, [transitionState, pendingRoom]);

  const unlockRoom = useCallback((roomId) => {
    setUnlockedRooms((prev) => new Set([...prev, roomId]));
  }, []);

  if (!currentRoomConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono" style={{ backgroundColor: '#FFEDDB', color: '#BF9270' }}>
        Room not found: {currentRoomId}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4" style={{ background: 'linear-gradient(135deg, #FFEDDB 0%, #EDCDBB 35%, #E3B7A0 70%, #BF9270 100%)' }}>
      <h1 className="text-xl sm:text-3xl font-bold mb-3 sm:mb-6 text-center px-2" style={{ color: '#BF9270' }}>
        C&amp;M World
      </h1>

      {/* RoomEngine remounts on room change (key=currentRoomId) for fresh state */}
      <RoomEngine
        key={currentRoomId}
        roomConfig={currentRoomConfig}
        spawnPoint={spawnPoint}
        audioContextRef={audioContextRef}
        onDoorEnter={handleDoorEnter}
        unlockedRooms={unlockedRooms}
        unlockRoom={unlockRoom}
      />

      {/* Full-screen black overlay for fade transitions */}
      <RoomTransition transitionState={transitionState} />
    </div>
  );
}

export default App;
