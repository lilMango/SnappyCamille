import { useState, useEffect } from 'react';

// Returns the nearest interactable within proximityTiles of the player.
// While a modal is open, proximity updates are paused.
export const useInteractable = (playerPos, interactables) => {
  const [activeInteractable, setActiveInteractable] = useState(null);
  const [openModalId, setOpenModalId] = useState(null);

  useEffect(() => {
    if (openModalId) return;
    const [x, y] = playerPos;
    const found = (interactables || []).find((item) => {
      const dist =
        Math.abs(x - item.anchorTile.x) + Math.abs(y - item.anchorTile.y);
      return dist <= item.proximityTiles;
    });
    setActiveInteractable(found || null);
  }, [playerPos, interactables, openModalId]);

  const openModal = (id) => setOpenModalId(id);
  const closeModal = () => setOpenModalId(null);

  return { activeInteractable, openModalId, openModal, closeModal };
};
