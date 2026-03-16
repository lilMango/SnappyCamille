import { frontyardConfig } from './frontyard/config';
import { hallwayConfig } from './hallway/config';
import { livingRoomConfig } from './living-room/config';
import { kitchenConfig } from './kitchen/config';
import { bedroomConfig } from './bedroom/config';
import { bathroomConfig } from './bathroom/config';
import { studyConfig } from './study/config';
import { musicRoomConfig } from './music-room/config';
import { gardenConfig } from './garden/config';
import { secretRoomConfig } from './secret-room/config';

export const roomRegistry = {
  frontyard: frontyardConfig,
  hallway: hallwayConfig,
  'living-room': livingRoomConfig,
  kitchen: kitchenConfig,
  bedroom: bedroomConfig,
  bathroom: bathroomConfig,
  study: studyConfig,
  'music-room': musicRoomConfig,
  garden: gardenConfig,
  'secret-room': secretRoomConfig,
};
