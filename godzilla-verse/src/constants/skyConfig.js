// Time-of-day presets. One preset drives the sky dome, the fog and background colour, the
// world tint (the chunk material multiplies it onto everything except self-lit windows/neon),
// the water colour, and the lights on lit objects (the character, later the kaiju).
//
// Fog and the sky's horizon share a colour so distant geometry dissolves into the haze
// instead of cutting a silhouette against it.

export const SKY_PRESETS = {
  day: {
    horizon: '#bfdcf0',
    zenith: '#4d8fd8',
    glow: '#fff1c8',
    glowAmount: 0.0,
    stars: 0.0,
    moon: 0.0,
    clouds: 0.55,
    cloudColor: '#ffffff',
    fog: '#bfdcf0',
    fogNear: 70,
    fogFar: 155,
    tint: '#ffffff',
    water: '#3b86c8',
    hemiSky: '#cfe2ff',
    hemiGround: '#6b6258',
    hemiIntensity: 1.1,
    sun: '#fff4e0',
    sunIntensity: 2.2,
    sunDir: [0.4, 0.8, 0.25],
  },
  dusk: {
    horizon: '#a98fa8',
    zenith: '#1d2a5c',
    glow: '#ff9a5c',
    glowAmount: 0.95,
    stars: 0.35,
    moon: 0.6,
    clouds: 0.5,
    cloudColor: '#c9798f',
    fog: '#8f7f9c',
    fogNear: 55,
    fogFar: 170,
    tint: '#b3a6d6',
    water: '#3a5a96',
    hemiSky: '#b4aae6',
    hemiGround: '#7a6a86',
    hemiIntensity: 2.2,
    sun: '#ffb07a',
    sunIntensity: 2.4,
    sunDir: [-0.8, 0.22, 0.4], // low in the west
  },
  night: {
    horizon: '#2a3560',
    zenith: '#050918',
    glow: '#5a6fc0',
    glowAmount: 0.15,
    stars: 1.0,
    moon: 1.0,
    clouds: 0.25,
    cloudColor: '#3b4678',
    fog: '#1d2650',
    fogNear: 45,
    fogFar: 150,
    tint: '#6572ad',
    water: '#1c2f66',
    hemiSky: '#8092e0',
    hemiGround: '#3a4066',
    hemiIntensity: 2.0,
    sun: '#b8c8ff',
    sunIntensity: 1.9,
    sunDir: [0.5, 0.7, -0.4], // moonlight
  },
};

// Where the (non-sun) sky features sit, as unit vectors.
export const SUN_DIR = [-0.82, 0.18, 0.54]; // dusk sun: low in the west
export const MOON_DIR = [0.55, 0.62, -0.56];
