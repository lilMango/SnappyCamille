# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Birthday Music World - an interactive React pixel-art room exploration app where users walk around a decorated space and discover music playlists in different zones.

## Development Commands

```bash
bun install             # Install dependencies
bun run dev             # Development server on port 1337
bun run build           # Production build to /dist
bun run build:deploy    # Build + copy dist/ to ../public/bday33 + deploy
```

## Architecture

**Grid-based game**: 32x32 tile grid at 16px per tile (512px total map). Four quadrants serve as music zones with different playlists.

**Main components**:
- `src/App.js` - Core game logic: tile rendering, player movement (WASD/arrow keys), collision detection, zone detection, music playback
- `src/components/PlumeriaIntro.js` - Animated flower intro with configurable behavior (auto-reveal, interaction-triggered, timeout)

**Asset system**: 93 pixel-art sprites in `/public/sprites/` including:
- `camille-sprite.png` - Player sprite sheet (48px frames, directional)
- `floors2.png`, `wall-tiles.png` - Tilesets
- Furniture and decoration sprites for collision objects

**Music zones** (quadrant-based):
- Kitchen (top-left): Hawaiian Haven (Kolohe Kai)
- Dining (top-right): Study Sanctuary (JVKE)
- Lounge (bottom-left): R&B Retreat (Snoh Aalegra)
- Counter (bottom-right): Camille's Room (Olivia Dean)

**Spatial audio**: Uses Web Audio API with GainNode for distance-based volume control. All 4 zone tracks play simultaneously; volume fades based on player distance from each zone. Web Audio API is required because iOS ignores the standard `audio.volume` property.

## Tech Stack

- React 19.2.3 with Vite
- Tailwind CSS via CDN (loaded in `index.html`)
- Lucide React for icons

## Key Implementation Details

- Mobile scaling: 67% on mobile devices
- CSS `imageRendering: 'pixelated'` for retro pixel-art rendering
- Collision detection checks against wall boundaries and furniture array
- Player position tracked as grid coordinates; direction tracked for sprite animation
- Zone detection based on player position within quadrant bounds
