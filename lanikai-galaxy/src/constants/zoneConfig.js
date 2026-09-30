import { offset, PEAK_LATLON } from './islandLayout';
import { polarToLatLon } from '../utils/terrain';

// Music zones on the sphere. Each has a center (lat/lon), inner/outer arc radii
// (radians) for an equal-power crossfade, an mp3 (dropped into public/audio/),
// and a label. Songs are loaded at runtime from BASE_URL so they aren't bundled.
// Filenames are placeholders — swap in real tracks (see public/audio/README.md).
export const zones = {
  lanikai: {
    name: 'Lanikai Beach',
    ...offset(0, 0), // the stretch of sand around the spawn
    inner: 0.18,
    outer: 0.42,
    file: 'lanikai-beach.mp3',
    color: '#3fd6d0',
  },
  kualoa: {
    name: 'Kualoa Valley',
    ...polarToLatLon(1.99, -10), // valley floor between the two pali ridges
    inner: 0.22,
    outer: 0.5,
    file: 'kualoa-valley.mp3',
    color: '#4caf3f',
  },
  mokolii: {
    name: "Mokoli'i Point",
    ...polarToLatLon(1.0, 55), // the beach that looks straight out at the hat islet
    inner: 0.12,
    outer: 0.32,
    file: 'mokolii-point.mp3',
    color: '#2f8fe0',
  },
  uplands: {
    name: 'Ranch Uplands',
    ...PEAK_LATLON, // far side of the globe, around the big peak
    inner: 0.5,
    outer: 0.95,
    file: 'ranch-uplands.mp3',
    color: '#d9b64a',
  },
};
