import { useState, useEffect, useCallback, useRef } from 'react';
import { zones } from '../constants/zoneConfig';
import { getVolumeFromDistance } from '../utils/gameUtils';

export const useAudio = (playerPos) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for spatial audio (all 4 tracks play simultaneously)
  const audioRefs = useRef({});
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef({});

  // Cleanup audio on unmount
  useEffect(() => {
    const audioElements = audioRefs.current;
    const audioContext = audioContextRef.current;
    return () => {
      Object.values(audioElements).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  // Initialize audio elements with Web Audio API (called on first play)
  const initializeAudio = useCallback(() => {
    // Create AudioContext if it doesn't exist (with webkit prefix fallback for older iOS)
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;

    Object.entries(zones).forEach(([key, zone]) => {
      if (!audioRefs.current[key]) {
        const audio = new Audio(zone.song);
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        audioRefs.current[key] = audio;

        // Create Web Audio nodes for volume control (works on iOS)
        const source = ctx.createMediaElementSource(audio);
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;

        // Connect: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        gainNodesRef.current[key] = gainNode;
      }
    });
  }, []);

  // Update volumes based on player position (using Web Audio GainNode for iOS support)
  useEffect(() => {
    if (!isPlaying) return;

    Object.entries(zones).forEach(([key, zone]) => {
      const gainNode = gainNodesRef.current[key];
      if (gainNode) {
        const targetVolume = getVolumeFromDistance(playerPos[0], playerPos[1], zone);
        // Set gain value (works on iOS unlike audio.volume)
        gainNode.gain.value = targetVolume;
      }
    });
  }, [playerPos, isPlaying]);

  const toggleMusic = useCallback(() => {
    if (isPlaying) {
      // Pause all tracks
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
      });
      setIsPlaying(false);
    } else {
      // Initialize audio on first play (must be in user interaction)
      initializeAudio();

      // Resume AudioContext (required for iOS - must happen in user interaction)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Start all tracks with appropriate volumes
      Object.entries(zones).forEach(([key, zone]) => {
        const audio = audioRefs.current[key];
        const gainNode = gainNodesRef.current[key];
        if (audio && gainNode) {
          const volume = getVolumeFromDistance(playerPos[0], playerPos[1], zone);
          gainNode.gain.value = volume;
          audio.play().catch((e) => console.error('Audio play failed:', e));
        }
      });
      setIsPlaying(true);
    }
  }, [isPlaying, playerPos, initializeAudio]);

  return {
    isPlaying,
    toggleMusic,
  };
};
