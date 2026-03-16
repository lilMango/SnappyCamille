import { useEffect } from 'react';

// Generic keyboard hook. onInteract is called for Enter/Space.
// When isModalOpen, only Escape is passed through (to close modal).
export const useKeyboardControls = (movePlayer, onInteract, isModalOpen) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (onInteract) onInteract();
        }
        return;
      }

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (onInteract) onInteract();
          break;
        case 'ArrowUp':
        case 'w':
          e.preventDefault();
          movePlayer(0, -1);
          break;
        case 'ArrowDown':
        case 's':
          e.preventDefault();
          movePlayer(0, 1);
          break;
        case 'ArrowLeft':
        case 'a':
          e.preventDefault();
          movePlayer(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
          e.preventDefault();
          movePlayer(1, 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer, onInteract, isModalOpen]);
};
