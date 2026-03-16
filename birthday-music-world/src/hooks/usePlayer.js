import { useState, useCallback, useRef } from 'react';
import { checkCollision } from '../utils/gameUtils';

export const usePlayer = (initialPosition = [16, 16], onCollision) => {
  const [playerPos, setPlayerPos] = useState(initialPosition);
  const [playerDirection, setPlayerDirection] = useState('down');
  const [animationFrame, setAnimationFrame] = useState(0);
  const posRef = useRef(initialPosition);

  const movePlayer = useCallback((dx, dy) => {
    // Update direction based on input
    if (dy < 0) setPlayerDirection('up');
    else if (dy > 0) setPlayerDirection('down');
    else if (dx < 0) setPlayerDirection('left');
    else if (dx > 0) setPlayerDirection('right');

    const [x, y] = posRef.current;
    const newX = x + dx;
    const newY = y + dy;

    const collision = checkCollision(newX, newY);
    if (collision) {
      if (collision.type === 'furniture' && onCollision) {
        onCollision(collision.item);
      }
      return;
    }

    const newPos = [newX, newY];
    posRef.current = newPos;
    setPlayerPos(newPos);

    // Toggle between frames 0 and 1 on movement
    setAnimationFrame(prev => (prev + 1) % 2);
  }, [onCollision]);

  return {
    playerPos,
    playerDirection,
    animationFrame,
    movePlayer,
  };
};
