import { useEffect } from 'react';

export const useKeyboardControls = (movePlayer, toggleMusic, fridgeMenu) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Menu open mode: only menu navigation keys work
      if (fridgeMenu && fridgeMenu.isOpen) {
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
            e.preventDefault();
            fridgeMenu.navigate('up');
            break;
          case 'ArrowDown':
          case 's':
            e.preventDefault();
            fridgeMenu.navigate('down');
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            fridgeMenu.navigate('select');
            break;
          case 'Escape':
          case 'Backspace':
            e.preventDefault();
            fridgeMenu.close();
            break;
          default:
            break;
        }
        return;
      }

      // Prompt visible mode: Enter/Space opens fridge, other keys still move
      if (fridgeMenu && fridgeMenu.showPrompt) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fridgeMenu.open();
          return;
        }
      }

      // Normal game mode
      switch (e.key) {
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

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePlayer, toggleMusic, fridgeMenu]);
};
