# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SnappyCamille is a multi-project web hosting container. Sub-projects are built separately and deployed via FTP. Each sub-project has its own git repository and CLAUDE.md.

## Deployment

```bash
./deploy.sh    # Upload /public folder to FTP server
```

Requires `.env` with FTP credentials (copy from `.env.example`). Uses lftp for mirroring.

## Structure

- `public/` - Deployment folder (uploaded to server root)
- `public/index.html` - Root redirect
- `public/bday33/` - Built output from birthday-music-world
- `public/cnm-world/` - Built output from cnm-world
- Sub-project source folders are in `.gitignore` (separate repos)

## Adding Sub-projects

1. Create a `vite.config.js` in the sub-project with `base: '/route-name'`
2. Run `bun install && bun run build` — output goes to `dist/`
3. Copy `dist/` to `public/route-name/`
4. Add source folder to `.gitignore`
5. Deploy with `./deploy.sh`

## Current Sub-projects

| Route | Source | Description |
|-------|--------|-------------|
| `/bday33` | birthday-music-world/ | Interactive pixel-art music room (React, Vite, grid-based game with zone-based playlists) |
| `/cnm-world` | cnm-world/ | 2D pixel-art world engine (React, Vite, room-based exploration) |
| `/galaxy` | camille-galaxy/ | 3D Mario-Galaxy-style Getty Villa on a small planet (Vite + React Three Fiber, spherical walking, follow camera, music zones) |
| `/lanikai` | lanikai-galaxy/ | 3D Wii-Sports-Resort-style Kualoa Ranch & Lanikai Beach on a small planet (Vite + React Three Fiber, spherical walking, follow camera, music zones) |
