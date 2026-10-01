# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CnM World — Camille & Miguel's interactive 2D pixel-art home. A room-based exploration engine where each room is defined by a config file. Built with React + Vite.

## Development Commands

```bash
bun install             # Install dependencies
bun run dev             # Dev server at http://localhost:1338/cnm-world
bun run build           # Production build to /dist
bun run build:deploy    # Build + copy dist/ to ../public/cnm-world
```

## Architecture

**Engine**: `src/engine/` — fully parameterized by `roomConfig`. Pure hooks + components, no room-specific logic.

**Rooms**: `src/rooms/[room-name]/config.js` — one file per room, data only. Registered in `src/rooms/index.js`.

### Key Engine Files

- `src/engine/RoomEngine.jsx` — top-level component, wires all hooks + components
- `src/engine/constants/engineConfig.js` — `TILE_SIZE=16`, `FURNITURE_SCALE=2.25`, `MOBILE_SCALE=0.67`
- `src/engine/constants/tileTypes.js` — `TILES` enum
- `src/engine/utils/gameUtils.js` — `createRoomMap`, `checkCollision`, `getVolumeFromDistance`
- `src/engine/utils/mapUtils.js` — room layout helpers: `woodFloorRoom`, `outdoorRoom`, `tileFloorRoom`, `carpetRoom`

### Key Engine Components

- `src/engine/components/GameMap.jsx` — renders tiles + furniture
- `src/engine/components/ControlsPanel.jsx` — on-screen D-pad for mobile
- `src/engine/components/ZonePanel.jsx` — music zone HUD
- `src/engine/components/InteractPrompt.jsx` — proximity interaction prompt
- `src/engine/components/DoorPrompt.jsx` — room transition prompt
- `src/engine/components/RoomTransition.jsx` — transition animation

### Interactable Anchor Gotcha

Anchor tile must be OUTSIDE the furniture collision box.
- Collision box: `item.x` to `item.x + item.width * FURNITURE_SCALE` (2.25)
- Example: fridge at `(1,4)` w:1.5 h:3 → collision bottom = `4 + 3*2.25 = 10.75` → anchor at `y ≥ 11`

## Tech Stack

- React 19 + Vite
- Tailwind CSS via CDN
- Lucide React

## Sprites

- Player: `public/sprites/camille/` (down-0, down-1, right-0, right-1, up-0, up-1)
- Furniture: `public/sprites/*.png`
