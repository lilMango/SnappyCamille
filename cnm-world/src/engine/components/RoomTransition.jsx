import React from 'react';
import { TRANSITION_DURATION } from '../constants/engineConfig';

// Always rendered; opacity driven by transitionState for CSS fade.
// 'fading-out' → overlay fades to black
// 'fading-in'  → overlay fades back to transparent
export const RoomTransition = ({ transitionState }) => {
  const opacity = transitionState === 'fading-out' ? 1 : 0;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'black',
        zIndex: 1000,
        opacity,
        transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        pointerEvents: transitionState !== 'none' ? 'all' : 'none',
      }}
    />
  );
};
