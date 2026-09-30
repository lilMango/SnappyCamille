import { useAudio } from '../hooks/useAudio';

/** Runs the music-zone audio graph. Must live inside the Canvas (uses useFrame). */
export default function AudioController() {
  useAudio();
  return null;
}
