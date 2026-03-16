import React, { useMemo } from 'react';
import {
  TILE_SIZE,
  MOBILE_SCALE,
  SPRITE_WIDTH,
  SPRITE_HEIGHT,
  FURNITURE_SCALE,
} from '../constants/engineConfig';
import { getTileStyle } from '../utils/spriteUtils';
import { createRoomMap } from '../utils/gameUtils';

export const GameMap = ({
  roomConfig,
  playerPos,
  playerDirection,
  animationFrame,
  activeDoor,
  unlockedRooms,
}) => {
  const { gridCols, gridRows } = roomConfig;
  const mapWidth = gridCols * TILE_SIZE;
  const mapHeight = gridRows * TILE_SIZE;

  const roomMap = useMemo(() => createRoomMap(roomConfig), [roomConfig]);

  const visibleDoors = (roomConfig.doors || []).filter((door) => {
    if (door.requiresUnlock && !unlockedRooms?.has(door.requiresUnlock)) return false;
    return true;
  });

  return (
    <div
      style={{
        width: mapWidth * MOBILE_SCALE,
        height: mapHeight * MOBILE_SCALE,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        className="relative shadow-2xl border-4 border-amber-800"
        style={{
          width: mapWidth,
          height: mapHeight,
          transform: `scale(${MOBILE_SCALE})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
        }}
      >
        {/* Floor tiles */}
        {roomMap.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', height: TILE_SIZE }}>
            {row.map((tile, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{ width: TILE_SIZE, height: TILE_SIZE, ...getTileStyle(tile) }}
              />
            ))}
          </div>
        ))}

        {/* Furniture */}
        {(roomConfig.furniture || []).map((item) => (
          <img
            key={item.id}
            src={`${import.meta.env.BASE_URL}${item.sprite.slice(1)}`}
            alt={item.id}
            className="absolute pointer-events-none"
            style={{
              left: item.x * TILE_SIZE,
              top: item.y * TILE_SIZE,
              width: item.width * TILE_SIZE,
              height: item.height * TILE_SIZE,
              transform: `scale(${FURNITURE_SCALE})${item.rotation ? ` rotate(${item.rotation}deg)` : ''}`,
              transformOrigin: item.rotation ? 'center' : 'top left',
              imageRendering: 'pixelated',
            }}
          />
        ))}

        {/* Door markers (subtle highlight when active) */}
        {visibleDoors.map((door) =>
          door.spritePosition ? (
            <div
              key={door.id}
              style={{
                position: 'absolute',
                left: door.spritePosition.x * TILE_SIZE,
                top: door.spritePosition.y * TILE_SIZE,
                width: door.spriteSize ? door.spriteSize.w * TILE_SIZE : 2 * TILE_SIZE,
                height: door.spriteSize ? door.spriteSize.h * TILE_SIZE : 3 * TILE_SIZE,
                backgroundColor:
                  activeDoor?.id === door.id
                    ? 'rgba(255,255,150,0.35)'
                    : 'rgba(139,100,50,0.25)',
                border: '2px solid rgba(139,100,50,0.5)',
                imageRendering: 'pixelated',
              }}
            />
          ) : null
        )}

        {/* Player */}
        <img
          src={`${import.meta.env.BASE_URL}sprites/camille/${
            playerDirection === 'left' ? 'right' : playerDirection
          }-${animationFrame}.png`}
          alt="player"
          className="absolute transition-all duration-100"
          style={{
            left: playerPos[0] * TILE_SIZE,
            top: playerPos[1] * TILE_SIZE - (SPRITE_HEIGHT - TILE_SIZE),
            width: SPRITE_WIDTH,
            height: SPRITE_HEIGHT,
            zIndex: 100,
            transform: playerDirection === 'left' ? 'scaleX(-1)' : 'none',
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  );
};
