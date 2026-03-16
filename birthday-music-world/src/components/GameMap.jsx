import React from 'react';
import { MAP_SIZE, MOBILE_SCALE, TILE_SIZE, SPRITE_WIDTH, SPRITE_HEIGHT } from '../constants/gameConfig';
import { furniture } from '../constants/furnitureData';
import { roomMap } from '../utils/gameUtils';
import { getTileStyle } from '../utils/spriteUtils';

export const GameMap = ({ playerPos, playerDirection, animationFrame }) => {
  return (
    <div
      className="relative"
      style={{
        width: MAP_SIZE,
        height: MAP_SIZE,
        transform: `scale(${MOBILE_SCALE})`,
        transformOrigin: 'top left',
        imageRendering: 'pixelated',
      }}
    >
      {/* Render floor tiles */}
      {roomMap.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', height: TILE_SIZE }}>
          {row.map((tile, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                width: TILE_SIZE,
                height: TILE_SIZE,
                ...getTileStyle(tile),
              }}
            />
          ))}
        </div>
      ))}

      {/* Render furniture */}
      {furniture.map((item) => (
        <img
          key={item.id}
          src={item.sprite}
          alt={item.id}
          className="absolute pointer-events-none"
          style={{
            left: item.x * TILE_SIZE,
            top: item.y * TILE_SIZE,
            width: item.width * TILE_SIZE,
            height: item.height * TILE_SIZE,
            transform: `scale(2.25) ${item.rotation ? `rotate(${item.rotation}deg)` : ''}`,
            transformOrigin: item.rotation ? 'center' : 'top left',
            imageRendering: 'pixelated',
          }}
        />
      ))}

      {/* Player */}
      <img
        src={`${import.meta.env.BASE_URL}sprites/camille/${playerDirection === 'left' ? 'right' : playerDirection}-${animationFrame}.png`}
        alt="player"
        className="absolute transition-all duration-100"
        style={{
          left: playerPos[0] * TILE_SIZE,
          top: (playerPos[1] * TILE_SIZE) - (SPRITE_HEIGHT - TILE_SIZE), // Anchor at feet
          width: SPRITE_WIDTH,
          height: SPRITE_HEIGHT,
          zIndex: 100,
          transform: playerDirection === 'left' ? 'scaleX(-1)' : 'none',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
