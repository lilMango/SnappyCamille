// Import audio files (webpack handles these)
import kitchenSong from '../assets/Kolohe-Kai_Dream-Girl.mp3';
import diningSong from '../assets/JVKE_Golden-hour-8D-AUDIO.mp3';
import loungeSong from '../assets/Snoh-Aalegra_DO-4-LOVE.mp3';
import counterSong from '../assets/Olivia-Dean_Baby-Steps.mp3';

// Music zones (quadrants)
export const zones = {
  kitchen: {
    name: 'Kitchen',
    bounds: { minX: 0, maxX: 16, minY: 6, maxY: 16 },
    message: '🌺 Hawaiian Haven',
    color: '#60a5fa',
    song: kitchenSong,
  },
  dining: {
    name: 'Dining',
    bounds: { minX: 16, maxX: 32, minY: 6, maxY: 16 },
    message: '🍳 Study Sanctuary',
    color: '#34d399',
    song: diningSong,
  },
  lounge: {
    name: 'Lounge',
    bounds: { minX: 0, maxX: 16, minY: 16, maxY: 32 },
    message: '🛋️ R&B Retreat',
    color: '#f472b6',
    song: loungeSong,
  },
  counter: {
    name: 'Counter',
    bounds: { minX: 16, maxX: 32, minY: 16, maxY: 32 },
    message: '☕ Camille\'s Room',
    color: '#fbbf24',
    song: counterSong,
  },
};
