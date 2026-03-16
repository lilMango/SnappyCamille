import { useState, useEffect, useCallback, useRef } from 'react';
import { getVolumeFromDistance } from '../utils/gameUtils';

// sharedAudioContextRef: ref from App.js that persists across room transitions (iOS pattern)
export const useAudio = (playerPos, zones, sharedAudioContextRef) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef({});
  const gainNodesRef = useRef({});
  const privateCtxRef = useRef(null);

  const ctxRef = sharedAudioContextRef || privateCtxRef;

  // Cleanup audio elements on unmount (don't destroy shared AudioContext)
  useEffect(() => {
    const elements = audioRefs.current;
    return () => {
      Object.values(elements).forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  const initializeAudio = useCallback(() => {
    if (!ctxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;

    for (const zone of zones) {
      if (!zone.audioPath || audioRefs.current[zone.id]) continue;
      const audio = new Audio(import.meta.env.BASE_URL + zone.audioPath.slice(1));
      audio.loop = true;
      audio.crossOrigin = 'anonymous';
      audioRefs.current[zone.id] = audio;

      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNodesRef.current[zone.id] = gainNode;
    }
  }, [zones, ctxRef]);

  // Update gain values on player movement
  useEffect(() => {
    if (!isPlaying) return;
    for (const zone of zones) {
      const gainNode = gainNodesRef.current[zone.id];
      if (gainNode) {
        gainNode.gain.value = getVolumeFromDistance(playerPos[0], playerPos[1], zone);
      }
    }
  }, [playerPos, isPlaying, zones]);

  const toggleMusic = useCallback(() => {
    if (isPlaying) {
      Object.values(audioRefs.current).forEach((a) => a.pause());
      setIsPlaying(false);
    } else {
      initializeAudio();
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
      for (const zone of zones) {
        const audio = audioRefs.current[zone.id];
        const gainNode = gainNodesRef.current[zone.id];
        if (audio && gainNode) {
          gainNode.gain.value = getVolumeFromDistance(playerPos[0], playerPos[1], zone);
          audio.play().catch((e) => console.error('Audio play failed:', e));
        }
      }
      setIsPlaying(true);
    }
  }, [isPlaying, playerPos, zones, initializeAudio, ctxRef]);

  return { isPlaying, toggleMusic };
};
