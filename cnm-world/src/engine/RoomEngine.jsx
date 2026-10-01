import React, { useCallback } from 'react';
import { GameMap } from './components/GameMap';
import { DoorPrompt } from './components/DoorPrompt';
import { InteractPrompt } from './components/InteractPrompt';
import { ZonePanel } from './components/ZonePanel';
import { ControlsPanel } from './components/ControlsPanel';
import { usePlayer } from './hooks/usePlayer';
import { useZone } from './hooks/useZone';
import { useAudio } from './hooks/useAudio';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { useDoorDetection } from './hooks/useDoorDetection';
import { useInteractable } from './hooks/useInteractable';
import { TILE_SIZE, MOBILE_SCALE } from './constants/engineConfig';

// Map of interactable IDs → modal components (lazy-ish static map)
import { KitchenFridge } from '../modals/KitchenFridge';
import { BedroomJournal } from '../modals/BedroomJournal';
import { BathroomDuck } from '../modals/BathroomDuck';
import { StudyBookcase } from '../modals/StudyBookcase';
import { GardenAlbum } from '../modals/GardenAlbum';

const MODAL_REGISTRY = {
  fridge: KitchenFridge,
  journal: BedroomJournal,
  duck: BathroomDuck,
  bookcase: StudyBookcase,
  'photo-album': GardenAlbum,
};

export const RoomEngine = ({
  roomConfig,
  spawnPoint,
  audioContextRef,
  onDoorEnter,
  unlockedRooms,
  unlockRoom,
}) => {
  const initialPos = spawnPoint || roomConfig.defaultSpawn;

  // No-op collision handler; specific rooms don't need special collision callbacks.
  const handleFurnitureCollision = useCallback(() => {}, []);

  const { playerPos, playerDirection, animationFrame, movePlayer } = usePlayer(
    initialPos,
    roomConfig,
    handleFurnitureCollision
  );

  const { currentZone } = useZone(playerPos, roomConfig.zones || []);
  const { isPlaying, toggleMusic } = useAudio(
    playerPos,
    roomConfig.zones || [],
    audioContextRef
  );
  const { activeDoor } = useDoorDetection(
    playerPos,
    roomConfig.doors || [],
    unlockedRooms
  );
  const { activeInteractable, openModalId, openModal, closeModal } = useInteractable(
    playerPos,
    roomConfig.interactables || []
  );

  const handleInteract = useCallback(() => {
    if (openModalId) {
      closeModal();
      return;
    }
    if (activeDoor) {
      onDoorEnter(activeDoor.targetRoomId, activeDoor.targetSpawnPoint);
      return;
    }
    if (activeInteractable) {
      openModal(activeInteractable.id);
    }
  }, [openModalId, activeDoor, activeInteractable, onDoorEnter, closeModal, openModal]);

  useKeyboardControls(movePlayer, handleInteract, !!openModalId);

  const ModalComponent = openModalId ? MODAL_REGISTRY[openModalId] : null;

  const mapWidth = roomConfig.gridCols * TILE_SIZE * MOBILE_SCALE;
  const mapHeight = roomConfig.gridRows * TILE_SIZE * MOBILE_SCALE;

  return (
    <div className="flex flex-col lg:flex-row items-start justify-center gap-3 sm:gap-6 w-full max-w-6xl">
      {/* Game Map + overlay prompts */}
      <div style={{ position: 'relative', width: mapWidth, height: mapHeight, flexShrink: 0, border: '4px solid #BF9270', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <GameMap
          roomConfig={roomConfig}
          playerPos={playerPos}
          playerDirection={playerDirection}
          animationFrame={animationFrame}
          activeDoor={activeDoor}
          unlockedRooms={unlockedRooms}
        />

        {activeDoor && !openModalId && (
          <DoorPrompt door={activeDoor} onEnter={handleInteract} />
        )}
        {activeInteractable && !activeDoor && !openModalId && (
          <InteractPrompt interactable={activeInteractable} onInteract={handleInteract} />
        )}

        {/* Room name badge */}
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: '99px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {roomConfig.displayName}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-72 space-y-3 sm:space-y-4" style={{ maxWidth: mapWidth }}>
        {currentZone && (
          <ZonePanel
            currentZone={currentZone}
            isPlaying={isPlaying}
            toggleMusic={toggleMusic}
          />
        )}
        <ControlsPanel
          movePlayer={movePlayer}
          onInteract={handleInteract}
          hasInteraction={!!(activeDoor || activeInteractable || openModalId)}
          isModalOpen={!!openModalId}
        />
      </div>

      {/* Modals */}
      {ModalComponent && (
        <ModalComponent onClose={closeModal} unlockRoom={unlockRoom} />
      )}
    </div>
  );
};
