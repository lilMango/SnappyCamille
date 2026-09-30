import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { zones } from '../constants/zoneConfig';
import { player, useGame } from '../store';
import { latLonToDir, angularDistance } from '../utils/sphere';

// Equal-power-ish fade: full inside `inner`, silent past `outer` (arc radians).
function zoneGain(angular, inner, outer) {
  if (angular <= inner) return 1;
  if (angular >= outer) return 0;
  const t = (angular - inner) / (outer - inner);
  return Math.cos((t * Math.PI) / 2);
}

/**
 * Great-circle proximity music, adapted from birthday-music-world/useAudio.js.
 * All zone tracks play simultaneously; per-zone GainNodes are driven by the
 * player's angular distance to each zone center. GainNode volume is used (NOT
 * audio.volume) so it works on iOS. AudioContext is unlocked on `start`.
 */
export function useAudio() {
  const started = useGame((s) => s.started);
  const musicOn = useGame((s) => s.musicOn);

  const ctxRef = useRef(null);
  const gainsRef = useRef({});
  const audiosRef = useRef({});
  const dirsRef = useRef(
    Object.fromEntries(Object.entries(zones).map(([k, z]) => [k, latLonToDir(z.lat, z.lon)]))
  );

  // Initialize the graph once, inside the start gesture.
  useEffect(() => {
    if (!started || ctxRef.current) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;

    Object.entries(zones).forEach(([key, zone]) => {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/${zone.file}`);
      audio.loop = true;
      audio.crossOrigin = 'anonymous';
      audiosRef.current[key] = audio;

      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
      gainsRef.current[key] = gain;

      audio.play().catch(() => {}); // missing file / autoplay: fine, stays silent
    });

    return () => {
      Object.values(audiosRef.current).forEach((a) => {
        a.pause();
        a.src = '';
      });
      ctx.close();
    };
  }, [started]);

  // Resume/suspend on the music toggle.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (musicOn) ctx.resume?.();
    else ctx.suspend?.();
  }, [musicOn]);

  // Per-frame: drive each gain from angular distance + update the active-zone label.
  useFrame(() => {
    const ctx = ctxRef.current;
    if (!ctx || !musicOn) return;
    let best = null;
    let bestGain = 0;
    for (const [key, zone] of Object.entries(zones)) {
      const d = angularDistance(player.posDir, dirsRef.current[key]);
      const g = zoneGain(d, zone.inner, zone.outer);
      const gain = gainsRef.current[key];
      if (gain) gain.gain.setTargetAtTime(g, ctx.currentTime, 0.15);
      if (g > bestGain) {
        bestGain = g;
        best = zone.name;
      }
    }
    const g = useGame.getState();
    if (g.activeZone !== best) useGame.setState({ activeZone: best });
  });
}
