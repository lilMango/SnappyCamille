import { useState, useCallback } from 'react';

const FOOD_ITEMS = [
  { id: 'yogurt', name: "Coconut Yogurt", message: "Trader Joe's finest!" },
  { id: 'salad', name: "Salad", message: "So fresh, so green!" },
  { id: 'pizza', name: "Pizza", message: "A classic choice!" },
  { id: 'matcha', name: "Matcha", message: "Zen in a cup!" },
  { id: 'close', name: "Close Fridge", message: null },
];

export const useFridgeMenu = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeMessage, setActiveMessage] = useState(null);

  const showOpenPrompt = useCallback(() => {
    setShowPrompt(true);
  }, []);

  const hidePrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const open = useCallback(() => {
    setShowPrompt(false);
    setSelectedIndex(0);
    setActiveMessage(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveMessage(null);
  }, []);

  const navigate = useCallback((action) => {
    if (action === 'up') {
      setSelectedIndex(prev => (prev - 1 + FOOD_ITEMS.length) % FOOD_ITEMS.length);
    } else if (action === 'down') {
      setSelectedIndex(prev => (prev + 1) % FOOD_ITEMS.length);
    } else if (action === 'select') {
      setSelectedIndex(current => {
        const item = FOOD_ITEMS[current];
        if (item.id === 'close') {
          setIsOpen(false);
          setActiveMessage(null);
        } else {
          setActiveMessage(item.message);
        }
        return current;
      });
    }
  }, []);

  return {
    showPrompt,
    isOpen,
    selectedIndex,
    activeMessage,
    items: FOOD_ITEMS,
    showOpenPrompt,
    hidePrompt,
    open,
    close,
    navigate,
  };
};
